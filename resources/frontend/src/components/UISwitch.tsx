import { useEffect, useState } from "react";
import { PaletteIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface WebUIEntry {
  path: string;
  slug: string;
  name: string;
  spa: boolean;
}

type WebUIResponse = Record<string, WebUIEntry[]>;

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

/** 界面切换器：读取后端 /api/webuis，切换后写入 ui cookie 并刷新页面。 */
export function UISwitch() {
  const [entries, setEntries] = useState<WebUIEntry[]>([]);
  const cookieSlug = readCookie("ui");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/route/webui")
      .then((r) => (r.ok ? (r.json() as Promise<WebUIResponse>) : null))
      .then((data) => {
        if (cancelled || !data) return;
        const flat: WebUIEntry[] = [];
        const seen = new Set<string>();
        for (const list of Object.values(data)) {
          if (!Array.isArray(list)) continue;
          for (const e of list) {
            if (!e || typeof e.slug !== "string" || seen.has(e.slug)) continue;
            seen.add(e.slug);
            flat.push(e);
          }
        }
        setEntries(flat);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (entries.length === 0) return null;

  const activeSlug = cookieSlug || entries[0]?.slug || null;

  const select = (slug: string) => {
    document.cookie = `ui=${encodeURIComponent(slug)}; path=/; max-age=31536000`;
    location.reload();
  };

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
              {active && <CheckIcon className="ml-auto size-4" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}