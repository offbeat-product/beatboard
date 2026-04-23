/**
 * BeatBoard 月次統合レポート pptx 生成
 * 型定義とブランドカラー
 */

// ========== 型定義 ==========

export interface MonthlyReportData {
  meta: {
    year_month: string;
    generated_at: string;
    organization_name: string;
  };
  headline: {
    title: string;
    subtitle: string;
  };
  goal: {
    pillars: Array<{
      label: string;
      title: string;
      metric: string;
      description: string;
    }>;
    kpis: Array<{
      category: string;
      items: Array<{
        name: string;
        target: string;
        note: string;
      }>;
    }>;
  };
  current: {
    pillars: Array<{
      label: string;
      title: string;
      target_key: string;
      target_value: string;
      actual_value: string;
      unit: string;
      status: "success" | "warning" | "danger";
      status_text: string;
      note: string;
    }>;
    kpis: Array<{
      category: string;
      items: Array<{
        name: string;
        target: string;
        actual: string;
        rate: string;
        status: "success" | "warning" | "danger";
      }>;
    }>;
  };
  gap: {
    pillars: Array<{
      label: string;
      title: string;
      target: string;
      actual: string;
      gap: string;
      gap_unit: string;
      progress_rate: number;
      status: "success" | "warning" | "danger";
      note: string;
    }>;
    kpis: Array<{
      category: string;
      items: Array<{
        name: string;
        target: string;
        actual: string;
        gap: string;
        rate: number;
        status: "success" | "warning" | "danger";
      }>;
    }>;
  };
  issue: {
    root_causes: Array<{
      rank: string;
      priority: string;
      title: string;
      description: string;
      impact: string[];
    }>;
    kpi_issues: Array<{
      category: string;
      issues: string[];
    }>;
  };
  policy: {
    headline_title: string;
    headline_subtitle: string;
    yes_items: string[];
    no_items: string[];
  };
  solution: {
    headline_title: string;
    headline_subtitle: string;
    items: Array<{
      title: string;
      detail: string;
    }>;
  };
  next_action: {
    headline_title: string;
    headline_subtitle: string;
    top_priority: {
      title: string;
      owner: string;
      deadline: string;
      impact: string;
    };
    timeline: Array<{
      when: string;
      what: string;
    }>;
  };
}

// ========== ブランドカラー ==========

export const BRAND_COLORS = {
  text: "0A0E1A",
  primary: "2F7DFF",
  hover: "1F5FE0",
  gradEnd: "1E4FD1",
  gradAccent: "5FC8F0",
  bg: "FFFFFF",
  gray: "9CA3AF",
  dark: "1F2937",
  lightBg: "F5F8FF",
  lighterBg: "EEF4FF",
  border: "E5E7EB",
} as const;

export function getStatusColor(status: "success" | "warning" | "danger"): string {
  if (status === "success") return BRAND_COLORS.primary;
  if (status === "warning") return BRAND_COLORS.gray;
  if (status === "danger") return BRAND_COLORS.text;
  return BRAND_COLORS.gray;
}
