/**
 * API 错误信封 → 结构化 MCP 工具错误。
 *
 * REST 契约见 docs/open-api-contract.md §2：错误信封统一为
 *   { "error": { "code": ..., "message": ..., "reset_at": ...? } }
 * MCP 层保留原始 error.code（供 AI 客户端分支处理），并附人类可读提示。
 */

export type ApiErrorCode =
  | 'invalid_url'
  | 'unsupported_platform'
  | 'validation_error'
  | 'rate_limited'
  | 'expired_or_invalid'
  | 'format_unavailable'
  | 'extract_failed'
  | 'upstream_unavailable';

export class SsaveApiError extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus: number;
  readonly resetAt?: string;

  constructor(httpStatus: number, code: ApiErrorCode, message: string, resetAt?: string) {
    super(message);
    this.name = 'SsaveApiError';
    this.httpStatus = httpStatus;
    this.code = code;
    this.resetAt = resetAt;
  }

  /** 面向 AI 客户端的提示文案（见 docs/mcp-contract.md §3）。 */
  toPrompt(): string {
    switch (this.code) {
      case 'invalid_url':
        return '不是合法 http(s) URL，请检查链接。';
      case 'unsupported_platform':
        return '仅支持 TikTok / Instagram / YouTube / Douyin。';
      case 'validation_error':
        return `参数不合法：${this.message}`;
      case 'rate_limited':
        return this.resetAt
          ? `免费额度已用尽，UTC ${this.resetAt} 后重试；或配置 SSAVE_API_KEY 提升额度。`
          : '免费额度已用尽，请稍后重试；或配置 SSAVE_API_KEY 提升额度。';
      case 'expired_or_invalid':
        return 'token 已过期，请先重新调用 extract_media。';
      case 'format_unavailable':
        return `该媒体没有这个格式（如 YouTube 通常无 watermark）：${this.message}`;
      case 'extract_failed':
        return `源站提取失败，稍后重试；连续失败可换 format 或链接。${this.message ? `（${this.message}）` : ''}`;
      case 'upstream_unavailable':
        return '服务暂不可用，稍后重试。';
      default:
        return this.message;
    }
  }
}

/** 把任意 fetch 异常归类为可提示的错误。 */
export function toSsaveError(err: unknown): SsaveApiError {
  if (err instanceof SsaveApiError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new SsaveApiError(0, 'upstream_unavailable', message);
}

/** 非 JSON 错误体时的状态码 → code 兜底映射（真实契约总是 JSON 信封，此处防御上游异常）。 */
const STATUS_FALLBACK: Record<number, ApiErrorCode> = {
  400: 'invalid_url',
  403: 'expired_or_invalid',
  404: 'format_unavailable',
  422: 'validation_error',
  429: 'rate_limited',
  502: 'extract_failed',
  503: 'upstream_unavailable',
};

/** 解析 REST 错误信封；非信封响应按状态码推断。 */
export function parseErrorBody(status: number, body: unknown): SsaveApiError {
  const error = (body as { error?: { code?: string; message?: string; reset_at?: string } })?.error;
  const code = (error?.code ?? STATUS_FALLBACK[status] ?? 'upstream_unavailable') as ApiErrorCode;
  const message = error?.message ?? `HTTP ${status}`;
  return new SsaveApiError(status, code, message, error?.reset_at);
}
