import de from "./de"
import en, {type Dictionary} from "./en"
import es from "./es"
import fr from "./fr"
import it from "./it"
import nl from "./nl"

export const dictionaries = {en, fr, es, it, de, nl} satisfies Record<
  string,
  Dictionary
>

export type Locale = keyof typeof dictionaries

export const LOCALES = Object.keys(dictionaries) as Locale[]

export type LanguagePreference = "system" | Locale

type Leaf = string | ((params: never) => string)

export type TranslationKey<Node = Dictionary, Prefix extends string = ""> = {
  [Key in keyof Node & string]: Node[Key] extends Leaf
    ? `${Prefix}${Key}`
    : TranslationKey<Node[Key], `${Prefix}${Key}.`>
}[keyof Node & string]

type ValueAt<
  Path extends string,
  Node = Dictionary,
> = Path extends `${infer Head}.${infer Rest}`
  ? Head extends keyof Node
    ? ValueAt<Rest, Node[Head]>
    : never
  : Path extends keyof Node
    ? Node[Path]
    : never

type ParamsOf<Key extends TranslationKey> =
  ValueAt<Key> extends (params: infer Params) => string ? [Params] : []

export type Translate = <Key extends TranslationKey>(
  key: Key,
  ...params: ParamsOf<Key>
) => string

function lookup(dictionary: Dictionary, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      dictionary
    )
}

export function createTranslator(locale: Locale): Translate {
  const dictionary = dictionaries[locale] ?? en
  return (key, ...params) => {
    const value = lookup(dictionary, key) ?? lookup(en, key)
    if (typeof value === "function")
      return (value as (params: unknown) => string)(params[0])
    return typeof value === "string" ? value : key
  }
}

export function resolveLocale(
  preference: LanguagePreference,
  preferredSystemLanguages: readonly string[]
): Locale {
  if (preference !== "system") return preference
  for (const language of preferredSystemLanguages) {
    const base = language.toLowerCase().split(/[-_]/)[0]
    if (LOCALES.includes(base as Locale)) return base as Locale
  }
  return "en"
}
