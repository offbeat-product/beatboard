export type Role = "AM" | "QM" | "PM" | "OH";

// 作業区分の【】内カテゴリ → 役職
export const CATEGORY_TO_ROLE: Record<string, Role> = {
  営業: "AM",
  企画: "QM",
  進行管理: "PM",
  共通: "OH",
  マネージャー: "OH",
  人事: "OH",
};

export const ROLE_META: Record<Role, { label: string; code: string; color: string; bg: string }> = {
  AM: { label: "営業", code: "AM", color: "#185FA5", bg: "#E6F1FB" },
  QM: { label: "企画", code: "QM", color: "#534AB7", bg: "#EEEDFE" },
  PM: { label: "進行管理", code: "PM", color: "#854F0B", bg: "#FAEEDA" },
  OH: { label: "その他", code: "OH", color: "#5F5E5A", bg: "#F1EFE8" },
};

// 予算按分は AM/QM/PM の3役職に均等(33.33%ずつ)、OH は予算0
export const BUDGET_ROLES: Role[] = ["AM", "QM", "PM"];

export function parseWorkCategory(s: string | null | undefined): { category: string; taskName: string } {
  if (!s) return { category: "その他", taskName: "未分類" };
  const m = s.match(/^【(.+?)】(.+)$/);
  if (m) return { category: m[1], taskName: m[2] };
  return { category: "その他", taskName: s };
}
