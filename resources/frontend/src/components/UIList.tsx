import { PaletteIcon, CheckIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebUIs } from "@/hooks/useWebUIs";

/** 界面切换（列表形式）：把可用界面逐个罗列，点击切换。 */
export function UIList() {
  const { entries, loaded, activeSlug, select } = useWebUIs();

  if (!loaded) {
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  }
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无可用界面</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
        <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
        <span>切换界面后浏览器会自动刷新以应用新界面，请留意未保存内容。</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {entries.map((e) => {
          const active = e.slug === activeSlug;
          return (
            <button
              key={e.slug}
              onClick={() => select(e.slug)}
              disabled={active}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors cursor-pointer disabled:cursor-default",
                active
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              )}
            >
              <PaletteIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{e.name}</span>
                <span className="block truncate font-mono text-[0.65rem] text-muted-foreground">
                  {e.slug}
                </span>
              </span>
              {active && <CheckIcon className="size-4 shrink-0 text-emerald-500" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}