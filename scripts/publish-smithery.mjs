#!/usr/bin/env node
/**
 * Publish the Ssave MCP server to Smithery with FULL tool metadata.
 *
 * Why not `npx @smithery/cli mcp publish`?
 *   The CLI forwards the MCPB manifest's `tools` verbatim into the registry
 *   ServerCard, but the MCPB schema forbids `inputSchema` on tool entries
 *   while Smithery's ServerCard requires it — so the CLI can never carry
 *   real tool schemas (smithery-ai/smithery-cli#787, #770, #797, #805).
 *   This script talks to the multipart release API directly and supplies a
 *   complete ServerCard, which drives Smithery's capability-quality score
 *   (descriptions / parameter descriptions / output schemas / annotations).
 *
 * Usage:
 *   node scripts/publish-smithery.mjs ssave/tiktok-instagram-downloader
 *
 * API key resolution (first match):
 *   1. $SMITHERY_API_KEY
 *   2. $SMITHERY_CONFIG_PATH/settings.json  (same file the CLI uses)
 *   3. Platform default settings.json: macOS ~/Library/Application Support/smithery,
 *      Windows %APPDATA%/smithery, Linux ~/.config/smithery
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const API_BASE = process.env.SMITHERY_BASE_URL ?? 'https://api.smithery.ai';
const BUNDLE_PATH = process.argv[3] ?? 'ssave-mcp-server.mcpb';
const QUALIFIED_NAME = process.argv[2];

if (!QUALIFIED_NAME) {
  console.error('Usage: node scripts/publish-smithery.mjs <namespace/server> [bundle.mcpb]');
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* API key resolution                                                 */
/* ------------------------------------------------------------------ */

async function resolveApiKey() {
  if (process.env.SMITHERY_API_KEY) return process.env.SMITHERY_API_KEY;

  let configDir;
  if (process.env.SMITHERY_CONFIG_PATH) {
    configDir = process.env.SMITHERY_CONFIG_PATH;
  } else if (process.platform === 'win32') {
    configDir = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'smithery');
  } else if (process.platform === 'darwin') {
    configDir = path.join(os.homedir(), 'Library', 'Application Support', 'smithery');
  } else {
    configDir = path.join(os.homedir(), '.config', 'smithery');
  }

  const settingsPath = path.join(configDir, 'settings.json');
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
      if (settings.apiKey) return settings.apiKey;
    } catch {
      /* fall through */
    }
  }
  throw new Error(
    `No API key found. Set SMITHERY_API_KEY, or run "smithery auth login" first ` +
    `(settings.json looked for at ${settingsPath}).`,
  );
}

/* ------------------------------------------------------------------ */
/* Tool metadata (mirrors src/tools/*.ts)                             */
/* ------------------------------------------------------------------ */

const tools = [
  {
    name: 'extract_media',
    title: '查看视频信息',
    description:
      '粘贴 TikTok、Instagram、YouTube 或抖音的视频链接，帮你提取视频信息，并准备好可下载的高清无水印视频或 MP3 音频。',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '要下载的视频链接（支持 TikTok、Instagram、YouTube、抖音）',
        },
        format: {
          type: 'string',
          enum: ['video', 'audio'],
          description: '想要的内容：视频或音频（默认视频）',
        },
      },
      required: ['url'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '下载凭证，之后用它来下载视频' },
        platform: { type: 'string', description: '视频来自哪个平台' },
        title: { type: ['string', 'null'], description: '视频标题' },
        author: { type: ['string', 'null'], description: '作者名称' },
        duration: { type: ['number', 'null'], description: '视频时长（秒）' },
        thumbnail: { type: ['string', 'null'], description: '封面图地址' },
        formats: { type: 'array', items: { type: 'string' }, description: '可用的清晰度格式' },
        download: { type: 'object', additionalProperties: { type: 'string' }, description: '各格式的下载地址' },
        expires_at: { type: 'string', description: '下载凭证过期时间，过期后需要重新提取' },
      },
      required: ['id', 'platform', 'formats', 'download', 'expires_at'],
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  {
    name: 'download_media',
    title: '下载到本地',
    description:
      '把视频或音频保存到你的电脑本地文件夹（默认是「下载」文件夹里的 ssave 目录）。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '提取视频信息后得到的下载凭证' },
        type: {
          type: 'string',
          enum: ['hd', 'watermark', 'mp3'],
          description: '下载格式：高清无水印 / 带水印 / MP3 音频（默认高清无水印）',
        },
        output_dir: {
          type: 'string',
          description: '保存位置，留空则保存到默认文件夹',
        },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        saved_to: { type: 'string', description: '文件保存的完整路径' },
        filename: { type: 'string', description: '文件名' },
        size_bytes: { type: 'number', description: '文件大小（字节）' },
        content_type: { type: 'string', description: '文件类型' },
      },
      required: ['saved_to', 'filename', 'size_bytes', 'content_type'],
    },
    annotations: { openWorldHint: true },
  },
  {
    name: 'get_thumbnail',
    title: '保存封面图',
    description: '把视频的封面图保存到你的电脑本地。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '提取视频信息后得到的下载凭证' },
        output_dir: { type: 'string', description: '保存位置，留空则保存到默认文件夹' },
      },
      required: ['id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        saved_to: { type: 'string', description: '文件保存的完整路径' },
        filename: { type: 'string', description: '文件名' },
        size_bytes: { type: 'number', description: '文件大小（字节）' },
        content_type: { type: 'string', description: '文件类型' },
      },
      required: ['saved_to', 'filename', 'size_bytes', 'content_type'],
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
];

/* ------------------------------------------------------------------ */
/* Publish                                                            */
/* ------------------------------------------------------------------ */

async function main() {
  const apiKey = await resolveApiKey();
  const manifest = JSON.parse(await readFile('manifest.json', 'utf-8'));

  const payload = {
    type: 'stdio',
    runtime: 'node',
    serverCard: {
      serverInfo: {
        name: manifest.name,
        title: 'Ssave 视频下载助手',
        version: manifest.version,
        description: manifest.description,
        websiteUrl: manifest.homepage,
      },
      tools,
    },
  };

  if (!existsSync(BUNDLE_PATH)) {
    throw new Error(`Bundle not found: ${BUNDLE_PATH}`);
  }

  const bundleBlob = new Blob([await readFile(BUNDLE_PATH)], {
    type: 'application/octet-stream',
  });
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  form.append('bundle', bundleBlob, path.basename(BUNDLE_PATH));

  const url = `${API_BASE}/servers/${QUALIFIED_NAME}/releases`;
  console.log(`Publishing ${QUALIFIED_NAME} (stdio, node) with full tool metadata...`);
  console.log(`  tools: ${tools.map((t) => t.name).join(', ')}`);

  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`✗ ${res.status} ${body}`);
    process.exit(1);
  }

  const data = JSON.parse(body);
  console.log('✓ Release accepted');
  console.log(`  Release ID:  ${data.deploymentId}`);
  console.log(`  Status:      ${data.status}`);
  console.log(`  MCP URL:     ${data.mcpUrl}`);
  console.log(`  Server page: https://smithery.ai/servers/${QUALIFIED_NAME}`);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
