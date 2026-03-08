interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
      {description && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{description}</p>}
    </div>
  );
}
