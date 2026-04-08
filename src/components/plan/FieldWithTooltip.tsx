import { Label } from "@/components/ui/label";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FieldWithTooltipProps {
  label: string;
  tooltip?: string;
  required?: boolean;
  autoCalc?: boolean;
  children: React.ReactNode;
}

export function FieldWithTooltip({ label, tooltip, required, autoCalc, children }: FieldWithTooltipProps) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <Label className="text-xs">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {autoCalc && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-normal">自動計算</Badge>
        )}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}
