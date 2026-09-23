import { PaletteIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useWebUIs } from "@/hooks/useWebUIs";

/** 界面切换器（下拉按钮）：读取后端 /api/route/webui，切换后写入 ui cookie 并刷新。 */
export function UISwitch() {
  const { entries, activeSlug, select } = useWebUIs();

  if (entries.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" title="切换界面" />}
      >
        <PaletteIcon className="size-[1.2rem]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {entries.map((e) => {
          const active = e.slug === activeSlug;
          return (
            <DropdownMenuItem key={e.slug} onClick={() => select(e.slug)}>
              <span className={active ? "font-medium" : undefined}>{e.name}</span>
              {active && <CheckIcon className="ml-auto size-4 text-emerald-500" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}