'use strict';

/**
 * 极简 JSON-RPC 2.0 over WebSocket 客户端（基于 ws）。
 *
 * 只实现 MODIF 观察者所需的子集：
 *   - 接收后端推送的「请求」（需要响应）与「通知」（无需响应）；
 *   - 对「请求」回写 result / error 响应。
 *
 * 重要：后端 /api/inspect/attach 这一端的 jsonrpc2.Conn 只作为调用方使用
 * （handler 传入的是 nil），它不处理观察者主动发起的 method 请求。因此本
 * agent 只「响应」后端请求，绝不主动向后端发送 method 请求。
 */

const WebSocket = require('ws');

const JSONRPC_VERSION = '2.0';

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isRequest(msg) {
  return isObject(msg) && typeof msg.method === 'string' && msg.id !== undefined && msg.id !== null;
}

function isNotification(msg) {
  return isObject(msg) && typeof msg.method === 'string' && (msg.id === undefined || msg.id === null);
}

function isResponse(msg) {
  return isObject(msg) && typeof msg.method !== 'string' && (msg.result !== undefined || msg.error !== undefined);
}

function normalizeError(err) {
  if (isObject(err) && err.code !== undefined && err.message !== undefined) {
    const obj = { code: Number(err.code) || -32603, message: String(err.message) };
    if (err.data !== undefined) obj.data = err.data;
    return obj;
  }
  const message = err instanceof Error ? err.message : String(err);
  return { code: -32603, message };
}

class InspectClient {
  /**
   * @param {string} url WebSocket 地址
   * @param {object} [opts]
   * @param {(method: string, params: any, meta: any, raw: any) => void} [opts.onNotification]
   * @param {(info: {code: number, reason: string, byUser: boolean}) => void} [opts.onClosed]
   * @param {(...args: any[]) => void} [opts.log]
   */
  constructor(url, opts = {}) {
    this.url = url;
    this.onNotification = opts.onNotification || null;
    this.onClosed = opts.onClosed || null;
    this.log = opts.log || (() => {});
    this.ws = null;
    this.handlers = new Map();
    this.connected = false;
    this.closedByUser = false;
  }

  /**
   * 注册一个方法处理器。
   * handler(method, params, meta, raw) => { result } | { error }
   *（返回 undefined 时按「透传原始参数」处理）
   */
  method(name, handler) {
    this.handlers.set(name, handler);
    return this;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.closedByUser = false;
      let settled = false;

      let ws;
      try {
        ws = new WebSocket(this.url);
      } catch (err) {
        reject(err);
        return;
      }
      this.ws = ws;

      ws.once('open', () => {
        if (settled) return;
        settled = true;
        this.connected = true;
        resolve();
      });
      ws.on('error', (err) => {
        if (!settled) {
          settled = true;
          reject(new Error(`无法连接 ${this.url}：${err.message || err}`));
        }
      });
      ws.on('message', (data, isBinary) => this._onMessage(data, isBinary));
      ws.on('close', (code, reason) => this._onClose(code, reason));
    });
  }

  async _onMessage(data, isBinary) {
    let text = data;
    if (isBinary) {
      text = data.toString('utf8');
    } else if (Buffer.isBuffer(data)) {
      text = data.toString('utf8');
    } else if (typeof data !== 'string') {
      text = String(data);
    }

    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (!isObject(msg) || msg.jsonrpc !== JSONRPC_VERSION) return;

    if (isRequest(msg)) {
      await this._handleRequest(msg);
    } else if (isNotification(msg)) {
      if (this.onNotification) this.onNotification(msg.method, msg.params ?? null, msg.meta ?? null, msg);
    } else if (isResponse(msg)) {
      // 本 agent 不主动发请求，正常情况下收不到响应；收到则忽略。
      this.log('收到未请求的响应:', msg.id);
    }
  }

  async _handleRequest(msg) {
    const handler = this.handlers.get(msg.method);
    const meta = msg.meta ?? null;
    const params = msg.params ?? null;

    let reply;
    try {
      let out;
      if (handler) {
        out = await handler(msg.method, params, meta, msg);
      }

      if (out && out.error) {
        reply = { jsonrpc: JSONRPC_VERSION, id: msg.id, error: normalizeError(out.error) };
      } else {
        // 关键：不修改时必须「原样」回写 params，而不是 result: null，
        // 否则后端会把空参数继续转发给上游。
        const result = out && out.result !== undefined ? out.result : params;
        reply = { jsonrpc: JSONRPC_VERSION, id: msg.id, result };
      }
    } catch (err) {
      reply = { jsonrpc: JSONRPC_VERSION, id: msg.id, error: normalizeError(err) };
    }

    this._send(reply);
  }

  _send(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(obj));
    return true;
  }

  _onClose(code, reasonBuf) {
    this.connected = false;
    this.ws = null;
    const info = {
      code: typeof code === 'number' ? code : -1,
      reason: (reasonBuf && reasonBuf.toString()) || '',
      byUser: this.closedByUser,
    };
    if (this.onClosed) this.onClosed(info);
  }

  close(code = 1000, reason = '') {
    this.closedByUser = true;
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      try {
        this.ws.close(code, reason);
      } catch {
        /* ignore */
      }
    }
  }
}

module.exports = {
  InspectClient,
  isRequest,
  isNotification,
  isResponse,
  normalizeError,
};