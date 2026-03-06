import { CURRENT_MONTH } from "@/lib/fiscalYear";

interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  const [y, m] = CURRENT_MONTH.split("-");
  const label = `${y}年${Number(m)}月`;

  return (
    <div className="flex items-start justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap mt-1">
        {label}
      </span>
    </div>
  );
}
