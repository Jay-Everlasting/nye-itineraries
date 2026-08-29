'use client';

import { createContext, useContext } from 'react';

export type CurrencyCode = 'EUR' | 'AUD';

export type Currency = {
  code: CurrencyCode;
  symbol: string;
  rate: number;
  /** Format an amount held in EUR into the active currency. */
  fmt: (eur: number) => string;
};

export function makeCurrency(code: CurrencyCode, audRate: number): Currency {
  const rate = code === 'AUD' ? audRate : 1;
  const symbol = code === 'AUD' ? 'A$' : '€';
  return {
    code,
    symbol,
    rate,
    fmt: (eur: number) => symbol + Math.round((eur || 0) * rate).toLocaleString('en-US'),
  };
}

export const CurrencyContext = createContext<Currency>(makeCurrency('EUR', 1.63));

export function useCurrency() {
  return useContext(CurrencyContext);
}

/** Inline money span, matching the legacy `.money` styling. */
export function Money({ eur }: { eur: number | null | undefined }) {
  const cur = useCurrency();
  return <span className="money">{cur.fmt(Number(eur || 0))}</span>;
}
