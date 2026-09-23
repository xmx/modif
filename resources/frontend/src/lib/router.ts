import { useSyncExternalStore } from "react";

let currentPath = window.location.pathname;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

window.addEventListener("popstate", () => {
  currentPath = window.location.pathname;
  emit();
});

/** 客户端路径跳转（不刷新页面，SPA）。 */
export function navigate(to: string) {
  if (to === currentPath) return;
  window.history.pushState({}, "", to);
  currentPath = window.location.pathname;
  emit();
}

/** 订阅当前 pathname，路径变化时重新渲染。 */
export function usePathname(): string {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentPath,
    () => currentPath
  );
}