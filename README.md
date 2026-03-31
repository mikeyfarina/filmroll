# filmroll

Turn video files into frames for Claude. Extract meaningful stills from any video — using scene detection or fixed intervals — and feed them directly to Claude as visual context.

Works as a **CLI tool** or as an **MCP server** for Claude Code.

## Prerequisites

- [Bun](https://bun.sh) runtime
- [ffmpeg](https://ffmpeg.org) installed and on your PATH

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg
```

## Install

```bash
# npm
npm install -g filmroll

# bun
bun add -g filmroll
```

Or run without installing:

```bash
bunx filmroll ./video.mp4
npx filmroll ./video.mp4
```

## CLI Usage

```bash
filmroll <video> [options]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <dir>` | Output directory | `./filmroll-output` |
| `-s, --strategy <type>` | `diff` (scene detection) or `interval` | `diff` |
| `--every <seconds>` | Seconds between frames (interval strategy) | `2` |
| `--threshold <value>` | Scene change sensitivity 0-1 (diff strategy) | `0.3` |
| `--grid` | Output as a single contact sheet image | |
| `--format <type>` | `individual` or `grid` | `individual` |
| `--start <time>` | Start time (`H:MM:SS`, `M:SS`, or seconds) | |
| `--end <time>` | End time (`H:MM:SS`, `M:SS`, or seconds) | |
| `--width <pixels>` | Resize width (maintains aspect ratio) | |
| `--max-frames <n>` | Maximum number of frames to extract | |
| `--mcp` | Launch as MCP server instead of CLI | |

### Examples

```bash
# Scene detection (default) — picks visually distinct frames
filmroll ./recording.mp4

# Fixed interval — one frame every 5 seconds
filmroll ./recording.mp4 -s interval --every 5

# Trim to a section, resize, output as contact sheet
filmroll ./recording.mp4 --start 1:30 --end 3:00 --width 800 --grid

# Cap at 20 frames, custom output dir
filmroll ./recording.mp4 --max-frames 20 -o ./my-frames
```

## Extraction Strategies

### `diff` (default)

Uses ffmpeg's scene detection to find frames where the visual content actually changes. Best for UI recordings, presentations, or any video with distinct scenes. If fewer than 3 scene changes are detected (e.g. a mostly static video), automatically falls back to interval mode.

Lower `--threshold` = more sensitive (more frames). Higher = less sensitive (fewer frames).

### `interval`

Extracts one frame every N seconds. Simple and predictable. Use `--every` to control the interval.

## MCP Server (Claude Code)

filmroll includes an MCP server that lets Claude extract and view video frames directly.

### Setup

Add to your Claude Code MCP config (`~/.claude.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "filmroll": {
      "command": "bunx",
      "args": ["filmroll", "--mcp"]
    }
  }
}
```

### Tool: `review_video`

Once configured, Claude has access to a `review_video` tool that accepts:

| Parameter | Type | Description |
|-----------|------|-------------|
| `videoPath` | string | **Required.** Absolute path to the video file |
| `prompt` | string | Prompt to include with the frames |
| `strategy` | `"diff"` \| `"interval"` | Extraction strategy (default: `diff`) |
| `maxFrames` | number | Max frames to return (default: 10, max: 200) |
| `every` | number | Seconds between frames for interval strategy |
| `threshold` | number | Scene change threshold for diff strategy (0-1) |
| `start` | number | Start time in seconds |
| `end` | number | End time in seconds |
| `width` | number | Resize width in pixels |
| `grid` | boolean | Return as a single contact sheet image |
| `keep` | boolean | Save frames to `~/.filmroll/` instead of cleaning up |

By default, extracted frames are returned as base64 images in the MCP response and temp files are cleaned up. Use `keep: true` to persist frames to disk.

## Output Formats

### Individual (default)

Saves each frame as a separate PNG named by its timestamp:

```
filmroll-output/
  frame_00m00s.png
  frame_00m05s.png
  frame_00m12s.png
```

### Grid

Combines all frames into a single contact sheet image — useful for getting a quick overview or staying within image count limits:

```
filmroll-output/
  grid.png
```

## Development

```bash
bun install
bun run dev ./video.mp4          # run in dev mode
bun test                          # run tests
bun run build                     # compile to dist/
```

## License

MIT
