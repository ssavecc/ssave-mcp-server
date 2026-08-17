#!/usr/bin/env node
/**
 * Ssave MCP Server —— 入口。
 *
 * 通过 stdio 与 MCP 客户端（Claude Code / Cursor / Claude Desktop）通信，
 * 暴露 extract_media / download_media / get_thumbnail 三个工具。
 * 底层调用 https://api.ssave.cc/open/v1/*（见 docs/mcp-contract.md）。
 *
 * 运行：npx @ssave/mcp-server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SERVER_INFO } from './config.js';
import { SsaveApiError, toSsaveError } from './errors.js';
import { downloadMedia, downloadSchema } from './tools/download.js';
import { extractMedia, extractSchema } from './tools/extract.js';
import { getThumbnail, thumbnailSchema } from './tools/thumbnail.js';

/** 把工具回调的异常统一为结构化 MCP 错误（isError: true，保留 error.code）。 */
function asMcpError(err: unknown): {
  content: { type: 'text'; text: string }[];
  isError: true;
  structuredContent?: Record<string, unknown>;
} {
  const apiErr = toSsaveError(err);
  const base = {
    content: [{ type: 'text' as const, text: apiErr.toPrompt() }],
    isError: true as const,
  };
  return {
    ...base,
    structuredContent: {
      error: {
        code: apiErr.code,
        http_status: apiErr.httpStatus,
        message: apiErr.message,
        ...(apiErr.resetAt ? { reset_at: apiErr.resetAt } : {}),
      },
    },
  };
}

const server = new McpServer({
  name: SERVER_INFO.name,
  version: SERVER_INFO.version,
});

server.registerTool(
  'extract_media',
  {
    title: 'Extract media metadata from a link',
    description:
      '从 TikTok / Instagram / YouTube / Douyin 链接提取媒体元数据与可下载格式，返回 ssv_ token（5–15 分钟过期）与各格式下载 URL。',
    inputSchema: extractSchema,
  },
  async (args) => {
    try {
      const result = await extractMedia(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return asMcpError(err);
    }
  },
);

server.registerTool(
  'download_media',
  {
    title: 'Download extracted media to local disk',
    description:
      '把 extract_media 返回的媒体流式下载到本地磁盘（默认 ~/Downloads/ssave/），返回绝对路径与大小。token 过期（5–15 分钟）时请先重新 extract_media。',
    inputSchema: downloadSchema,
  },
  async (args) => {
    try {
      const result = await downloadMedia(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return asMcpError(err);
    }
  },
);

server.registerTool(
  'get_thumbnail',
  {
    title: 'Download media thumbnail to local disk',
    description:
      '把 extract_media 返回的封面图落盘（经 Ssave 代理，不暴露 IG/Douyin 源站直链）。',
    inputSchema: thumbnailSchema,
  },
  async (args) => {
    try {
      const result = await getThumbnail(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return asMcpError(err);
    }
  },
);

// 启动 stdio transport；连接错误打印到 stderr（不污染 stdout 协议通道）
const transport = new StdioServerTransport();
await server.connect(transport);
