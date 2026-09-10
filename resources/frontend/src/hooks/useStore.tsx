import { useCallback, useEffect, useReducer, useRef, useState } from "react";

// ── Types ───────────────────────────────────────────────────────

interface JsonRpcMessage {
  jsonrpc: "2.0";
  method?: string;
  params?: unknown;
  meta?: { session_id: string; request_id: string; user_agent: string };
}

export interface ToolCallData {
  id: string;
  name: string;
  arguments: string;
}

interface ToolCallDelta {
  index?: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

export interface RequestData {
  requestId: string;
  userMessage: string | null;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
  error: { code: string; message: string } | null;
  done: boolean;
  timestamp: number;
  text: string;
  thinking: string;
  toolCalls: ToolCallData[];
}

export interface SessionData {
  sessionId: string;
  userAgent: string;
  requests: RequestData[];
  createdAt: number;
  lastActivity: number;
}

// ── Reducer state ───────────────────────────────────────────────

interface State {
  sessions: SessionData[];
}

type Action =
  | { type: "new"; sid: string; userAgent: string; req: RequestData }
  | { type: "chunk"; rid: string; delta: string; thinking: string; toolCalls: ToolCallData[]; usage: RequestData["usage"] }
  | { type: "usage"; rid: string; usage: RequestData["usage"] }
  | { type: "done"; rid: string }
  | { type: "error"; rid: string; error: RequestData["error"] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "new": {
      const idx = state.sessions.findIndex((s) => s.sessionId === action.sid);
      let sessions: SessionData[];
      if (idx >= 0) {
        const session = state.sessions[idx];
        if (session.requests.some((r) => r.requestId === action.req.requestId)) return state;
        sessions = state.sessions.slice();
        sessions[idx] = { ...session, requests: [...session.requests, action.req], lastActivity: Date.now() };
      } else {
        sessions = [
          ...state.sessions,
          { sessionId: action.sid, userAgent: action.userAgent, requests: [action.req], createdAt: Date.now(), lastActivity: Date.now() },
        ];
      }
      return { sessions };
    }

    // 工具调用增量：不同 index 的 tool_calls 可能是同一次调用的分段，需要合并
    function mergeToolCalls(prev: ToolCallData[], deltas: ToolCallDelta[]): ToolCallData[] {
      const next = prev.map((t) => ({ ...t, arguments: t.arguments }));
      for (const d of deltas) {
        const idx = d.index ?? 0;
        if (!next[idx]) {
          next[idx] = { id: d.id ?? "", name: d.function?.name ?? "", arguments: d.function?.arguments ?? "" };
        } else {
          const cur = next[idx];
          if (d.id) cur.id = d.id;
          if (d.function?.name) cur.name += d.function.name;
          if (d.function?.arguments) cur.arguments += d.function.arguments;
        }
      }
      return next;
    }

    case "chunk": {
      // Only update if the request exists and text is unchanged reference-wise by copying
      let changed = false;
      const sessions = state.sessions.map((s) => {
        const ri = s.requests.findIndex((r) => r.requestId === action.rid);
        if (ri === -1) return s;
        const req = s.requests[ri];
        const requests = s.requests.slice();
        requests[ri] = {
          ...req,
          text: req.text + action.delta,
          thinking: req.thinking + action.thinking,
          toolCalls: action.toolCalls.length > 0 ? mergeToolCalls(req.toolCalls, action.toolCalls) : req.toolCalls,
          usage: action.usage ?? req.usage,
        };
        changed = true;
        return { ...s, requests };
      });
      return changed ? { sessions } : state;
    }

    case "done": {
      const sessions = state.sessions.map((s) => {
        const ri = s.requests.findIndex((r) => r.requestId === action.rid);
        if (ri === -1) return s;
        const requests = s.requests.slice();
        requests[ri] = { ...s.requests[ri], done: true };
        return { ...s, requests };
      });
      return { sessions };
    }

    case "usage": {
      let changed = false;
      const sessions = state.sessions.map((s) => {
        const ri = s.requests.findIndex((r) => r.requestId === action.rid);
        if (ri === -1) return s;
        const requests = s.requests.slice();
        requests[ri] = { ...s.requests[ri], usage: action.usage };
        changed = true;
        return { ...s, requests };
      });
      return changed ? { sessions } : state;
    }

    case "error": {
      const sessions = state.sessions.map((s) => {
        const ri = s.requests.findIndex((r) => r.requestId === action.rid);
        if (ri === -1) return s;
        const requests = s.requests.slice();
        requests[ri] = { ...s.requests[ri], done: true, error: action.error };
        return { ...s, requests };
      });
      return { sessions };
    }

    default:
      return state;
  }
}

// ── Throttled dispatch (RAF batch) ──────────────────────────────

export function useStore() {
  const [state, dispatch] = useReducer(reducer, { sessions: [] });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [manualOff, setManualOff] = useState(false);
  const reconnectTrigger = useRef(0);

  // Pending chunk deltas batched per RAF frame
  const pendingChunks = useRef<Map<string, { delta: string; thinking: string; toolCalls: ToolCallData[]; usage: RequestData["usage"] }>>(new Map());
  const rafPending = useRef(false);

  const flushChunks = useCallback(() => {
    rafPending.current = false;
    const pending = pendingChunks.current;
    if (pending.size === 0) return;
    const entries = Array.from(pending.entries());
    pending.clear();
    for (const [rid, v] of entries) {
      dispatch({ type: "chunk", rid, delta: v.delta, thinking: v.thinking, toolCalls: v.toolCalls, usage: v.usage });
    }
  }, []);

  const handleMessage = useCallback((msg: JsonRpcMessage) => {
    const meta = msg.meta;
    if (!meta?.session_id || !meta?.request_id || !msg.method) return;
    const { session_id: sid, request_id: rid } = meta;

    switch (msg.method) {
      case "modif/chat-completion-new": {
        const params = msg.params as { messages?: Array<{ role: string; content: string }>; model?: string } | null;
        let userMessage: string | null = null;
        if (params?.messages) {
          for (let k = params.messages.length - 1; k >= 0; k--) {
            const m = params.messages[k];
            if (m.role === "user" && typeof m.content === "string") { userMessage = m.content; break; }
          }
        }
        const req: RequestData = { requestId: rid, userMessage, model: params?.model || "unknown", usage: null, error: null, done: false, timestamp: Date.now(), text: "", thinking: "", toolCalls: [] };
        dispatch({ type: "new", sid, userAgent: meta.user_agent || "Unknown", req });
        break;
      }

      case "modif/chat-completion-chunk": {
        const chunk = msg.params as Record<string, unknown> | null;
        if (!chunk?.choices || !Array.isArray(chunk.choices)) break;
        let delta = "";
        let thinking = "";
        let toolCalls: ToolCallData[] = [];
        for (const choice of chunk.choices) {
          const d = (choice as Record<string, unknown>).delta as Record<string, unknown> | undefined;
          if (!d) continue;
          // 文本正文
          if (typeof d.content === "string") delta += d.content;
          // 思考内容（OpenAI o1/DeepSeek-R1 等）
          const rc = d.reasoning_content;
          if (typeof rc === "string") thinking += rc;
          // 工具调用增量
          const tcs = (d as Record<string, unknown>).tool_calls;
          if (Array.isArray(tcs)) {
            toolCalls = toolCalls.concat(
              tcs.map((tc) => {
                const t = tc as Record<string, unknown>;
                const fn = (t.function ?? {}) as { name?: unknown; arguments?: unknown };
                return {
                  id: typeof t.id === "string" ? t.id : "",
                  name: typeof fn.name === "string" ? fn.name : "",
                  arguments: typeof fn.arguments === "string" ? fn.arguments : "",
                } satisfies ToolCallData;
              })
            );
          }
        }

        // 该 chunk 是否携带 usage（通常最后一个 chunk）
        const usage = chunk.usage as RequestData["usage"] | undefined;

        if (!delta && !thinking && toolCalls.length === 0) {
          if (usage) dispatch({ type: "chunk", rid, delta: "", thinking: "", toolCalls: [], usage });
          break;
        }

        const existing = pendingChunks.current.get(rid);
        if (existing) {
          existing.delta += delta;
          existing.thinking += thinking;
          if (toolCalls.length > 0) existing.toolCalls = existing.toolCalls.concat(toolCalls);
          if (usage) existing.usage = usage;
        } else {
          pendingChunks.current.set(rid, { delta, thinking, toolCalls, usage: usage ?? null });
        }
        if (!rafPending.current) {
          rafPending.current = true;
          requestAnimationFrame(flushChunks);
        }
        break;
      }

      case "modif/chat-completion-usage": {
        const usage = msg.params as RequestData["usage"] | null;
        if (usage && typeof usage === "object") {
          dispatch({ type: "usage", rid, usage });
        }
        break;
      }

      case "modif/chat-completion-done": {
        flushChunks();
        dispatch({ type: "done", rid });
        break;
      }

      case "modif/chat-completion-error": {
        flushChunks();
        dispatch({ type: "error", rid, error: msg.params as RequestData["error"] });
        break;
      }
    }
  }, [flushChunks]);

  // WebSocket
  useEffect(() => {
    if (manualOff) { setConnected(false); return; }
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let ws: WebSocket | null = null;

    const connect = () => {
      if (stopped || manualOff) return;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${location.host}/api/inspect/attach`);
      ws.onopen = () => { if (!stopped) setConnected(true); };
      ws.onmessage = (e) => { if (!stopped) { try { handleMessage(JSON.parse(e.data)); } catch { /* */ } } };
      ws.onclose = (ev) => { if (!stopped) { setConnected(false); ws = null; if (!manualOff && ev.code !== 1000) reconnectTimer = setTimeout(connect, 3000); } };
      ws.onerror = () => {};
    };

    const timer = setTimeout(connect, 100);
    return () => { stopped = true; clearTimeout(timer); clearTimeout(reconnectTimer); if (ws) { ws.onclose = null; ws.onmessage = null; ws.onopen = null; ws.onerror = null; ws.close(1000); } };
  }, [manualOff, reconnectTrigger.current, handleMessage]);

  const selectSession = useCallback((id: string) => { setSelectedSessionId(id); }, []);

  const toggleConnection = useCallback(() => {
    setManualOff((prev) => { if (!prev) reconnectTrigger.current++; return !prev; });
  }, []);

  // Auto-select first session
  useEffect(() => {
    if (!selectedSessionId && state.sessions.length > 0) setSelectedSessionId(state.sessions[0].sessionId);
  }, [state.sessions, selectedSessionId]);

  return {
    sessions: state.sessions,
    selectedSessionId,
    connected,
    selectSession,
    toggleConnection,
  };
}