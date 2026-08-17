/**
 * get_thumbnail —— 把封面图落盘（可选工具）。
 *
 * 避免 AI 客户端拿封面 URL 直接请求 IG/Douyin 源站（经 Ssave 代理）。
 * 见 docs/mcp-contract.md §2.3。
 */

import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { apiThumbnail } from '../client.js';
import { resolveOutputDir } from '../config.js';
import { SsaveApiError } from '../errors.js';

export const thumbnailSchema = {
  id: z.string().min(1).describe('extract_media 返回的 ssv_ token'),
  output_dir: z.string().optional().describe('覆盖默认输出目录（~ 会展开）'),
} as const;

export interface ThumbnailResult {
  saved_to: string;
  filename: string;
  size_bytes: number;
  content_type: string;
}

export async function getThumbnail(args: {
  id: string;
  output_dir?: string;
}): Promise<ThumbnailResult> {
  const dir = resolveOutputDir(args.output_dir);
  fs.mkdirSync(dir, { recursive: true });

  const res = await apiThumbnail(args.id);
  const contentType = res.headers.get('Content-Type') ?? 'image/jpeg';
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const ext = extMap[contentType.split(';')[0]] ?? 'jpg';
  const filename = `ssave_thumb_${Math.floor(Date.now() / 1000)}.${ext}`;
  const target = path.join(dir, filename);

  const body = res.body;
  if (!body) {
    throw new SsaveApiError(502, 'extract_failed', 'Empty thumbnail stream from upstream');
  }

  const nodeStream = Readable.fromWeb(body as import('node:stream/web').ReadableStream);
  let written = 0;
  nodeStream.on('data', (chunk: Buffer) => {
    written += chunk.length;
  });
  try {
    await pipeline(nodeStream, fs.createWriteStream(target));
  } catch (err) {
    fs.rmSync(target, { force: true });
    throw err instanceof Error
      ? new SsaveApiError(502, 'extract_failed', `Failed to write thumbnail: ${err.message}`)
      : err;
  }

  return {
    saved_to: target,
    filename,
    size_bytes: written,
    content_type: contentType,
  };
}
