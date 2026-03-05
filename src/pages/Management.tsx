import { usePageTitle } from "@/hooks/usePageTitle";

const Management = () => {
  usePageTitle("経営指標");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">経営指標</h2>
        <p className="text-sm text-muted-foreground mt-1">CEO向け - 売上成長・利益構造・財務健全性</p>
      </div>
      <div className="bg-card rounded-lg shadow-sm p-8 text-center text-muted-foreground">
        <p>経営指標ページは次のステップで実装されます。</p>
      </div>
    </div>
  );
};

export default Management;
