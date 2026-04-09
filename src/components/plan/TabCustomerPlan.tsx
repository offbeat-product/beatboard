import { ClientRevenuePlan } from "./ClientRevenuePlan";
import { PlanSettings } from "./PlanTypes";

interface Props {
  months: string[];
  settings: PlanSettings;
  update: (field: keyof PlanSettings, value: any) => void;
  fiscalYear: string;
}

export function TabCustomerPlan({ months, settings, update, fiscalYear }: Props) {
  return (
    <div className="space-y-8">
      <ClientRevenuePlan months={months} settings={settings} update={update} fiscalYear={fiscalYear} />
    </div>
  );
}
