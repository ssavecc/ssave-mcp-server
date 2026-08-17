/**
 * errors.ts 单测：错误信封解析 + 提示文案映射。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SsaveApiError, parseErrorBody, toSsaveError } from '../src/errors.js';

test('parseErrorBody 解析标准错误信封', () => {
  const err = parseErrorBody(429, {
    error: { code: 'rate_limited', message: 'too many', reset_at: '2026-08-13T00:00:00Z' },
  });
  assert.ok(err instanceof SsaveApiError);
  assert.equal(err.code, 'rate_limited');
  assert.equal(err.httpStatus, 429);
  assert.equal(err.resetAt, '2026-08-13T00:00:00Z');
});

test('parseErrorBody 非信封响应按状态码推断', () => {
  const err = parseErrorBody(403, { detail: 'nope' });
  assert.equal(err.code, 'expired_or_invalid');
  const err2 = parseErrorBody(429, 'plain text body');
  assert.equal(err2.code, 'rate_limited');
});

test('parseErrorBody 未知状态码回退 upstream_unavailable', () => {
  const err = parseErrorBody(500, { detail: 'boom' });
  assert.equal(err.code, 'upstream_unavailable');
  assert.equal(err.httpStatus, 500);
});

test('toPrompt: rate_limited 带 reset_at', () => {
  const err = new SsaveApiError(429, 'rate_limited', 'too many', '2026-08-13T00:00:00Z');
  assert.match(err.toPrompt(), /UTC 2026-08-13T00:00:00Z 后重试/);
});

test('toPrompt: expired_or_invalid 提示重新 extract', () => {
  const err = new SsaveApiError(403, 'expired_or_invalid', 'expired');
  assert.match(err.toPrompt(), /重新调用 extract_media/);
});

test('toSsaveError 透传 SsaveApiError', () => {
  const err = new SsaveApiError(404, 'format_unavailable', 'no mp3');
  assert.equal(toSsaveError(err), err);
});

test('toSsaveError 包装普通 Error', () => {
  const err = toSsaveError(new Error('network down'));
  assert.ok(err instanceof SsaveApiError);
  assert.equal(err.code, 'upstream_unavailable');
});
