import {
  Encoder,
  Profile,
  Utils,
  type ActivityMesg,
  type DeviceInfoMesg,
  type EventMesg,
  type FileIdMesg,
  type LapMesg,
  type Mesg,
  type RecordMesg,
  type SessionMesg,
} from "@garmin/fitsdk"
import type {SessionValues} from "../../shared/session"
import type {SpeedInterval} from "../../shared/strava"
import type {SessionSample} from "../session/session-tracker"

export interface FitSessionInput {
  session: SessionValues
  samples: SessionSample[]
}

interface DayRecord {
  at: number
  distanceMeters: number
  steps: number
  speedMetersPerSecond: number
}

interface TimedSpeed {
  at: number
  speedMetersPerSecond: number
}

export interface WalkingRecord {
  at: number
  distanceMeters: number
  speedMetersPerSecond: number
  cadence: number
}

const SYNTHETIC_RECORD_INTERVAL_MS = 10_000
// No sample is recorded while the belt is stopped: a gap without distance is a pause, while a gap
// with distance is walking the app missed, and stays in the moving time.
const PAUSE_MIN_GAP_MS = 5000
const PAUSE_MAX_SPEED_METERS_PER_SECOND = 0.2
const FILLED_RECORD_INTERVAL_MS = 1000
// A speed read on this many records in a row is held by the belt, not part of a ramp.
const STEADY_SPEED_SAMPLES = 3
const STRAVA_DISTANCE_RESOLUTION_METERS = 0.1
// Any belt speed in 0.1 km/h steps covers a whole number of metres in 36 s.
const MAX_RECORD_INTERVAL_SECONDS = 36
// Below this gap between the session distance and the belt speeds, the gap only comes from the
// rounding of the pad clock, and the belt speeds are kept exact.
const MAX_BELT_DISTANCE_GAP = 0.01
const DECIMETERS_PER_SHOWN_STEP = 100
// FIT counts walking cadence in cycles, and a cycle is two steps.
const STEPS_PER_CYCLE = 2
const MAX_FIT_CADENCE = 254
const KMH_TO_METERS_PER_SECOND = 1 / 3.6
const SPORT = "walking"
const SUB_SPORT = "indoorWalking"

const toFitTime = (epochMs: number): number =>
  Utils.convertDateToDateTime(new Date(epochMs))

function writeMesg<T extends Mesg>(
  encoder: Encoder,
  mesgNum: number,
  mesg: T
): void {
  encoder.onMesg(mesgNum, mesg)
}

function synthesizeSessionRecords(session: SessionValues): DayRecord[] {
  const durationMs = Math.max(
    session.durationSeconds * 1000,
    SYNTHETIC_RECORD_INTERVAL_MS
  )
  const averageSpeed =
    session.durationSeconds > 0
      ? session.distanceMeters / session.durationSeconds
      : 0
  const records: DayRecord[] = []
  for (
    let elapsedMs = 0;
    elapsedMs <= durationMs;
    elapsedMs += SYNTHETIC_RECORD_INTERVAL_MS
  ) {
    const completion = elapsedMs / durationMs
    records.push({
      at: session.startedAt + elapsedMs,
      distanceMeters: session.distanceMeters * completion,
      steps: session.steps * completion,
      speedMetersPerSecond: averageSpeed,
    })
  }
  return records
}

// Samples follow the pad counters, while an edited session keeps the totals typed by hand:
// the samples are scaled to those totals.
function sessionRecords({session, samples}: FitSessionInput): DayRecord[] {
  const orderedSamples = [...samples].sort((left, right) => left.at - right.at)
  const lastSample = orderedSamples.at(-1)
  if (!lastSample || orderedSamples.length < 2)
    return synthesizeSessionRecords(session)

  const distanceScale =
    lastSample.distanceMeters > 0
      ? session.distanceMeters / lastSample.distanceMeters
      : 1
  const stepScale = lastSample.steps > 0 ? session.steps / lastSample.steps : 1
  return orderedSamples.map((sample) => ({
    at: sample.at,
    distanceMeters: sample.distanceMeters * distanceScale,
    steps: sample.steps * stepScale,
    speedMetersPerSecond: sample.speedKmh * KMH_TO_METERS_PER_SECOND,
  }))
}

export function buildDayRecords(inputs: FitSessionInput[]): DayRecord[][] {
  const orderedInputs = [...inputs].sort(
    (left, right) => left.session.startedAt - right.session.startedAt
  )
  let distanceBeforeSession = 0
  let stepsBeforeSession = 0
  return orderedInputs.map((input) => {
    const records = sessionRecords(input).map((record) => ({
      ...record,
      distanceMeters: distanceBeforeSession + record.distanceMeters,
      steps: stepsBeforeSession + record.steps,
    }))
    distanceBeforeSession += input.session.distanceMeters
    stepsBeforeSession += input.session.steps
    return records
  })
}

export function isPauseBetween(previous: DayRecord, next: DayRecord): boolean {
  const gapMs = next.at - previous.at
  if (gapMs < PAUSE_MIN_GAP_MS) return false
  const averageSpeed =
    (next.distanceMeters - previous.distanceMeters) / (gapMs / 1000)
  return averageSpeed < PAUSE_MAX_SPEED_METERS_PER_SECOND
}

// Walking the app did not record leaves a hole that Strava draws as a curve: it is filled at the
// belt speed seen before the hole, since the 10 m steps of the pad make its average speed rough.
export function fillMissedWalking(records: DayRecord[]): DayRecord[] {
  const filledRecords: DayRecord[] = []
  records.forEach((record, index) => {
    const previous = records[index - 1]
    const isMissedWalking =
      previous &&
      record.at - previous.at >= PAUSE_MIN_GAP_MS &&
      !isPauseBetween(previous, record)
    if (isMissedWalking) {
      const gapMs = record.at - previous.at
      const beltSpeed =
        previous.speedMetersPerSecond > 0
          ? previous.speedMetersPerSecond
          : record.speedMetersPerSecond
      for (
        let offsetMs = FILLED_RECORD_INTERVAL_MS;
        offsetMs < gapMs;
        offsetMs += FILLED_RECORD_INTERVAL_MS
      ) {
        const completion = offsetMs / gapMs
        filledRecords.push({
          at: previous.at + offsetMs,
          distanceMeters:
            previous.distanceMeters +
            (record.distanceMeters - previous.distanceMeters) * completion,
          steps: previous.steps + (record.steps - previous.steps) * completion,
          speedMetersPerSecond: beltSpeed,
        })
      }
    }
    filledRecords.push(record)
  })
  return filledRecords
}

export function splitAtPauses(records: DayRecord[]): DayRecord[][] {
  const segments: DayRecord[][] = []
  for (const record of records) {
    const currentSegment = segments.at(-1)
    if (currentSegment && !isPauseBetween(currentSegment.at(-1)!, record))
      currentSegment.push(record)
    else segments.push([record])
  }
  return segments
}

function isSteadyFrom(
  records: DayRecord[],
  index: number,
  direction: 1 | -1
): boolean {
  for (let offset = 1; offset < STEADY_SPEED_SAMPLES; offset++) {
    const neighbour = records[index + offset * direction]
    if (neighbour?.speedMetersPerSecond !== records[index].speedMetersPerSecond)
      return false
  }
  return true
}

// The belt slows down for a few seconds before a stop and speeds up after it, with a short burst
// when it starts. The pad does not count those seconds, so they are left out of the file, while
// every speed held for a while stays in it.
export function trimRamps(segment: DayRecord[]): DayRecord[] {
  let firstSteadyIndex = 0
  while (
    firstSteadyIndex < segment.length - 1 &&
    !isSteadyFrom(segment, firstSteadyIndex, 1)
  )
    firstSteadyIndex++
  let lastSteadyIndex = segment.length - 1
  while (
    lastSteadyIndex > firstSteadyIndex &&
    !isSteadyFrom(segment, lastSteadyIndex, -1)
  )
    lastSteadyIndex--
  if (firstSteadyIndex >= lastSteadyIndex) return segment
  return segment.slice(firstSteadyIndex, lastSteadyIndex + 1)
}

export interface SpeedRun {
  metersPerSecond: number
  cadence: number
  seconds: number
}

// Strava stores distances at 0.1 m: one record per second at walking speed alternates 0.5 m and
// 0.6 m steps, which its pace graph shows as spikes. Each run at a constant belt speed is written
// with the shortest interval whose distance is a multiple of 0.1 m, so Strava reads that speed
// exactly. A run keeps its real length, so its last interval also takes the seconds left and may
// read slightly off. The last run of the file lasts a whole number of intervals instead, so the graph
// does not end on a step.
export function writeExactRuns(
  runs: SpeedRun[],
  start: {at: number; distanceMeters: number},
  appEndMeters: number
): WalkingRecord[] {
  const records: WalkingRecord[] = []
  let at = start.at
  let decimeters = Math.round(start.distanceMeters * 10)
  runs.forEach((run, index) => {
    const recordOf = () => ({
      at,
      distanceMeters: decimeters / 10,
      speedMetersPerSecond: run.metersPerSecond,
      cadence: run.cadence,
    })
    const walk = (seconds: number, walkedDecimeters: number) => {
      at += seconds * 1000
      decimeters += walkedDecimeters
      records.push(recordOf())
    }
    if (records.length === 0) records.push(recordOf())

    const intervalSeconds = exactIntervalSeconds(run.metersPerSecond)
    const intervalDecimeters = Math.round(
      run.metersPerSecond * intervalSeconds * 10
    )
    const isLastRun = index === runs.length - 1
    if (isLastRun && intervalDecimeters > 0) {
      const missingDecimeters = Math.round(appEndMeters * 10) - decimeters
      const intervalCount = lastRunIntervalCount(
        missingDecimeters,
        intervalDecimeters,
        decimeters
      )
      for (let interval = 0; interval < intervalCount; interval++)
        walk(intervalSeconds, intervalDecimeters)
      return
    }

    const hasSecondsLeft = run.seconds % intervalSeconds > 0
    const exactIntervalCount = Math.max(
      0,
      Math.floor(run.seconds / intervalSeconds) - (hasSecondsLeft ? 1 : 0)
    )
    for (let interval = 0; interval < exactIntervalCount; interval++)
      walk(intervalSeconds, intervalDecimeters)
    const secondsLeft = run.seconds - exactIntervalCount * intervalSeconds
    if (secondsLeft > 0)
      walk(secondsLeft, Math.round(run.metersPerSecond * secondsLeft * 10))
  })
  return records
}

// The belt speed of each second, grouped into runs at the same speed. An edited session keeps the
// distance typed by hand, so its speeds are scaled to it.
function toSpeedRuns(
  secondRecords: TimedSpeed[],
  session: SessionValues
): SpeedRun[] {
  let beltMeters = 0
  for (let index = 1; index < secondRecords.length; index++) {
    beltMeters += metersBetween(secondRecords[index - 1], secondRecords[index])
  }
  const distanceScale = beltMeters > 0 ? session.distanceMeters / beltMeters : 0
  const speedScale =
    Math.abs(distanceScale - 1) <= MAX_BELT_DISTANCE_GAP ? 1 : distanceScale
  const stepsPerMeter =
    session.distanceMeters > 0 ? session.steps / session.distanceMeters : 0

  const runs: SpeedRun[] = []
  for (let index = 0; index < secondRecords.length - 1; index++) {
    const metersPerSecond =
      secondRecords[index].speedMetersPerSecond * speedScale
    const seconds =
      (secondRecords[index + 1].at - secondRecords[index].at) / 1000
    const currentRun = runs.at(-1)
    if (currentRun?.metersPerSecond === metersPerSecond) {
      currentRun.seconds += seconds
    } else {
      const stepsPerMinute = metersPerSecond * stepsPerMeter * 60
      runs.push({
        metersPerSecond,
        seconds,
        cadence: Math.min(
          MAX_FIT_CADENCE,
          Math.round(stepsPerMinute / STEPS_PER_CYCLE)
        ),
      })
    }
  }
  return mergeSpeedChanges(runs)
}

// While the belt changes speed, the pad reports a second or two at speeds in between: they join
// the next run, so the graph steps straight from one speed to the next.
function mergeSpeedChanges(runs: SpeedRun[]): SpeedRun[] {
  const mergedRuns: SpeedRun[] = []
  let carriedSeconds = 0
  runs.forEach((run, index) => {
    const isLastRun = index === runs.length - 1
    if (run.seconds < STEADY_SPEED_SAMPLES && !isLastRun) {
      carriedSeconds += run.seconds
      return
    }
    const previousRun = mergedRuns.at(-1)
    if (previousRun?.metersPerSecond === run.metersPerSecond)
      previousRun.seconds += carriedSeconds + run.seconds
    else mergedRuns.push({...run, seconds: carriedSeconds + run.seconds})
    carriedSeconds = 0
  })
  return mergedRuns
}

// Strava truncates the distance it shows to 10 m: the last run ends as close as it can to the
// distance of the app while showing the same.
function lastRunIntervalCount(
  missingDecimeters: number,
  intervalDecimeters: number,
  startDecimeters: number
): number {
  const shownTensOfMeters = (decimeters: number) =>
    Math.floor(decimeters / DECIMETERS_PER_SHOWN_STEP)
  const appTensOfMeters = shownTensOfMeters(startDecimeters + missingDecimeters)
  const fewerIntervals = Math.max(
    1,
    Math.floor(missingDecimeters / intervalDecimeters)
  )
  const candidates = [fewerIntervals, fewerIntervals + 1].filter(
    (count) =>
      shownTensOfMeters(startDecimeters + count * intervalDecimeters) ===
      appTensOfMeters
  )
  if (candidates.length === 0) return fewerIntervals + 1
  return candidates.reduce((best, count) =>
    Math.abs(count * intervalDecimeters - missingDecimeters) <
    Math.abs(best * intervalDecimeters - missingDecimeters)
      ? count
      : best
  )
}

// 9 s at 2 km/h (5.0 m), 3 s at 3 km/h (2.5 m), 18 s at 2.5 km/h (12.5 m).
function exactIntervalSeconds(metersPerSecond: number): number {
  for (let seconds = 1; seconds < MAX_RECORD_INTERVAL_SECONDS; seconds++) {
    const meters = metersPerSecond * seconds
    if (Math.abs(meters - snapToStravaDistance(meters)) < 1e-6) return seconds
  }
  return MAX_RECORD_INTERVAL_SECONDS
}

const snapToStravaDistance = (meters: number) =>
  Math.round(meters / STRAVA_DISTANCE_RESOLUTION_METERS) *
  STRAVA_DISTANCE_RESOLUTION_METERS

// FIT keeps whole seconds only: samples taken a few milliseconds apart from the second would
// otherwise show 2 s intervals that Strava reads as slowdowns.
function resampleOnWholeSeconds(records: TimedSpeed[]): TimedSpeed[] {
  const firstSecond = Math.round(records[0].at / 1000) * 1000
  const lastSecond = Math.round(records.at(-1)!.at / 1000) * 1000
  const secondRecords: TimedSpeed[] = []
  let sourceIndex = 0
  for (let at = firstSecond; at <= lastSecond; at += 1000) {
    while (
      sourceIndex < records.length - 1 &&
      records[sourceIndex + 1].at <= at
    )
      sourceIndex++
    secondRecords.push({
      at,
      speedMetersPerSecond: records[sourceIndex].speedMetersPerSecond,
    })
  }
  return secondRecords
}

// The pad distance moves in 10 m steps and its step counter is coarse, so distance and cadence
// follow the belt speed.
export function buildWalkingTimeline(
  inputs: FitSessionInput[]
): WalkingRecord[][] {
  const orderedSessions = [...inputs]
    .map((input) => input.session)
    .sort((left, right) => left.startedAt - right.startedAt)
  let fileEnd: {at: number; distanceMeters: number} | null = null
  let appDistanceMeters = 0
  return buildDayRecords(inputs).map((records, sessionIndex) => {
    const session = orderedSessions[sessionIndex]
    const segments = splitAtPauses(fillMissedWalking(records)).map(trimRamps)
    const chainedRecords = chainSegments(
      segments,
      fileEnd?.at ?? null,
      walkingTimeFactorOf(segments, session.durationSeconds)
    )
    const secondRecords = resampleOnWholeSeconds(chainedRecords)
    appDistanceMeters += session.distanceMeters
    const sessionRecords = writeExactRuns(
      toSpeedRuns(secondRecords, session),
      fileEnd ?? {at: secondRecords[0].at, distanceMeters: 0},
      appDistanceMeters
    )
    fileEnd = sessionRecords.at(-1)!
    return sessionRecords
  })
}

function metersBetween(previous: TimedSpeed, next: TimedSpeed): number {
  return (previous.speedMetersPerSecond * (next.at - previous.at)) / 1000
}

// Strava counts any pause of an indoor activity as moving time, so the file holds walking only:
// the parts between pauses, and the sessions of the day, are joined end to end.
function chainSegments(
  segments: DayRecord[][],
  previousSessionEnd: number | null,
  walkingTimeFactor: number
): TimedSpeed[] {
  const chainedRecords: TimedSpeed[] = []
  let clock = previousSessionEnd
  for (const segment of segments) {
    const segmentStart = clock ?? segment[0].at
    for (const record of segment) {
      const walkedMs = (record.at - segment[0].at) * walkingTimeFactor
      chainedRecords.push({
        at: segmentStart + walkedMs,
        speedMetersPerSecond: record.speedMetersPerSecond,
      })
    }
    clock = chainedRecords.at(-1)!.at
  }
  return chainedRecords
}

// Strava divides the distance by the length of the file to show the pace: the file lasts exactly
// the walking time the pad counted.
function walkingTimeFactorOf(
  segments: DayRecord[][],
  durationSeconds: number
): number {
  const walkingMs = segments.reduce(
    (total, segment) => total + segment.at(-1)!.at - segment[0].at,
    0
  )
  return walkingMs > 0 && durationSeconds > 0
    ? (durationSeconds * 1000) / walkingMs
    : 1
}

function summarizeLap(
  session: SessionValues,
  records: WalkingRecord[],
  messageIndex: number
): LapMesg {
  const startTime = toFitTime(records[0].at)
  const endTime = toFitTime(records.at(-1)!.at)
  const lapDistanceMeters =
    records.at(-1)!.distanceMeters - records[0].distanceMeters
  return {
    messageIndex,
    timestamp: endTime,
    startTime,
    totalElapsedTime: endTime - startTime,
    totalTimerTime: endTime - startTime,
    totalDistance: lapDistanceMeters,
    totalCycles: Math.round(session.steps / STEPS_PER_CYCLE),
    avgSpeed:
      endTime > startTime ? lapDistanceMeters / (endTime - startTime) : 0,
    maxSpeed: session.maxSpeedKmh * KMH_TO_METERS_PER_SECOND,
    sport: SPORT,
    subSport: SUB_SPORT,
    lapTrigger: "sessionEnd",
    event: "lap",
    eventType: "stop",
  }
}

function writeFileHeader(encoder: Encoder, activityStart: number): void {
  writeMesg<FileIdMesg>(encoder, Profile.MesgNum.FILE_ID, {
    type: "activity",
    manufacturer: "development",
    product: 0,
    timeCreated: activityStart,
    serialNumber: activityStart,
  })
  writeMesg<DeviceInfoMesg>(encoder, Profile.MesgNum.DEVICE_INFO, {
    deviceIndex: "creator",
    manufacturer: "development",
    product: 0,
    productName: "WalkingBar",
    timestamp: activityStart,
  })
}

function writeTimerEvent(
  encoder: Encoder,
  at: number,
  eventType: "start" | "stopAll"
): void {
  writeMesg<EventMesg>(encoder, Profile.MesgNum.EVENT, {
    timestamp: toFitTime(at),
    event: "timer",
    eventType,
  })
}

// What the pace graph of Strava will show: the speed between two records, once Strava has rounded
// their distances to 0.1 m.
export function stravaSpeedProfile(inputs: FitSessionInput[]): SpeedInterval[] {
  if (inputs.length === 0) return []
  const records = buildWalkingTimeline(inputs).flat()
  const activityStart = records[0].at
  const intervals: SpeedInterval[] = []
  for (let index = 1; index < records.length; index++) {
    const [previous, record] = [records[index - 1], records[index]]
    const seconds = (record.at - previous.at) / 1000
    if (seconds <= 0) continue
    const meters =
      snapToStravaDistance(record.distanceMeters) -
      snapToStravaDistance(previous.distanceMeters)
    intervals.push({
      startSeconds: (previous.at - activityStart) / 1000,
      endSeconds: (record.at - activityStart) / 1000,
      speedKmh: (meters / seconds) * 3.6,
    })
  }
  return intervals
}

export function encodeActivityFit(inputs: FitSessionInput[]): Uint8Array {
  const recordsBySession = buildWalkingTimeline(inputs)
  const orderedSessions = [...inputs]
    .map((input) => input.session)
    .sort((left, right) => left.startedAt - right.startedAt)
  const activityStart = toFitTime(recordsBySession[0][0].at)
  const activityEnd = toFitTime(recordsBySession.at(-1)!.at(-1)!.at)
  const totalTimerSeconds = activityEnd - activityStart
  const totalDistanceMeters = recordsBySession.at(-1)!.at(-1)!.distanceMeters
  const totalSteps = orderedSessions.reduce(
    (total, session) => total + session.steps,
    0
  )

  const encoder = new Encoder()
  writeFileHeader(encoder, activityStart)
  writeTimerEvent(encoder, recordsBySession[0][0].at, "start")

  let lastWrittenTime: number | null = null
  recordsBySession.forEach((records, sessionIndex) => {
    records.forEach((record) => {
      const timestamp = toFitTime(record.at)
      if (timestamp === lastWrittenTime) return
      lastWrittenTime = timestamp
      writeMesg<RecordMesg>(encoder, Profile.MesgNum.RECORD, {
        timestamp,
        distance: record.distanceMeters,
        speed: record.speedMetersPerSecond,
        enhancedSpeed: record.speedMetersPerSecond,
        cadence: record.cadence,
      })
    })
    writeMesg<LapMesg>(
      encoder,
      Profile.MesgNum.LAP,
      summarizeLap(orderedSessions[sessionIndex], records, sessionIndex)
    )
  })

  writeTimerEvent(encoder, recordsBySession.at(-1)!.at(-1)!.at, "stopAll")
  writeMesg<SessionMesg>(encoder, Profile.MesgNum.SESSION, {
    messageIndex: 0,
    timestamp: activityEnd,
    startTime: activityStart,
    totalElapsedTime: activityEnd - activityStart,
    totalTimerTime: totalTimerSeconds,
    totalDistance: totalDistanceMeters,
    totalCycles: Math.round(totalSteps / STEPS_PER_CYCLE),
    avgSpeed:
      totalTimerSeconds > 0 ? totalDistanceMeters / totalTimerSeconds : 0,
    maxSpeed:
      Math.max(...orderedSessions.map((session) => session.maxSpeedKmh)) *
      KMH_TO_METERS_PER_SECOND,
    sport: SPORT,
    subSport: SUB_SPORT,
    firstLapIndex: 0,
    numLaps: orderedSessions.length,
    trigger: "activityEnd",
    event: "session",
    eventType: "stop",
  })
  const localTimeOffsetSeconds =
    -new Date(recordsBySession.at(-1)!.at(-1)!.at).getTimezoneOffset() * 60
  writeMesg<ActivityMesg>(encoder, Profile.MesgNum.ACTIVITY, {
    timestamp: activityEnd,
    totalTimerTime: totalTimerSeconds,
    numSessions: 1,
    type: "manual",
    event: "activity",
    eventType: "stop",
    localTimestamp: activityEnd + localTimeOffsetSeconds,
  })
  return encoder.close()
}
