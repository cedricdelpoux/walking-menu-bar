import {describe, expect, it} from "vitest"
import {formatClock, formatDuration, formatKilometers} from "../format"
import en from "./en"
import {
  createTranslator,
  dictionaries,
  resolveLocale,
  type TranslationKey,
} from "./index"

function leafKeys(node: object, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === "object"
      ? leafKeys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  )
}

describe("translations", () => {
  it("has the same keys in every language", () => {
    for (const dictionary of Object.values(dictionaries)) {
      expect(leafKeys(dictionary)).toEqual(leafKeys(en))
    }
  })

  it("translates plain and parameterized keys", () => {
    const t = createTranslator("fr")
    expect(t("history.title")).toBe("Historique")
    expect(t("connection.connected", {name: "KS-BLC2"})).toBe(
      "Connecté à KS-BLC2"
    )
    expect(t("controls.plateau", {speed: "3 km/h", time: "1:12"})).toBe(
      "Palier 3 km/h · 1:12"
    )
  })

  it("falls back to the key when it does not exist", () => {
    expect(createTranslator("en")("missing.key" as TranslationKey)).toBe(
      "missing.key"
    )
  })
})

describe("resolveLocale", () => {
  it("follows the first supported system language", () => {
    expect(resolveLocale("system", ["fr-FR", "en-US"])).toBe("fr")
    expect(resolveLocale("system", ["ja-JP", "fr-CA"])).toBe("fr")
    expect(resolveLocale("system", ["ja-JP"])).toBe("en")
  })

  it("lets an explicit choice win", () => {
    expect(resolveLocale("en", ["fr-FR"])).toBe("en")
  })
})

describe("format", () => {
  it("formats distances with the locale decimal separator", () => {
    expect(formatKilometers(2400, "fr", 1)).toBe("2,4 km")
    expect(formatKilometers(2400, "en", 1)).toBe("2.4 km")
  })

  it("truncates distances like Strava does", () => {
    expect(formatKilometers(3816.1, "fr")).toBe("3,81 km")
    expect(formatKilometers(3000.4, "fr")).toBe("3,00 km")
    expect(formatKilometers(2999.9, "fr")).toBe("2,99 km")
    expect(formatKilometers(2400, "fr")).toBe("2,40 km")
  })

  it("formats durations and clocks", () => {
    expect(formatDuration(45)).toBe("45 s")
    expect(formatDuration(32 * 60 + 10)).toBe("32 min")
    expect(formatDuration(3900)).toBe("1 h 05")
    expect(formatClock(156)).toBe("2:36")
    expect(formatClock(3725)).toBe("1:02:05")
  })
})
