import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getCurrentMonth, getFiscalEndYear, getFiscalYearMonths } from "@/lib/fiscalYear";

export interface MonthRangePickerProps {
  startYm: string;
  endYm: string;
  onChange: (startYm: string, endYm: string) => void;
  /** Number of months back from current month to show in dropdowns. Default 36. */
  monthsBack?: number;
}

/** Generate a list of YYYY-MM strings from `monthsBack` months ago up to `monthsForward` months ahead of currentMonth. */
function buildOptions(monthsBack: number, monthsForward: number): string[] {
  const cur = getCurrentMonth();
  const [cy, cm] = cur.split("-").map(Number);
  const result: string[] = [];
  for (let i = -monthsBack; i <= monthsForward; i++) {
    const date = new Date(cy, cm - 1 + i, 1);
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    result.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return result;
}

const labelOf = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
};

export function MonthRangePicker({ startYm, endYm, onChange, monthsBack = 36 }: MonthRangePickerProps) {
  const cur = getCurrentMonth();
  const options = buildOptions(monthsBack, 12);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">期間:</span>
      <Select value={startYm} onValueChange={(v) => onChange(v, v > endYm ? v : endYm)}>
        <SelectTrigger className="h-8 w-[120px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {options.map((o) => (
            <SelectItem key={o} value={o} className="text-xs">{labelOf(o)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">〜</span>
      <Select value={endYm} onValueChange={(v) => onChange(v < startYm ? v : startYm, v < startYm ? startYm : v)}>
        <SelectTrigger className="h-8 w-[120px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {options.map((o) => (
            <SelectItem key={o} value={o} className="text-xs">{labelOf(o)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Build months array between startYm and endYm inclusive (both YYYY-MM). */
export function monthsInRange(startYm: string, endYm: string): string[] {
  const [sy, sm] = startYm.split("-").map(Number);
  const [ey, em] = endYm.split("-").map(Number);
  const result: string[] = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}
