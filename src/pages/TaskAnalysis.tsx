import { useState, useMemo } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PageHeader } from "@/components/PageHeader";
import { TaskAnalysisTab } from "@/components/TaskAnalysisTab";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentMonth } from "@/lib/fiscalYear";

function buildMonthOptions(monthsBack = 36): string[] {
  const cur = getCurrentMonth();
  const [cy, cm] = cur.split("-").map(Number);
  const result: string[] = [];
  for (let i = -monthsBack; i <= 0; i++) {
    const date = new Date(cy, cm - 1 + i, 1);
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    result.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return result.reverse();
}

const labelOf = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
};

const TaskAnalysis = () => {
  usePageTitle("業務分析");
  const [month, setMonth] = useState<string>(getCurrentMonth());
  const months = useMemo(() => [month], [month]);
  const options = useMemo(() => buildMonthOptions(36), []);

  return (
    <div className="space-y-6">
      <PageHeader title="業務分析" description="単月での業務内訳分析 - 低収益クライアントの原因深掘り" />

      <div className="bg-card rounded-lg shadow-sm p-3 flex items-center justify-end animate-fade-in">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">対象月:</span>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {options.map((o) => (
                <SelectItem key={o} value={o} className="text-xs">{labelOf(o)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TaskAnalysisTab months={months} />
    </div>
  );
};

export default TaskAnalysis;
