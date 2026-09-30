import { useState } from "react";
import { SparklesIcon } from "lucide-react";
import { useUpdateChecker } from "@/hooks/useUpdateChecker";
import { Button } from "@/components/ui/button";

/** 检测到前端有新版本时，在右上角弹出提示，点击后刷新页面。 */
export function UpdatePrompt() {
  const updateAvailable = useUpdateChecker();
  const [reloading, setReloading] = useState(false);

  if (!updateAvailable) return null;

  const reload = () => {
    setReloading(true);
    window.location.reload();
  };

  return (
    <div className="pointer-events-none fixed top-3 right-4 z-[100] flex justify-end">
      <div className="animate-toast-in pointer-events-auto flex w-64 flex-col gap-2.5 rounded-xl border border-border/60 bg-card/95 p-3 shadow-xl ring-1 ring-black/5 backdrop-blur-sm dark:ring-white/10">
        <div className="flex items-start gap-2.5">
          <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <SparklesIcon className="size-3.5" />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">发现新版本</span>
            <span className="text-xs text-muted-foreground">
              检测到前端页面有更新，点击更新以加载最新版本
            </span>
          </div>
        </div>
        <Button size="sm" onClick={reload} disabled={reloading} className="w-full">
          {reloading ? "更新中…" : "更新"}
        </Button>
      </div>
    </div>
  );
}
