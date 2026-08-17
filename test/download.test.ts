/**
 * download_media / thumbnail 单测：mock fetch 二进制流 + 落盘验证。
 */

import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { downloadMedia } from '../src/tools/download.js';
import { getThumbnail } from '../src/tools/thumbnail.js';
import { SsaveApiError } from '../src/errors.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssave-mcp-test-'));
after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function mockFetchBinary(status: number, body: Uint8Array, headers: Record<string, string>): void {
  mock.method(globalThis, 'fetch', async () => {
    return new Response(body, { status, headers });
  });
}

test('download_media 流式落盘 + Content-Disposition 文件名', async () => {
  const bytes = new TextEncoder().encode('fake-mp4-bytes');
  mockFetchBinary(200, bytes, {
    'Content-Type': 'video/mp4',
    'Content-Disposition': 'attachment; filename="tiktok_video.mp4"',
    'Content-Length': String(bytes.length),
  });
  const result = await downloadMedia({ id: 'ssv_ok', type: 'hd', output_dir: tmpDir });
  assert.equal(result.filename, 'tiktok_video.mp4');
  assert.equal(result.size_bytes, bytes.length);
  assert.equal(result.content_type, 'video/mp4');
  assert.equal(fs.readFileSync(result.saved_to).toString(), 'fake-mp4-bytes');
});

test('download_media 无 Content-Disposition → 回退 ssave_{ts}.mp4', async () => {
  const bytes = new TextEncoder().encode('x');
  mockFetchBinary(200, bytes, { 'Content-Type': 'video/mp4' });
  const result = await downloadMedia({ id: 'ssv_ok', type: 'hd', output_dir: tmpDir });
  assert.match(result.filename, /^ssave_\d+\.mp4$/);
});

test('download_media mp3 → .mp3 扩展名', async () => {
  const bytes = new TextEncoder().encode('id3...');
  mockFetchBinary(200, bytes, { 'Content-Type': 'audio/mpeg' });
  const result = await downloadMedia({ id: 'ssv_ok', type: 'mp3', output_dir: tmpDir });
  assert.match(result.filename, /\.mp3$/);
});

test('download_media 403 → expired_or_invalid（不落盘）', async () => {
  mock.method(globalThis, 'fetch', async () => {
    return new Response(JSON.stringify({ error: { code: 'expired_or_invalid', message: 'expired' } }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  await assert.rejects(
    () => downloadMedia({ id: 'ssv_expired', type: 'hd', output_dir: tmpDir }),
    (err: unknown) => err instanceof SsaveApiError && err.code === 'expired_or_invalid',
  );
  // 不应留下文件
  assert.equal(fs.readdirSync(tmpDir).filter((f) => f.includes('ssave_expired')).length, 0);
});

test('get_thumbnail 落盘 jpg', async () => {
  const bytes = new TextEncoder().encode('jpeg-data');
  mockFetchBinary(200, bytes, { 'Content-Type': 'image/jpeg' });
  const result = await getThumbnail({ id: 'ssv_ok', output_dir: tmpDir });
  assert.match(result.filename, /\.jpg$/);
  assert.equal(fs.readFileSync(result.saved_to).toString(), 'jpeg-data');
});
