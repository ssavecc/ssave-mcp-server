/**
 * extract_media —— 从链接提取媒体元数据与可下载格式。
 *
 * 透传 /open/v1/extract 响应（见 docs/mcp-contract.md §2.1）。
 */

import { z } from 'zod';
import { apiExtract, type ExtractResult } from '../client.js';
import { SsaveApiError } from '../errors.js';

export const extractSchema = {
  url: z.string().min(1).describe('TikTok / Instagram / YouTube / Douyin 视频链接'),
  format: z
    .enum(['video', 'audio'])
    .optional()
    .describe('默认 video；audio 只取 mp3（YT/IG 按需二次调用）'),
} as const;

export async function extractMedia(args: {
  url: string;
  format?: 'video' | 'audio';
}): Promise<ExtractResult> {
  const url = args.url.trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new SsaveApiError(400, 'invalid_url', 'url must be a valid http(s) URL');
  }
  return apiExtract(url, args.format ?? 'video');
}
