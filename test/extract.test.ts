/**
 * extract_media / client.ts 单测：mock fetch。
 */

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { extractMedia } from '../src/tools/extract.js';
import { apiExtract, apiDownload } from '../src/client.js';
import { SsaveApiError } from '../src/errors.js';

const okExtract = {
  id: 'ssv_test',
  platform: 'tiktok',
  title: 'hello',
  author: '@user',
  duration: 45,
  formats: ['hd', 'watermark', 'mp3'],
  download: {
    hd: 'https://api.ssave.cc/open/v1/download?id=ssv_test&type=hd',
    watermark: 'https://api.ssave.cc/open/v1/download?id=ssv_test&type=watermark',
    mp3: 'https://api.ssave.cc/open/v1/download?id=ssv_test&type=mp3',
  },
  expires_at: '2026-08-13T10:20:00Z',
};

function mockFetchJson(status: number, body: unknown): void {
  mock.method(globalThis, 'fetch', async () => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

test('extract_media 透传 200 响应', async () => {
  mockFetchJson(200, okExtract);
  const result = await extractMedia({ url: 'https://www.tiktok.com/@user/video/123' });
  assert.equal(result.platform, 'tiktok');
  assert.deepEqual(result.formats, ['hd', 'watermark', 'mp3']);
  assert.equal(result.id, 'ssv_test');
});

test('extract_media 默认 format=video', async () => {
  let sentBody = '';
  mock.method(globalThis, 'fetch', async (_url: string, init?: RequestInit) => {
    sentBody = String(init?.body);
    return new Response(JSON.stringify(okExtract), { status: 200 });
  });
  await extractMedia({ url: 'https://www.instagram.com/reel/abc/' });
  assert.equal(JSON.parse(sentBody).format, 'video');
});

test('extract_media 非法 URL → invalid_url', async () => {
  await assert.rejects(
    () => extractMedia({ url: 'not-a-url' }),
    (err: unknown) => err instanceof SsaveApiError && err.code === 'invalid_url',
  );
});

test('apiExtract 429 → rate_limited 带 reset_at', async () => {
  mockFetchJson(429, {
    error: { code: 'rate_limited', message: 'limit', reset_at: '2026-08-13T00:00:00Z' },
  });
  await assert.rejects(
    () => apiExtract('https://www.tiktok.com/@u/video/1', 'video'),
    (err: unknown) =>
      err instanceof SsaveApiError && err.code === 'rate_limited' && err.resetAt !== undefined,
  );
});

test('apiExtract 422 → unsupported_platform', async () => {
  mockFetchJson(422, { error: { code: 'unsupported_platform', message: 'nope' } });
  await assert.rejects(
    () => apiExtract('https://example.com/x', 'video'),
    (err: unknown) => err instanceof SsaveApiError && err.code === 'unsupported_platform',
  );
});

test('apiDownload 失败（403 expired）→ expired_or_invalid', async () => {
  mockFetchJson(403, { error: { code: 'expired_or_invalid', message: 'expired' } });
  await assert.rejects(
    () => apiDownload('ssv_bad', 'hd'),
    (err: unknown) => err instanceof SsaveApiError && err.code === 'expired_or_invalid',
  );
});
