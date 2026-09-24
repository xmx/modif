// RFC 9457 (Problem Details for HTTP APIs) 统一错误解析与请求封装。

import { getToken, expireAuth } from "@/lib/auth";

/** 后端响应 application/problem+json 时返回的 Problem Details 结构。 */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
}

/**
 * 统一错误类型：把非 2xx 响应解析为可读的结构化错误。
 * 供 UI 层（toast / 错误文案）直接使用。
 */
export class ProblemDetailError extends Error {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance: string;

  constructor(problem: ProblemDetail) {
    const title = problem.title?.trim() || "请求失败";
    const detail = problem.detail?.trim() || "";
    super(detail ? `${title}：${detail}` : title);
    this.name = "ProblemDetailError";
    this.type = problem.type || "about:blank";
    this.title = title;
    this.status = problem.status ?? 0;
    this.detail = detail;
    this.instance = problem.instance || "";
  }
}

/** 从响应体中解析 Problem Details。解析失败时退化为基于状态码的通用错误。 */
export async function readProblemDetail(resp: Response): Promise<ProblemDetailError> {
  try {
    const data: unknown = await resp.json();
    if (data && typeof data === "object") {
      const p = data as Record<string, unknown>;
      return new ProblemDetailError({
        type: typeof p.type === "string" ? p.type : undefined,
        title: typeof p.title === "string" ? p.title : undefined,
        status: typeof p.status === "number" ? p.status : resp.status,
        detail:
          typeof p.detail === "string"
            ? p.detail
            : typeof p.message === "string"
              ? p.message
              : undefined,
        instance: typeof p.instance === "string" ? p.instance : undefined,
      });
    }
  } catch {
    // 非 JSON 响应体，走下方通用逻辑
  }
  return new ProblemDetailError({
    title: resp.statusText || undefined,
    status: resp.status,
  });
}

/** fetch 封装：非 2xx 时抛出 ProblemDetailError，2xx 时原样返回响应。 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const resp = await fetch(input, { ...init, headers });
  if (!resp.ok) {
    // token 无效 / 未登录：清除本地凭证并跳转登录页。
    if (resp.status === 401) expireAuth();
    throw await readProblemDetail(resp);
  }
  return resp;
}

/** 把任意异常规整为适合 toast 展示的 { title, detail? }。 */
export function problemMessage(err: unknown): { title: string; detail?: string } {
  if (err instanceof ProblemDetailError) {
    return { title: err.title, detail: err.detail || undefined };
  }
  const message = err instanceof Error ? err.message : String(err ?? "请求失败");
  if (!message || message === "Failed to fetch") {
    return { title: "网络请求失败", detail: "请检查网络连接或后端服务是否可用" };
  }
  return { title: message };
}