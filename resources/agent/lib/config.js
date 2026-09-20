'use strict';

/**
 * JSONC 配置加载。
 *
 * 与后端 resources/config/application.jsonc 的约定保持一致：
 *   - 允许 // 行注释与 /\* *\/ 块注释
 *   - 允许对象/数组末尾的尾随逗号
 *   - 字段名使用 snake_case
 *
 * 底层使用微软的 jsonc-parser（公开库），不自行处理注释/逗号。
 */

const fs = require('fs');
const path = require('path');
const { parse, printParseErrorCode } = require('jsonc-parser');

/**
 * 解析 JSONC 文本为对象。
 */
function parseJSONC(text) {
  const errors = [];
  const value = parse(String(text), errors, { allowTrailingComma: true, disallowComments: false });

  if (errors.length > 0) {
    const first = errors[0];
    const where = typeof first.offset === 'number' ? `（位置 ${first.offset}）` : '';
    throw new SyntaxError(`${printParseErrorCode(first.error)} ${where}`);
  }

  return value;
}

/**
 * 读取并解析配置文件。
 */
function loadJSONC(filePath) {
  const abs = path.resolve(filePath);
  let raw;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch (err) {
    throw new Error(`无法读取配置文件 ${abs}：${err.message}`);
  }

  let obj;
  try {
    obj = parseJSONC(raw);
  } catch (err) {
    throw new Error(`配置文件 ${abs} 解析失败：${err.message}`);
  }

  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error(`配置文件 ${abs} 顶层必须是对象`);
  }
  return obj;
}

/** 配置文件（snake_case）与内部（camelCase）字段的映射 */
const KEY_MAP = {
  url: 'url',
  retry_ms: 'retryMs',
  skills: 'skillsDir',
};

/**
 * 把配置文件对象转换为内部配置对象。
 * 只取已知字段，未知字段忽略。
 */
function normalizeConfig(obj) {
  const out = {};
  for (const [src, dst] of Object.entries(KEY_MAP)) {
    if (src in obj) out[dst] = obj[src];
  }
  return out;
}

module.exports = {
  parseJSONC,
  loadJSONC,
  normalizeConfig,
};