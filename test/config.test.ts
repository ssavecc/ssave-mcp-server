/**
 * config.ts 单测：默认值与 ~ 展开。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { resolveOutputDir, API_BASE_URL, DEFAULT_OUTPUT_DIR } from '../src/config.js';

test('API_BASE_URL 默认值', () => {
  assert.equal(API_BASE_URL, 'https://api.ssave.cc');
});

test('resolveOutputDir 未传 → 默认 ~/Downloads/ssave', () => {
  assert.equal(resolveOutputDir(), DEFAULT_OUTPUT_DIR);
});

test('resolveOutputDir 展开 ~ 前缀', () => {
  assert.equal(resolveOutputDir('~/tmp'), path.join(os.homedir(), 'tmp'));
});

test('resolveOutputDir 保留绝对路径', () => {
  assert.equal(resolveOutputDir('/data/out'), '/data/out');
});

test('DEFAULT_OUTPUT_DIR 不包含字面 ~', () => {
  assert.ok(!DEFAULT_OUTPUT_DIR.includes('~'));
  assert.equal(DEFAULT_OUTPUT_DIR, path.join(os.homedir(), 'Downloads', 'ssave'));
});
