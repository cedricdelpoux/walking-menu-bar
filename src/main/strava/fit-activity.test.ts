import {Decoder, Stream} from "@garmin/fitsdk"
import {describe, expect, it} from "vitest"
import type {SessionValues} from "../../shared/session"
import type {SessionSample} from "../session/session-tracker"
import type {SpeedRun} from "./fit-activity"
import {
  buildDayRecords,
  buildWalkingTimeline,
  encodeActivityFit,
  fillMissedWalking,
  trimRamps,
  isPauseBetween,
  stravaSpeedProfile,
  writeExactRuns,
} from "./fit-activity"

const at = (hour: number, minute: number, second = 0) =>
  new Date(2026, 9, 20, hour, minute, second).getTime()

function steadyWalk(
  startedAt: number,
  durationSeconds: number,
  speedKmh: number,
  stepsPerSecond: number
) {
  const samples: SessionSample[] = []
  for (let second = 1; second <= durationSeconds; second++) {
    samples.push({
      at: startedAt + second * 1000,
      speedKmh,
      distanceMeters: (speedKmh / 3.6) * second,
      steps: Math.round(stepsPerSecond * second),
    })
  }
  const last = samples.at(-1)!
  const session: SessionValues = {
    startedAt,
    endedAt: last.at,
    durationSeconds,
    distanceMeters: last.distanceMeters,
    steps: last.steps,
    maxSpeedKmh: speedKmh,
  }
  return {session, samples}
}

function decode(bytes: Uint8Array) {
  const decoder = new Decoder(Stream.fromByteArray(bytes))
  expect(decoder.checkIntegrity()).toBe(true)
  const {messages, errors} = decoder.read()
  expect(errors).toEqual([])
  return messages
}

describe("encodeActivityFit", () => {
  it("writes one indoor walk with a lap per session, its steps and its cadence", () => {
    const morning = steadyWalk(at(10, 0), 600, 3.6, 1.8)
    const afternoon = steadyWalk(at(15, 0), 300, 3.6, 1.8)
    const messages = decode(encodeActivityFit([afternoon, morning]))

    const sessions = messages.sessionMesgs ?? []
    const laps = messages.lapMesgs ?? []
    const records = messages.recordMesgs ?? []
    const [session] = sessions
    expect(session).toMatchObject({
      sport: "walking",
      subSport: "indoorWalking",
      numLaps: 2,
      totalTimerTime: 900,
    })
    expect(session.totalElapsedTime).toBeGreaterThanOrEqual(899)
    expect(session.totalDistance).toBeCloseTo(900, 0)
    expect(session.totalCycles).toBe(810)
    expect(session.startTime).toEqual(new Date(at(10, 0, 1)))

    expect(laps.map((lap) => Math.round(lap.totalDistance ?? 0))).toEqual([
      600, 300,
    ])
    expect(records.at(-1)?.distance).toBeCloseTo(900, 0)
    expect(new Set(records.map((record) => record.cadence))).toEqual(
      new Set([54])
    )
    expect(messages.activityMesgs).toHaveLength(1)
  })

  it("describes the speed Strava will read, from the start of the activity", () => {
    const intervals = stravaSpeedProfile([steadyWalk(at(10, 0), 600, 3.6, 1.8)])
    expect(intervals[0].startSeconds).toBe(0)
    expect(intervals.at(-1)!.endSeconds).toBe(600)
    expect(
      new Set(intervals.map((interval) => interval.speedKmh.toFixed(3)))
    ).toEqual(new Set(["3.600"]))
    expect(stravaSpeedProfile([])).toEqual([])
  })

  it("scales the samples of an edited session to its totals", () => {
    const walk = steadyWalk(at(10, 0), 100, 3.6, 2)
    const edited = {
      ...walk,
      session: {...walk.session, distanceMeters: 150, steps: 300},
    }
    const [records] = buildDayRecords([edited])
    expect(records.at(-1)).toMatchObject({distanceMeters: 150, steps: 300})
  })

  it("makes up regular records for a session without samples", () => {
    const reconstructed: SessionValues = {
      startedAt: at(10, 0),
      endedAt: at(11, 9),
      durationSeconds: 4140,
      distanceMeters: 2320,
      steps: 0,
      maxSpeedKmh: 2,
    }
    const [records] = buildDayRecords([{session: reconstructed, samples: []}])
    expect(records[0]).toMatchObject({at: at(10, 0), distanceMeters: 0})
    expect(records.at(-1)).toMatchObject({distanceMeters: 2320})
    expect(records.length).toBeGreaterThan(400)
  })

  it("leaves pauses out of the file", () => {
    const beforePause = steadyWalk(at(10, 0), 300, 3.6, 1.8)
    const afterPause = steadyWalk(at(10, 7), 300, 3.6, 1.8)
    const pauseStart = beforePause.samples.at(-1)!
    const resumedSamples = afterPause.samples.map((sample) => ({
      ...sample,
      distanceMeters: pauseStart.distanceMeters + sample.distanceMeters,
      steps: pauseStart.steps + sample.steps,
    }))
    const samples = [...beforePause.samples, ...resumedSamples]
    const session = {
      ...beforePause.session,
      endedAt: samples.at(-1)!.at,
      durationSeconds: 600,
      distanceMeters: 600,
      steps: 1080,
    }

    const [sessionMesg] =
      decode(encodeActivityFit([{session, samples}])).sessionMesgs ?? []
    expect(sessionMesg.totalTimerTime).toBe(600)
    expect(sessionMesg.totalElapsedTime).toBe(600)
  })

  it("joins a morning and an afternoon session end to end", () => {
    const morning = steadyWalk(at(10, 0), 600, 3.6, 1.8)
    const afternoon = steadyWalk(at(15, 0), 300, 3.6, 1.8)
    const [recordsOfMorning, recordsOfAfternoon] = buildWalkingTimeline([
      morning,
      afternoon,
    ])
    expect(recordsOfAfternoon[0].at).toBe(recordsOfMorning.at(-1)!.at)
    expect(recordsOfAfternoon[0].distanceMeters).toBeCloseTo(600, 0)
    expect(
      recordsOfAfternoon.every((record) => record.speedMetersPerSecond === 1)
    ).toBe(true)
  })

  it("keeps walking the app did not record in the moving time", () => {
    const before = {
      at: at(11, 10),
      distanceMeters: 1970,
      steps: 3534,
      speedMetersPerSecond: 0.55,
    }
    const missedWalking = {
      at: at(11, 26),
      distanceMeters: 2500,
      steps: 4453,
      speedMetersPerSecond: 0.55,
    }
    const stillBelt = {
      at: at(11, 26, 30),
      distanceMeters: 2500,
      steps: 4453,
      speedMetersPerSecond: 0,
    }
    expect(isPauseBetween(before, missedWalking)).toBe(false)
    expect(isPauseBetween(missedWalking, stillBelt)).toBe(true)
  })

  it("follows the belt speed rather than the 10 m steps and the coarse step counter of the pad", () => {
    const samples: SessionSample[] = Array.from({length: 120}, (_, index) => ({
      at: at(10, 0, 0) + (index + 1) * 1000,
      speedKmh: 2,
      distanceMeters: Math.floor(((index + 1) * 2) / 3.6 / 10) * 10,
      steps: index + 1 + (index % 7 === 0 ? 2 : 0),
    }))
    const session: SessionValues = {
      startedAt: at(10, 0),
      endedAt: samples.at(-1)!.at,
      durationSeconds: 120,
      distanceMeters: 66.7,
      steps: 120,
      maxSpeedKmh: 2,
    }
    const [records] = buildWalkingTimeline([{session, samples}])
    const speeds = records
      .slice(1, -1)
      .map(
        (record, index) =>
          (record.distanceMeters - records[index].distanceMeters) /
          ((record.at - records[index].at) / 1000)
      )
    expect(Math.max(...speeds) - Math.min(...speeds)).toBeLessThan(0.001)
    expect(new Set(records.map((record) => record.cadence))).toEqual(
      new Set([30])
    )
    expect(Math.floor(records.at(-1)!.distanceMeters / 10)).toBe(6)
  })

  it("leaves out the speed up after a start and the slowdown before a stop", () => {
    const speedsKmh = [3, 2.3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1.5, 0.9]
    const segment = speedsKmh.map((speedKmh, second) => ({
      at: at(10, 0, second),
      distanceMeters: second,
      steps: second,
      speedMetersPerSecond: speedKmh / 3.6,
    }))
    expect(
      trimRamps(segment).map(
        (record) => Math.round(record.speedMetersPerSecond * 36) / 10
      )
    ).toEqual(Array(10).fill(2))
  })

  it("keeps every speed walked during a segment", () => {
    const speedsKmh = [
      2.8,
      2.2,
      ...Array(5).fill(2),
      ...Array(5).fill(2.5),
      ...Array(5).fill(3),
      2,
      1,
    ]
    const segment = speedsKmh.map((speedKmh, second) => ({
      at: at(10, 0, second),
      distanceMeters: second,
      steps: second,
      speedMetersPerSecond: speedKmh / 3.6,
    }))
    const keptSpeeds = trimRamps(segment).map(
      (record) => Math.round(record.speedMetersPerSecond * 36) / 10
    )
    expect(keptSpeeds).toEqual([
      ...Array(5).fill(2),
      ...Array(5).fill(2.5),
      ...Array(5).fill(3),
    ])
  })

  it("steps straight from one belt speed to the next", () => {
    const speedsKmh = [...Array(90).fill(2), 2.2, 2.4, ...Array(90).fill(2.5)]
    let distanceMeters = 0
    const samples: SessionSample[] = speedsKmh.map((speedKmh, index) => {
      distanceMeters += speedKmh / 3.6
      return {
        at: at(10, 0, 0) + (index + 1) * 1000,
        speedKmh,
        distanceMeters,
        steps: index + 1,
      }
    })
    const session: SessionValues = {
      startedAt: at(10, 0),
      endedAt: samples.at(-1)!.at,
      durationSeconds: samples.length,
      distanceMeters,
      steps: samples.length,
      maxSpeedKmh: 2.5,
    }
    const [records] = buildWalkingTimeline([{session, samples}])
    const speedsReadKmh = records
      .slice(1)
      .map(
        (record, index) =>
          ((record.distanceMeters - records[index].distanceMeters) /
            ((record.at - records[index].at) / 1000)) *
          3.6
      )
    expect(
      speedsReadKmh.every(
        (speedKmh) =>
          Math.abs(speedKmh - 2) < 0.03 || Math.abs(speedKmh - 2.5) < 0.03
      )
    ).toBe(true)
  })

  it("fills walking the app missed at the belt speed seen before", () => {
    const records = [
      {
        at: at(11, 10, 0),
        distanceMeters: 1970,
        steps: 3534,
        speedMetersPerSecond: 0.55,
      },
      {
        at: at(11, 10, 10),
        distanceMeters: 1980,
        steps: 3544,
        speedMetersPerSecond: 0.55,
      },
    ]
    const filled = fillMissedWalking(records)
    expect(filled).toHaveLength(11)
    expect(filled[5]).toMatchObject({at: at(11, 10, 5), steps: 3539})
    expect(filled[5].distanceMeters).toBeCloseTo(1975, 2)
    expect(filled[5].speedMetersPerSecond).toBe(0.55)
  })

  it("leaves pauses empty", () => {
    const records = [
      {
        at: at(11, 0, 0),
        distanceMeters: 500,
        steps: 900,
        speedMetersPerSecond: 0.55,
      },
      {
        at: at(11, 2, 0),
        distanceMeters: 500,
        steps: 900,
        speedMetersPerSecond: 0.55,
      },
    ]
    expect(fillMissedWalking(records)).toHaveLength(2)
  })

  it("writes records on whole seconds only", () => {
    const samples: SessionSample[] = Array.from({length: 60}, (_, index) => ({
      at: at(10, 0, 0) + (index + 1) * 1000 + (index % 2 === 0 ? 999 : 1),
      speedKmh: 2,
      distanceMeters: (index + 1) * 0.556,
      steps: index + 1,
    }))
    const session: SessionValues = {
      startedAt: at(10, 0),
      endedAt: samples.at(-1)!.at,
      durationSeconds: 60,
      distanceMeters: 33.4,
      steps: 60,
      maxSpeedKmh: 2,
    }
    const [records] = buildWalkingTimeline([{session, samples}])
    expect(records.every((record) => record.at % 1000 === 0)).toBe(true)
  })

  it("keeps every run at its real length, with a single interval read off at each speed change", () => {
    const speedsKmh = [2, 2.5, 3, 3.5, 4, 2, 6, 1.5]
    const runSeconds = [300, 4, 10, 120, 61, 2, 200, 99]
    const runs: SpeedRun[] = speedsKmh.map((speedKmh, run) => ({
      metersPerSecond: speedKmh / 3.6,
      cadence: 29,
      seconds: runSeconds[run],
    }))
    const appDistanceMeters = runs.reduce(
      (total, run) => total + run.metersPerSecond * run.seconds,
      0
    )
    const start = at(10, 0)

    const written = writeExactRuns(
      runs,
      {at: start, distanceMeters: 0},
      appDistanceMeters
    )
    const changeTimes = runSeconds
      .slice(0, -1)
      .map(
        (_, run) =>
          start +
          runSeconds
            .slice(0, run + 1)
            .reduce((total, seconds) => total + seconds, 0) *
            1000
      )
    expect(
      changeTimes.every((changeAt) =>
        written.some((record) => record.at === changeAt)
      )
    ).toBe(true)

    const offIntervals = written.slice(1).filter((record, index) => {
      const speedReadKmh =
        ((record.distanceMeters - written[index].distanceMeters) /
          ((record.at - written[index].at) / 1000)) *
        3.6
      const beltSpeedKmh =
        speedsKmh[changeTimes.filter((changeAt) => changeAt < record.at).length]
      return Math.abs(speedReadKmh - beltSpeedKmh) > 1e-6
    })
    expect(offIntervals.length).toBeLessThanOrEqual(changeTimes.length)
    expect(
      Math.abs(written.at(-1)!.distanceMeters - appDistanceMeters)
    ).toBeLessThanOrEqual(1.25)
  })

  it("ends as close as it can to the distance of the app while showing the same", () => {
    const run = (seconds: number): SpeedRun[] => [
      {metersPerSecond: 2 / 3.6, cadence: 29, seconds},
    ]
    const endOf = (appMeters: number) =>
      writeExactRuns(
        run(appMeters / (2 / 3.6)),
        {at: 0, distanceMeters: 0},
        appMeters
      ).at(-1)!
    expect(endOf(3000.3).distanceMeters).toBe(3000)
    expect(endOf(3002.6).distanceMeters).toBe(3005)
    expect(endOf(3009.9).distanceMeters).toBe(3005)
    expect(endOf(2996).distanceMeters).toBe(2995)
  })
})
