'use strict';

/**
 * skill 加载与注入。
 *
 * skill 采用 Markdown 文件（.md），可携带 YAML frontmatter（gray-matter 解析）：
 *
 *   ---
 *   name: my-skill
 *   enabled: true
 *   ---
 *   这里是 skill 正文……
 *
 * 支持两种目录组织：子目录 + SKILL.md，或平铺 .md。
 * 每个请求到来时重新扫描，动态放置/删除 skill 无需重启 agent。
 *
 * 注入方式：
 *   - chat completions：作为 system 消息（无则插入最前，有则追加到第一条 system）
 *   - responses：写入顶层 instructions 字段
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const HEADING = '## Skills';
const SEPARATOR = '\n\n---\n\n';

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** 递归收集目录下的 .md 文件（SKILL.md 归属其父目录名） */
function collectMarkdownFiles(dir) {
  const out = [];
  const walk = (cur) => {
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        const base = e.name.slice(0, -3);
        const fallbackName = base.toLowerCase() === 'skill' ? path.basename(cur) : base;
        out.push({ file: full, fallbackName });
      }
    }
  };
  walk(dir);
  return out;
}

/**
 * 加载 skills 目录下所有启用的 skill。
 * @param {string} skillsDir
 * @returns {Array<{name:string, content:string, file:string}>}
 */
function loadSkills(skillsDir) {
  const dir = path.resolve(skillsDir);

  let files;
  try {
    files = collectMarkdownFiles(dir);
  } catch {
    return [];
  }

  const skills = [];
  for (const { file, fallbackName } of files) {
    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    let data;
    let content;
    try {
      const parsed = matter(raw);
      data = parsed.data || {};
      content = parsed.content || '';
    } catch {
      data = {};
      content = raw;
    }

    content = content.trim();
    if (content === '' || data.enabled === false) continue;

    const name =
      typeof data.name === 'string' && data.name !== ''
        ? data.name
        : typeof data.displayName === 'string' && data.displayName !== ''
          ? data.displayName
          : fallbackName;

    skills.push({ name, content, file });
  }

  skills.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  return skills;
}

/** 把一组 skill 组装成一个文本块 */
function buildSkillsBlock(skills) {
  if (!skills.length) return '';
  const body = skills.map((s) => `### ${s.name}\n${s.content}`).join(SEPARATOR);
  return `${HEADING}\n\n${body}`;
}

/** 往已有文本后追加 block，并按 HEADING 去重 */
function appendBlock(existing, block) {
  const base = typeof existing === 'string' && existing.trim() !== '' ? existing : '';
  if (base === '') return block;

  const idx = base.indexOf(HEADING);
  if (idx >= 0) {
    const prefix = base.slice(0, idx).trimEnd();
    return prefix === '' ? block : `${prefix}\n\n${block}`;
  }
  return `${base.trimEnd()}\n\n${block}`;
}

/** 将 block 写入 system 消息的 content（string 或 parts 数组） */
function setSystemContent(content, block) {
  if (typeof content === 'string') return appendBlock(content, block);

  if (Array.isArray(content)) {
    const parts = content.map((p) => (isObject(p) ? { ...p } : p));
    const idx = parts.findIndex(
      (p) => isObject(p) && (typeof p.text === 'string' || p.type === 'text' || p.type === 'input_text')
    );
    if (idx >= 0) {
      const old = typeof parts[idx].text === 'string' ? parts[idx].text : '';
      parts[idx] = { ...parts[idx], text: appendBlock(old, block) };
      return parts;
    }
    return [...parts, { type: 'text', text: block }];
  }

  return block;
}

/**
 * 把 skill block 注入 params（浅拷贝，不修改入参）。
 * @param {any} params chat completions 或 responses 参数
 * @param {string} block skill 文本块
 */
function injectSkills(params, block) {
  if (!block || !isObject(params)) return params;
  const p = { ...params };

  // chat completions：messages
  if (Array.isArray(p.messages)) {
    const messages = p.messages.map((m) => (isObject(m) ? { ...m } : m));
    const sysIdx = messages.findIndex((m) => isObject(m) && m.role === 'system');
    if (sysIdx >= 0) {
      messages[sysIdx] = { ...messages[sysIdx], content: setSystemContent(messages[sysIdx].content, block) };
    } else {
      messages.unshift({ role: 'system', content: block });
    }
    p.messages = messages;
    return p;
  }

  // responses：顶层 instructions
  if ('instructions' in p || 'input' in p) {
    const old = typeof p.instructions === 'string' ? p.instructions : '';
    p.instructions = appendBlock(old, block);
    return p;
  }

  return p;
}

module.exports = { loadSkills, buildSkillsBlock, injectSkills };