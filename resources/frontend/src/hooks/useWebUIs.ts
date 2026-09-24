import { useEffect, useState } from "react";
import { apiFetch, problemMessage } from "@/lib/problem";
import { useToast } from "@/components/ui/toast";

export interface WebUIEntry {
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

/** 读取后端 /api/route/webui 返回的界面列表，并提供选中与切换。 */
export function useWebUIs() {
  const [entries, setEntries] = useState<WebUIEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/route/webui")
      .then((r) => r.json() as Promise<WebUIResponse>)
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
      .catch((e) => {
        if (!cancelled) toast({ ...problemMessage(e), variant: "error" });
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const activeSlug = readCookie("ui") || entries[0]?.slug || null;

  const select = (slug: string) => {
    document.cookie = `ui=${encodeURIComponent(slug)}; path=/; max-age=31536000`;
    location.reload();
  };

  return { entries, loaded, activeSlug, select };
}