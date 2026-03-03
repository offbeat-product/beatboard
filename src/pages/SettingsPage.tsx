import { Settings } from "lucide-react";

const SettingsPage = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold tracking-tight">設定</h2>
      <p className="text-muted-foreground text-sm mt-1">アプリケーション設定</p>
    </div>

    <div className="bg-card rounded-lg shadow-sm p-6 max-w-lg">
      <h3 className="font-semibold text-sm mb-4">プロフィール</h3>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">表示名</label>
          <input
            type="text"
            defaultValue="管理者"
            className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">メールアドレス</label>
          <input
            type="email"
            defaultValue="admin@example.com"
            className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
            disabled
          />
        </div>
      </div>
      <button className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-sm text-sm font-medium hover:opacity-90 transition-opacity">
        保存
      </button>
    </div>
  </div>
);

export default SettingsPage;
