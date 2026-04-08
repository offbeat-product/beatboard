import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  description?: string;
  className?: string;
}

export function SectionHeading({ title, description, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex items-start gap-3 mb-4", className)}>
      <div className="w-1 self-stretch rounded-full bg-primary shrink-0" />
      <div>
        <h3 className="text-base font-bold tracking-tight">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}
