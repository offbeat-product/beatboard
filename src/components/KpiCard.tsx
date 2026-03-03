import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  delay?: number;
}

export function KpiCard({ title, value, change, changeType = "neutral", icon: Icon, delay = 0 }: KpiCardProps) {
  return (
    <div
      className="bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow p-5 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className="h-9 w-9 rounded-sm bg-accent flex items-center justify-center">
          <Icon className="h-[18px] w-[18px] text-accent-foreground" />
        </div>
      </div>
      <p className="text-2xl font-bold font-mono-num tracking-tight">{value}</p>
      {change && (
        <p className={cn(
          "text-xs mt-1 font-medium",
          changeType === "positive" && "text-chart-green",
          changeType === "negative" && "text-chart-red",
          changeType === "neutral" && "text-muted-foreground"
        )}>
          {change}
        </p>
      )}
    </div>
  );
}
