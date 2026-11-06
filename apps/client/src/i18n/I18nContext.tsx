import { createContext, type ReactNode, useContext, useMemo } from "react";
import { makeTranslate, type Translate } from "./format.js";

const I18nContext = createContext<Translate>(makeTranslate());

export function I18nProvider({ locale, children }: { locale?: string; children: ReactNode }) {
  const t = useMemo(() => makeTranslate(locale), [locale]);
  return <I18nContext.Provider value={t}>{children}</I18nContext.Provider>;
}

/** Returns the message formatter for the current locale. */
export function useT(): Translate {
  return useContext(I18nContext);
}
