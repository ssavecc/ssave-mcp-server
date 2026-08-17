/**
 * download_media —— 把已提取的媒体流式下载到本地磁盘。
 *
 * 核心差异化（见 docs/mcp-plan.md §3.3）：stdio server 运行在用户本机，
 * 直接写文件并返回绝对路径，比返回 URL 更贴合 AI 工作流。
 *
 * 输出结构见 docs/mcp-contract.md §2.2。
 */

import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { apiDownload, type DownloadType } from '../client.js';
import { resolveOutputDir } from '../config.js';
import { SsaveApiError } from '../errors.js';

export const downloadSchema = {
  id: z.string().min(1).describe('extract_media 返回的 ssv_ token'),
  type: z
    .enum(['hd', 'watermark', 'mp3'])
    .optional()
    .describe('默认 hd；mp3 → .mp3，其余 → .mp4'),
  output_dir: z
    .string()
    .optional()
    .describe('覆盖默认输出目录（默认 ~/Downloads/ssave/，~ 会展开）'),
} as const;

export interface DownloadResult {
  saved_to: string;
  filename: string;
  size_bytes: number;
  content_type: string;
}

export async function downloadMedia(args: {
  id: string;
  type?: DownloadType;
  output_dir?: string;
}): Promise<DownloadResult> {
  const type = args.type ?? 'hd';
  const dir = resolveOutputDir(args.output_dir);
  fs.mkdirSync(dir, { recursive: true });

  const res = await apiDownload(args.id, type);

  // 文件名：优先 Content-Disposition，失败回退 ssave_{ts}.{ext}
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const dispMatch = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
  let filename: string | null = null;
  if (dispMatch) {
    try {
      filename = decodeURIComponent(dispMatch[1].replace(/^"|"$/g, ''));
    } catch {
      filename = dispMatch[1].replace(/^"|"$/g, '');
    }
  }
  const ext = type === 'mp3' ? 'mp3' : 'mp4';
  filename = filename ?? `ssave_${Math.floor(Date.now() / 1000)}.${ext}`;

  const target = path.join(dir, filename);
  const contentLength = res.headers.get('Content-Length');
  const total = contentLength ? Number(contentLength) : null;

  // 流式写盘 + 基于 Content-Length 的进度日志
  const body = res.body;
  if (!body) {
    throw new SsaveApiError(502, 'extract_failed', 'Empty download stream from upstream');
  }

  // fetch body 是 Web ReadableStream，转成 Node Readable 以便 pipeline 与进度监听
  const nodeStream = Readable.fromWeb(body as import('node:stream/web').ReadableStream);
  let written = 0;
  nodeStream.on('data', (chunk: Buffer) => {
    written += chunk.length;
    if (total && written % (1024 * 1024) < chunk.length) {
      // 每 ~1MB 打一次进度，避免刷屏
      console.error(`[download_media] 下载中: ${(written / 1048576).toFixed(1)}MB / ${(total / 1048576).toFixed(1)}MB`);
    }
  });
  const fileStream = fs.createWriteStream(target);
  try {
    await pipeline(nodeStream, fileStream);
  } catch (err) {
    // 写盘失败：清理半成品，明确报错
    fs.rmSync(target, { force: true });
    throw err instanceof Error
      ? new SsaveApiError(502, 'extract_failed', `Failed to write file: ${err.message}`)
      : err;
  }

  return {
    saved_to: target,
    filename,
    size_bytes: written,
    content_type: res.headers.get('Content-Type') ?? 'application/octet-stream',
  };
}
