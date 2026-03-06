import { CURRENT_MONTH } from "@/lib/fiscalYear";

interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  const [y, m] = CURRENT_MONTH.split("-");
  const label = `${y}年${Number(m)}月`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
        {description && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <span className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}
