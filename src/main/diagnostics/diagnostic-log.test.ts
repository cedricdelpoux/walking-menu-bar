import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {afterEach, beforeEach, describe, expect, it} from "vitest"
import {DiagnosticLog, MAX_DIAGNOSTIC_LOG_BYTES} from "./diagnostic-log"

describe("DiagnosticLog", () => {
  let directory: string
  const fixedNow = () => new Date(2026, 9, 20, 10, 53, 45, 7)

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "walkingbar-diagnostics-"))
  })

  afterEach(() => rmSync(directory, {recursive: true, force: true}))

  it("appends timestamped lines, creating the folder if needed", () => {
    const filePath = join(directory, "logs", "diagnostics.log")
    const log = new DiagnosticLog(filePath, fixedNow)
    log.write("connection connected KS-BLC2")
    log.write("command stop reason=userRequest")
    expect(readFileSync(filePath, "utf8")).toBe(
      "2026-10-20 10:53:45.007 connection connected KS-BLC2\n2026-10-20 10:53:45.007 command stop reason=userRequest\n"
    )
  })

  it("keeps the previous file aside once it is full", () => {
    const filePath = join(directory, "diagnostics.log")
    writeFileSync(filePath, "x".repeat(MAX_DIAGNOSTIC_LOG_BYTES))
    new DiagnosticLog(filePath, fixedNow).write("after rotation")

    expect(existsSync(`${filePath}.1`)).toBe(true)
    expect(readFileSync(filePath, "utf8")).toBe(
      "2026-10-20 10:53:45.007 after rotation\n"
    )
  })

  it("never throws when the file cannot be written", () => {
    const fileInsteadOfFolder = join(directory, "not-a-folder")
    writeFileSync(fileInsteadOfFolder, "")
    expect(() =>
      new DiagnosticLog(join(fileInsteadOfFolder, "diagnostics.log")).write(
        "lost"
      )
    ).not.toThrow()
  })
})
