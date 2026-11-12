import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en, fr, type MessageKey } from "./messages.ts";

export type Lang = "en" | "fr";
type Values = Record<string, string | number>;

export interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, values?: Values) => string;
  /** picks `<key>.one` or `<key>.other` from `n` */
  plural: (key: PluralKey, n: number) => string;
  /** a whole number with the thousands separator of the language */
  num: (value: number | string) => string;
  /** day and time of an ISO timestamp, short enough for a list row */
  when: (iso: string) => string;
}

type PluralKey = {
  [K in MessageKey]: K extends `${infer Base}.one` ? Base : never;
}[MessageKey];

const STORAGE_KEY = "truck-save-editor.lang";
const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, fr };
const LOCALE: Record<Lang, string> = { en: "en-US", fr: "fr-FR" };

function initialLang(): Lang {
  const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "fr") return stored;
  return globalThis.navigator?.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

const Context = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo<I18n>(() => {
    const t = (key: MessageKey, values: Values = {}) =>
      MESSAGES[lang][key].replace(/\{(\w+)\}/g, (whole, name: string) => String(values[name] ?? whole));
    const numbers = new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 0 });
    const dates = new Intl.DateTimeFormat(LOCALE[lang], {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      lang,
      setLang: (next) => {
        globalThis.localStorage?.setItem(STORAGE_KEY, next);
        setLangState(next);
      },
      t,
      plural: (key, n) => t(`${key}.${n === 1 ? "one" : "other"}` as MessageKey, { n }),
      num: (raw) => {
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? numbers.format(parsed) : String(raw);
      },
      when: (iso) => dates.format(new Date(iso)),
    };
  }, [lang]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(Context);
  if (!value) throw new Error("useI18n needs an I18nProvider above it");
  return value;
}
