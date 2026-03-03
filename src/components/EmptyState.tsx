import { Inbox } from "lucide-react";

export function EmptyState({ message = "データがまだありません" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <Inbox className="h-12 w-12 stroke-[1.2]" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
