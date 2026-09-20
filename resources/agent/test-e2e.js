'use strict';

/**
 * 端到端自测。
 *
 * 用 `ws` 起一个最小 WebSocket 服务端，模拟 MODIF 网关：
 *   1. 通过「配置文件」拉起一个 `index.js` 子进程，连接测试服务端；
 *   2. 分别推送 response-new 与 chat-completion-new 请求；
 *   3. 校验 agent 把 skills 附加到请求体并正确回写 result。
 *
 * 运行：node test-e2e.js
 */

const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const assert = require('assert');

const ROOT = __dirname;

function runAgent(port, skillsDir) {
  const env = { ...process.env };
  const tmpConfig = path.join(os.tmpdir(), `modif-agent-e2e-${process.pid}-${port}.jsonc`);
  fs.writeFileSync(
    tmpConfig,
    [
      '{',
      '  "url": "ws://127.0.0.1:' + port + '/api/inspect/attach",',
      '  "retry_ms": 3000,',
      '  "skills": ' + JSON.stringify(skillsDir) + ',',
      '}',
    ].join('\n')
  );

  const child = spawn(process.execPath, ['index.js', '-c', tmpConfig], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });
  child.on('exit', () => {
    try {
      fs.unlinkSync(tmpConfig);
    } catch {
      /* ignore */
    }
  });
  return child;
}

async function main() {
  const port = 18866;

  // 动态创建 skills 目录与 skill 文件
  const skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'modif-agent-skills-'));
  fs.writeFileSync(
    path.join(skillsDir, 'greeting.md'),
    '---\nname: greeting\n---\n请始终保持礼貌和友好。\n'
  );

  const wss = new WebSocketServer({ host: '127.0.0.1', port });

  const agent = runAgent(port, skillsDir);
  let agentStdout = '';
  agent.stdout.on('data', (d) => (agentStdout += d.toString()));
  agent.stderr.on('data', (d) => (agentStdout += d.toString()));

  // 等服务端收到 agent 连接
  const ws = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('agent 未连接到测试服务端')), 10000);
    wss.once('connection', (socket) => {
      clearTimeout(timer);
      resolve(socket);
    });
  });

  const replies = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.id !== undefined && msg.id !== null) replies.push(msg);
  });

  // 1. response-new 请求
  ws.send(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'modif/response-new',
      params: { model: 'gpt-4.1-mini', input: [{ role: 'user', content: [{ type: 'input_text', text: '你好世界' }] }] },
      meta: { request_id: 'req-e2e-1', session_id: 'sid-1', user_agent: 'test/1.0', client_ip: '127.0.0.1' },
    })
  );

  // 2. chat-completion-new 请求
  ws.send(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'modif/chat-completion-new',
      params: { model: 'gpt-4.1-mini', messages: [{ role: 'user', content: 'chat 你好' }] },
      meta: { request_id: 'req-e2e-2', session_id: 'sid-1', user_agent: 'test/1.0', client_ip: '127.0.0.1' },
    })
  );

  // 等待两个响应
  const deadline = Date.now() + 8000;
  let reply1 = null;
  let reply2 = null;
  while (Date.now() < deadline && (!reply1 || !reply2)) {
    reply1 = replies.find((r) => r.id === 1) || null;
    reply2 = replies.find((r) => r.id === 2) || null;
    if (!reply1 || !reply2) await new Promise((r) => setTimeout(r, 50));
  }

  assert.ok(reply1, '未收到 agent 对 id=1 的响应');
  assert.ok(reply2, '未收到 agent 对 id=2 的响应');
  assert.ok(reply1.result, 'response 缺少 result');
  assert.ok(reply2.result, 'response 缺少 result');

  // responses：skill 注入 instructions
  const r1 = JSON.parse(JSON.stringify(reply1.result));
  assert.ok(typeof r1.instructions === 'string', 'responses 缺少 instructions');
  assert.ok(r1.instructions.includes('## Skills'), 'instructions 未包含 heading');
  assert.ok(r1.instructions.includes('请始终保持礼貌和友好'), 'instructions 未包含 skill 正文');
  // 原 input 保持不变
  assert.strictEqual(r1.input[0].content[0].text, '你好世界');

  // chat：skill 注入 system 消息
  const r2 = JSON.parse(JSON.stringify(reply2.result));
  assert.strictEqual(r2.messages[0].role, 'system');
  assert.ok(r2.messages[0].content.includes('## Skills'));
  assert.strictEqual(r2.messages[1].content, 'chat 你好'); // 原 user 消息保持

  // agent 日志
  assert.ok(agentStdout.includes('附加 1 个 skill'), 'agent 日志未显示 skill 附加');

  console.log('✓ 端到端测试通过：agent 正确读取并附加 skills');
  console.log('  responses instructions:', JSON.stringify(r1.instructions));
  console.log('  chat system:', JSON.stringify(r2.messages[0].content.slice(0, 60)) + '...');
  console.log('  agent 输出片段:');
  console.log(agentStdout.split('\n').filter(Boolean).slice(-6).join('\n'));

  agent.kill('SIGTERM');
  ws.close();
  wss.close();
  fs.rmSync(skillsDir, { recursive: true, force: true });
  setTimeout(() => process.exit(0), 100);
}

main().catch((err) => {
  console.error('✗ 端到端测试失败:', err.message);
  process.exit(1);
});