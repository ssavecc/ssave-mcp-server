/**
 * /open/v1 客户端封装（见 docs/open-api-contract.md §2）。
 *
 * 仅实现 MCP 工具需要的三个端点：extract / download / thumbnail。
 * 错误统一抛 SsaveApiError（保留 REST error.code 与 reset_at）。
 */

import { API_BASE_URL, AUTH_HEADERS } from './config.js';
import { SsaveApiError, parseErrorBody, toSsaveError } from './errors.js';

export type ExtractFormat = 'video' | 'audio';
export type DownloadType = 'hd' | 'watermark' | 'mp3';

export interface ExtractResult {
  id: string;
  platform: string;
  title?: string | null;
  author?: string | null;
  duration?: number | null;
  thumbnail?: string | null;
  formats: string[];
  download: Record<string, string>;
  expires_at: string;
}

export interface DownloadMeta {
  /** 远程文件名（Content-Disposition 解析，可能为空）。 */
  filename: string | null;
  /** 期望的 Content-Length（可能为空）。 */
  contentLength: number | null;
  contentType: string | null;
}

const TIMEOUT_MS = 120_000;

async function readJsonBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function throwForStatus(res: Response): Promise<never> {
  const body = await readJsonBody(res);
  throw parseErrorBody(res.status, body);
}

/**
 * POST /open/v1/extract
 */
export async function apiExtract(url: string, format: ExtractFormat): Promise<ExtractResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/open/v1/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADERS,
      },
      body: JSON.stringify({ url, format }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw toSsaveError(err);
  }
  if (!res.ok) await throwForStatus(res);
  try {
    return (await res.json()) as ExtractResult;
  } catch {
    throw new SsaveApiError(502, 'extract_failed', 'Invalid extract response');
  }
}

/**
 * GET /open/v1/download —— 返回 Response（调用方负责流式消费 / 落盘）。
 * 不直接返回 JSON，因为成功时是二进制流；失败时按错误信封抛错。
 */
export async function apiDownload(id: string, type: DownloadType): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(
      `${API_BASE_URL}/open/v1/download?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`,
      {
        headers: { Accept: 'application/octet-stream', ...AUTH_HEADERS },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
  } catch (err) {
    throw toSsaveError(err);
  }
  if (!res.ok) await throwForStatus(res);
  return res;
}

/**
 * GET /open/v1/thumbnail —— 返回 Response（调用方负责落盘）。
 */
export async function apiThumbnail(id: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(
      `${API_BASE_URL}/open/v1/thumbnail?id=${encodeURIComponent(id)}&type=thumb`,
      {
        headers: { Accept: 'image/*', ...AUTH_HEADERS },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
  } catch (err) {
    throw toSsaveError(err);
  }
  if (!res.ok) await throwForStatus(res);
  return res;
}

/** 从响应头解析下载元信息。 */
export function parseDownloadMeta(res: Response): DownloadMeta {
  const disposition = res.headers.get('Content-Disposition') ?? '';
  let filename: string | null = null;
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
  if (match) {
    try {
      filename = decodeURIComponent(match[1].replace(/^"|"$/g, ''));
    } catch {
      filename = match[1].replace(/^"|"$/g, '');
    }
  }
  const contentLength = res.headers.get('Content-Length');
  return {
    filename,
    contentLength: contentLength ? Number(contentLength) : null,
    contentType: res.headers.get('Content-Type'),
  };
}
