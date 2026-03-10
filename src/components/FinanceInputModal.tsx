import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ORG_ID } from "@/lib/fiscalYear";
import { toast } from "sonner";
import { getMonthLabel } from "@/lib/fiscalYear";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fiscalMonths: string[];
  onSaved: () => void;
}

const fields = [
  { key: "cash_and_deposits", label: "現預金残高" },
  { key: "accounts_receivable", label: "売掛金残高" },
  { key: "accounts_payable", label: "買掛金残高" },
  { key: "borrowings", label: "借入金残高" },
  { key: "interest_expense", label: "支払利息" },
  { key: "income_amount", label: "入金額" },
  { key: "expense_amount", label: "出金額" },
] as const;

export function FinanceInputModal({ open, onOpenChange, fiscalMonths, onSaved }: Props) {
  const [yearMonth, setYearMonth] = useState(fiscalMonths[fiscalMonths.length - 1] ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!yearMonth) return;
    setSaving(true);
    try {
      const row: Record<string, any> = {
        org_id: ORG_ID,
        year_month: yearMonth,
        updated_at: new Date().toISOString(),
      };
      fields.forEach((f) => {
        const v = values[f.key];
        row[f.key] = v ? Number(v) : 0;
      });

      const { error } = await supabase
        .from("finance_monthly")
        .upsert(row as any, { onConflict: "org_id,year_month" });

      if (error) throw error;
      toast.success("保存しました");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("保存に失敗しました: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>財務データ入力</DialogTitle>
          <DialogDescription>月次の財務データを入力してください。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>年月</Label>
            <Select value={yearMonth} onValueChange={setYearMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fiscalMonths.map((ym) => (
                  <SelectItem key={ym} value={ym}>{ym} ({getMonthLabel(ym)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {fields.map((f) => (
            <div key={f.key}>
              <Label>{f.label}（円）</Label>
              <Input
                type="number"
                placeholder="0"
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter className="flex-col gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            ※将来的にfreee試算表B/Sから自動取得に切り替え予定
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
