import { useEffect, useState } from "react";

/** FNV-1a 32 位哈希；附带长度一起比较，足够感知入口页面内容变化。 */
function hashString(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(16)}:${str.length}`;
}

// 基准哈希存在 sessionStorage：同标签页刷新后仍可对比，从而在首次打开时就能发现更新。
const HASH_KEY = "modif.update.hash";

function readStoredHash(): string | null {
  try {
    return sessionStorage.getItem(HASH_KEY);
  } catch {
    return null;
  }
}

function storeHash(hash: string) {
  try {
    sessionStorage.setItem(HASH_KEY, hash);
  } catch {
    // 忽略：隐私模式等场景下无法写入。
  }
}

/**
 * 定时拉取入口页面（BASE_URL），对比响应内容哈希。
 * 首次打开即对比上一次记录的哈希（sessionStorage），发现变化则提示更新。
 */
export function useUpdateChecker(intervalMs = 60_000): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let stopped = false;

    const check = async () => {
      try {
        // no-store + 时间戳参数，尽量绕开浏览器与网关缓存。
        const resp = await fetch(`${import.meta.env.BASE_URL}?_=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (stopped || !resp.ok) return;

        const hash = hashString(await resp.text());
        const previous = readStoredHash();
        storeHash(hash);

        if (previous && previous !== hash) {
          setUpdateAvailable(true);
        }
      } catch {
        // 网络异常忽略，等待下一次轮询。
      }
    };

    void check();
    const id = window.setInterval(() => {
      if (!stopped) void check();
    }, intervalMs);

    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return updateAvailable;
}
