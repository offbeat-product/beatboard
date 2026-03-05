import { usePageTitle } from "@/hooks/usePageTitle";

const Productivity = () => {
  usePageTitle("生産性指標");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">生産性指標</h2>
        <p className="text-sm text-muted-foreground mt-1">局長向け - 工数あたりの収益性・リソース効率</p>
      </div>
      <div className="bg-card rounded-lg shadow-sm p-8 text-center text-muted-foreground">
        <p>生産性指標ページは次のステップで実装されます。</p>
      </div>
    </div>
  );
};

export default Productivity;
