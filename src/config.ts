/**
 * 环境变量配置（见 docs/mcp-contract.md §1.5）。
 *
 * - SSAVE_API_BASE_URL: 覆盖 API 基址（默认 https://api.ssave.cc，本地联调指向 http://localhost:8000）
 * - SSAVE_API_KEY:      Phase 3 预留；设置后以 Authorization: Bearer <key> 透传
 * - SSAVE_OUTPUT_DIR:   未传 output_dir 时的默认落盘目录（~ 会展开）
 */

import os from 'node:os';
import path from 'node:path';

export const API_BASE_URL: string = (
  process.env.SSAVE_API_BASE_URL ?? 'https://api.ssave.cc'
).replace(/\/+$/, '');

export const API_KEY: string | undefined = process.env.SSAVE_API_KEY || undefined;

export const DEFAULT_OUTPUT_DIR: string = (
  process.env.SSAVE_OUTPUT_DIR ?? path.join(os.homedir(), 'Downloads', 'ssave')
).replace(/^~(?=$|[/\\])/, os.homedir());

export function resolveOutputDir(outputDir?: string): string {
  if (!outputDir) return DEFAULT_OUTPUT_DIR;
  return outputDir.replace(/^~(?=$|[/\\])/, os.homedir());
}

export const AUTH_HEADERS: Record<string, string> = API_KEY
  ? { Authorization: `Bearer ${API_KEY}` }
  : {};

/** 工具元信息（供 README / 目录收录复用）。 */
export const SERVER_INFO = {
  name: 'ssave-media-extractor',
  version: '0.1.0',
} as const;
