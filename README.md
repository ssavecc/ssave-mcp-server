# @ssave/mcp-server

Model Context Protocol (MCP) server for [Ssave.cc](https://ssave.cc) — extract and download **TikTok / Instagram / YouTube / Douyin** media (HD video without watermark, MP3 audio) directly to your local disk.

Runs locally via stdio, backed by the [Ssave Open API](https://api.ssave.cc/docs) (`/open/v1`). No registration required on the free tier.

## Quick Start

```bash
npx @ssave/mcp-server
```

Then add it to your MCP client:

### Claude Code

```bash
claude mcp add ssave -- npx @ssave/mcp-server
```

Or project-level `.mcp.json`:

```json
{
  "mcpServers": {
    "ssave": { "command": "npx", "args": ["@ssave/mcp-server"] }
  }
}
```

### Cursor

Settings → MCP → Add new MCP server:

```json
{
  "mcpServers": {
    "ssave": {
      "command": "npx",
      "args": ["@ssave/mcp-server"]
    }
  }
}
```

### Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ssave": {
      "command": "npx",
      "args": ["@ssave/mcp-server"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `extract_media` | Extract metadata and available formats from a TikTok / Instagram / YouTube / Douyin URL. Returns an `ssv_` token (expires in 5–15 min) plus per-format download URLs. |
| `download_media` | Stream the extracted media to local disk (default `~/Downloads/ssave/`, override with `output_dir`). Returns the absolute path and size. |
| `get_thumbnail` | Save the media thumbnail to local disk (proxied — never exposes the source CDN link). |

Typical flow: `extract_media(url)` → take the returned `id` → `download_media(id, type: "hd" | "watermark" | "mp3")`.

## Environment Variables

All optional:

| Variable | Default | Description |
|----------|---------|-------------|
| `SSAVE_API_BASE_URL` | `https://api.ssave.cc` | Override for local development (e.g. `http://localhost:8000`). |
| `SSAVE_API_KEY` | — | Reserved for paid tier (Phase 3): sent as `Authorization: Bearer <key>`. |
| `SSAVE_OUTPUT_DIR` | `~/Downloads/ssave/` | Default output directory when `output_dir` is not passed. |

## Rate Limits (free tier)

Shared with the Ssave Open API, per IP per UTC day:

| Operation | Limit |
|-----------|-------|
| `extract` | 10 / day |
| `download` | 50 / day |

On `429 rate_limited` the tool reports the UTC reset time.

## Development

```bash
npm install
npm run dev        # run server on stdio (connect with MCP Inspector: npx @modelcontextprotocol/inspector)
npm test           # unit tests (mock fetch)
npm run build      # compile to dist/
```

## Legal

For personal archiving of content you have access to. Respect platform Terms of Service. No bulk downloading. See [ssave.cc/privacy](https://ssave.cc/en/privacy).

## License

MIT
