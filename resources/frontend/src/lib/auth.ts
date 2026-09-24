import { useSyncExternalStore } from "react";
import { navigate } from "@/lib/router";

// 访问令牌（后端启动时生成的 uuid）保存在 localStorage，跨刷新保持登录态。
const TOKEN_KEY = "modif.auth.token";

function readStored(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function store(next: string) {
  try {
    if (next) localStorage.setItem(TOKEN_KEY, next);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 忽略存储失败，token 退化为仅保存在内存中
  }
}

let current = readStored();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** 返回当前 token（空字符串表示未登录）。 */
export function getToken(): string {
  return current;
}

/** 登录成功后保存 token。 */
export function saveToken(token: string) {
  current = token.trim();
  store(current);
  emit();
}

/** 清除 token 并跳转到登录页（接口返回 401 时调用）。 */
export function expireAuth() {
  current = "";
  store("");
  emit();
  navigate("/login");
}

/** 订阅当前 token，登录 / 登出时驱动 React 重新渲染。 */
export function useAuthToken(): string {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current
  );
}