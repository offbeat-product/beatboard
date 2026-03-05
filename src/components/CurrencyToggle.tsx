import { useCurrencyUnit } from "@/hooks/useCurrencyUnit";

export function CurrencyToggle() {
  const { unit, toggle } = useCurrencyUnit();

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center rounded-md border border-border text-xs font-medium overflow-hidden"
    >
      <span
        className={`px-2 py-1 transition-colors ${
          unit === "thousand" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-secondary"
        }`}
      >
        千円
      </span>
      <span
        className={`px-2 py-1 transition-colors ${
          unit === "yen" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-secondary"
        }`}
      >
        円
      </span>
    </button>
  );
}
