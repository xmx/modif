'use strict';

/**
 * 离线自测：校验 skills 加载与注入逻辑。
 * 运行：node selftest.js
 */

const assert = require('node:assert');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { loadSkills, buildSkillsBlock, injectSkills } = require('./lib/skills');
const { parseJSONC, normalizeConfig } = require('./lib/config');
const { normalizeError, isRequest, isNotification } = require('./lib/jsonrpc');

// 1. skills：加载（frontmatter / enabled 过滤 / 目录不存在 / 子目录 SKILL.md）
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'modif-skills-'));
  fs.writeFileSync(path.join(dir, 'b-skill.md'), '---\nname: beta\n---\nbeta body\n');
  fs.writeFileSync(path.join(dir, 'a-skill.md'), '---\nenabled: false\n---\nskip me\n');
  fs.writeFileSync(path.join(dir, 'no-frontmatter.md'), 'plain body\n');
  fs.writeFileSync(path.join(dir, 'ignore.txt'), 'not a skill\n');

  fs.mkdirSync(path.join(dir, 'my-skill'));
  fs.writeFileSync(path.join(dir, 'my-skill', 'SKILL.md'), '---\ndisplayName: 我的技能\n---\nskill body\n');

  const skills = loadSkills(dir);
  assert.strictEqual(skills.length, 3); // enabled:false 被跳过，.txt 被忽略

  const byName = Object.fromEntries(skills.map((s) => [s.name, s]));
  assert.strictEqual(byName.beta.content, 'beta body');
  assert.strictEqual(byName['我的技能'].content, 'skill body'); // displayName 优先于目录名
  assert.strictEqual(byName['no-frontmatter'].content, 'plain body');

  // 目录不存在
  assert.deepStrictEqual(loadSkills(path.join(dir, 'nope')), []);

  fs.rmSync(dir, { recursive: true, force: true });
}

// 2. skills：buildSkillsBlock / injectSkills（chat system 与 responses instructions）
{
  const block = buildSkillsBlock([
    { name: 's1', content: 'body1' },
    { name: 's2', content: 'body2' },
  ]);
  assert.strictEqual(block, '## Skills\n\n### s1\nbody1\n\n---\n\n### s2\nbody2');

  // chat：无 system → 插入最前
  {
    const injected = injectSkills({ messages: [{ role: 'user', content: 'hi' }] }, block);
    assert.strictEqual(injected.messages[0].role, 'system');
    assert.ok(injected.messages[0].content.includes('## Skills'));
    assert.strictEqual(injected.messages.length, 2);
  }

  // chat：已有 system → 追加内容（string）
  {
    const injected = injectSkills(
      { messages: [{ role: 'system', content: '你是助手' }, { role: 'user', content: 'hi' }] },
      block
    );
    assert.strictEqual(injected.messages[0].content, '你是助手\n\n## Skills\n\n### s1\nbody1\n\n---\n\n### s2\nbody2');
  }

  // responses：无 instructions → 写入 instructions
  {
    const injected = injectSkills({ input: [{ role: 'user', content: 'hi' }] }, block);
    assert.ok(injected.instructions.includes('## Skills'));
  }

  // responses：已有 instructions → 追加
  {
    const injected = injectSkills({ instructions: '原指令', input: 'hi' }, block);
    assert.strictEqual(injected.instructions, '原指令\n\n## Skills\n\n### s1\nbody1\n\n---\n\n### s2\nbody2');
  }

  // 空 block → 原样返回
  {
    const params = { messages: [{ role: 'user', content: 'hi' }] };
    assert.strictEqual(injectSkills(params, ''), params);
  }
}

// 3. JSONC 解析（注释 / 尾随逗号 / 键名映射）
{
  const raw = `
  {
    // 连接
    "url": "ws://127.0.0.1:8866/api/inspect/attach",
    "retry_ms": 5000,
    "skills": "skills/",
  }`;
  const obj = parseJSONC(raw);
  assert.strictEqual(obj.retry_ms, 5000);
  assert.strictEqual(obj.skills, 'skills/');

  const norm = normalizeConfig(obj);
  assert.strictEqual(norm.retryMs, 5000);
  assert.strictEqual(norm.skillsDir, 'skills/');
  assert.strictEqual(norm.url, 'ws://127.0.0.1:8866/api/inspect/attach');
}

// 4. normalizeConfig 忽略未知字段
{
  const norm = normalizeConfig({ url: 'ws://x', unknown_key: 1 });
  assert.deepStrictEqual(norm, { url: 'ws://x' });
}

// 5. jsonrpc 消息判别
{
  assert.strictEqual(isNotification({ jsonrpc: '2.0', method: 'modif/response-chunk', params: null }), true);
  assert.strictEqual(isRequest({ jsonrpc: '2.0', id: 1, method: 'modif/response-new' }), true);
  assert.deepStrictEqual(normalizeError(new Error('boom')), { code: -32603, message: 'boom' });
}

console.log('✓ 全部自测通过');