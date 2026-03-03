import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <p className="text-sm text-muted-foreground">データの取得に失敗しました。再読み込みしてください。</p>
      <Button variant="outline" onClick={onRetry}>再読み込み</Button>
    </div>
  );
}
