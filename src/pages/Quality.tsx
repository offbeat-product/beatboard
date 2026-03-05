import { usePageTitle } from "@/hooks/usePageTitle";

const Quality = () => {
  usePageTitle("品質指標");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">品質指標</h2>
        <p className="text-sm text-muted-foreground mt-1">QM/PM向け - 制作品質・納期遵守</p>
      </div>
      <div className="bg-card rounded-lg shadow-sm p-8 text-center text-muted-foreground">
        <p>品質指標ページは次のステップで実装されます。</p>
      </div>
    </div>
  );
};

export default Quality;
