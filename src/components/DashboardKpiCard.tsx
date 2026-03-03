import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface DashboardKpiCardProps {
  label: string;
  value: string;
  target?: string;
  progress?: number;
  change?: { text: string; direction: "up" | "down"; positive: boolean };
  subtext?: string;
  delay?: number;
}

export function DashboardKpiCard({
  label,
  value,
  target,
  progress,
  change,
  subtext,
  delay = 0,
}: DashboardKpiCardProps) {
  return (
    <div
      className="bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow p-5 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono-num tracking-tight">{value}</span>
        {target && <span className="text-xs text-muted-foreground">/ {target}</span>}
      </div>

      {progress !== undefined && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">達成率</span>
            <span className="text-xs font-medium font-mono-num">{progress.toFixed(1)}%</span>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-2" />
        </div>
      )}

      <div className="mt-2 flex items-center gap-3">
        {change && (
          <span className={cn(
            "text-xs font-medium flex items-center gap-0.5",
            change.positive ? "text-chart-green" : "text-chart-red"
          )}>
            {change.direction === "up" ? "▲" : "▼"} {change.text}
          </span>
        )}
        {subtext && (
          <span className="text-xs text-muted-foreground">{subtext}</span>
        )}
      </div>
    </div>
  );
}
