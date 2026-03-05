import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";

type CurrencyUnit = "thousand" | "yen";

interface CurrencyUnitCtx {
  unit: CurrencyUnit;
  toggle: () => void;
  /** Format a yen amount for display */
  formatAmount: (yen: number) => string;
  /** Unit suffix for chart axes */
  unitSuffix: string;
  /** Convert yen to display value (for chart data) */
  toDisplayValue: (yen: number) => number;
}

const CurrencyUnitContext = createContext<CurrencyUnitCtx | null>(null);

const STORAGE_KEY = "beatboard_currency_unit";

export function CurrencyUnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnit] = useState<CurrencyUnit>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as CurrencyUnit) || "yen";
    } catch {
      return "thousand";
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, unit);
  }, [unit]);

  const toggle = useCallback(() => {
    setUnit((prev) => (prev === "thousand" ? "yen" : "thousand"));
  }, []);

  const formatAmount = useCallback(
    (yen: number) => {
      if (unit === "thousand") {
        return `${Math.round(yen / 1000).toLocaleString()}千円`;
      }
      return `¥${Math.round(yen).toLocaleString()}`;
    },
    [unit]
  );

  const toDisplayValue = useCallback(
    (yen: number) => (unit === "thousand" ? Math.round(yen / 1000) : Math.round(yen)),
    [unit]
  );

  const unitSuffix = unit === "thousand" ? "千円" : "円";

  return (
    <CurrencyUnitContext.Provider value={{ unit, toggle, formatAmount, unitSuffix, toDisplayValue }}>
      {children}
    </CurrencyUnitContext.Provider>
  );
}

export function useCurrencyUnit() {
  const ctx = useContext(CurrencyUnitContext);
  if (!ctx) throw new Error("useCurrencyUnit must be inside CurrencyUnitProvider");
  return ctx;
}
