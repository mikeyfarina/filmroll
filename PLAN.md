# dailies — Implementation Plan

Video-to-slideshow tool for AI review. Extracts meaningful frames from video files for Claude to analyze — as a CLI tool and MCP server.

Named after the film industry term for raw footage reviewed daily by the director.

---

## Phase 1: Project Scaffolding & ffmpeg Foundation

**Goal:** Working TypeScript project that can talk to ffmpeg and extract raw frames.

- [ ] `npm init` with package.json (name: `dailies`, bin entry, MIT license)
- [ ] tsconfig.json, .gitignore, LICENSE
- [ ] Install core deps: `fluent-ffmpeg`, `@types/fluent-ffmpeg`, `pngjs`, `sharp`, `commander`
- [ ] Install dev deps: `vitest`, `typescript`, `@types/node`
- [ ] `src/core/ffmpeg.ts` — ffmpeg wrapper:
  - Validate ffmpeg is installed (friendly error: "Install with: brew install ffmpeg")
  - Get video metadata (duration, resolution, fps)
  - Extract frames at a configurable rate to a temp directory
- [ ] `src/types.ts` — shared interfaces (ExtractOptions, ExtractResult, FrameInfo)
- [ ] Verify: can extract raw frames from a test video to a temp dir

**Deps:** fluent-ffmpeg, @types/fluent-ffmpeg, pngjs, @types/pngjs, sharp, commander, typescript, vitest, @types/node

---

## Phase 2: Extraction Strategies

**Goal:** Both frame extraction strategies working end-to-end.

- [ ] `src/core/strategies/interval.ts` — fixed-interval extraction:
  - Extract one frame every N seconds (default: 2s)
  - Return list of FrameInfo objects (path + timestamp)
- [ ] `src/core/strategies/diff.ts` — smart diff-based extraction:
  - Extract frames at a high rate (every 0.5s)
  - Compare consecutive frames using `pixelmatch`
  - Keep frames where pixel diff exceeds threshold (default: 0.05)
  - **Fallback:** if fewer than 3 frames detected, auto-switch to interval mode
  - Clean up discarded frames from temp dir
- [ ] Install: `pixelmatch`
- [ ] Unit tests:
  - Diff threshold logic (which frames to keep/discard)
  - Interval frame timing calculation
- [ ] Verify: diff mode extracts only visually distinct frames; falls back on static video

**Deps:** pixelmatch

---

## Phase 3: Preprocessing & Output Formats

**Goal:** Trim/resize support, both output formats (individual images + grid).

- [ ] `src/core/preprocessor.ts` — video preprocessing:
  - Trim: pass `--start` / `--end` to ffmpeg's `-ss` and `-to`
  - Resize: pass `--width` to ffmpeg's scale filter (maintains aspect ratio)
- [ ] `src/core/output/individual.ts` — individual image output:
  - Rename frames with timestamp-based names: `frame_00m05s.png`
  - When `--max-frames` is set, select evenly spaced frames from full set
- [ ] `src/core/output/grid.ts` — contact sheet grid:
  - Use `sharp` to composite frames into an NxM grid
  - Auto-calculate dimensions (√n rounded)
  - Small padding/border between frames
- [ ] Unit tests:
  - Timestamp formatting
  - Max-frames even-spacing logic
  - Grid dimension calculation
- [ ] Verify: trimmed/resized frames output correctly; grid image looks right

---

## Phase 4: Core Orchestrator & CLI

**Goal:** Working CLI tool users can run with `npx dailies input.mp4`.

- [ ] `src/core/extractor.ts` — orchestrator:
  - Wire together: preprocess → strategy → output
  - `extract(inputPath, options) → ExtractResult`
  - Progress callback for CLI progress bar
- [ ] `src/index.ts` — public API re-export
- [ ] `src/cli/index.ts` — CLI with commander:
  - All flags: `-o`, `-s`, `--every`, `--threshold`, `--grid`, `--individual`, `--start`, `--end`, `--width`, `--format`, `--max-frames`
  - Progress bar during extraction
  - Summary line: `✓ Extracted 8 frames to ./dailies-output`
  - Friendly error messages (no ffmpeg, bad file path, corrupt video)
- [ ] Build setup: compile TS → dist, bin entry points to compiled CLI
- [ ] Verify end-to-end:
  - `dailies test.mp4 -o ./out` (diff mode)
  - `dailies test.mp4 -o ./out --strategy interval --every 2`
  - `dailies test.mp4 -o ./out --grid --max-frames 8`
  - `dailies test.mp4 -o ./out --start 0:02 --end 0:10 --width 800`
  - Error cases: no ffmpeg, missing file, corrupt video

---

## Phase 5: MCP Server

**Goal:** Claude Code can invoke `review_video` tool to extract and review frames automatically.

- [ ] Install: `@modelcontextprotocol/sdk`
- [ ] `src/mcp/server.ts` — MCP server:
  - Tool: `review_video`
    - Inputs: videoPath (required), prompt (optional), strategy, maxFrames (default: 10), options (threshold, start, end, width, grid, keep)
    - Default prompt: "Review this UI recording and describe what you see happening step by step."
    - Extracts frames → reads as base64 → returns as image content blocks with prompt
    - Frames are evenly spaced across video duration by default
  - Cleanup: delete temp frames after returning by default
  - `keep: true` option saves frames to `~/.dailies/` instead
- [ ] Wire `--mcp` flag in CLI entry point to launch MCP server instead
- [ ] Verify:
  - Configure in Claude Code MCP settings
  - Invoke `review_video` with a video path + custom prompt
  - Confirm Claude receives images and responds with review
  - Confirm cleanup works (and `keep` preserves files)

**Deps:** @modelcontextprotocol/sdk

---

## Phase 6: Polish, README & GitHub

**Goal:** Open-source ready — published to GitHub with great docs.

- [ ] Initialize git repo, create GitHub remote
- [ ] README.md:
  - Hero section with animated GIF demo of CLI in action
  - Install instructions (`npm install -g dailies` / `npx dailies`)
  - Usage examples for CLI and MCP server
  - ffmpeg install instructions per platform
- [ ] CLAUDE.md for the repo
- [ ] Review `--help` output for clarity
- [ ] npm publish prep: package.json metadata (description, keywords, repository), .npmignore
- [ ] Push to GitHub
- [ ] Record the GIF demo

---

## Architecture Reference

```
dailies/
├── src/
│   ├── cli/
│   │   └── index.ts              # CLI entry point (commander)
│   ├── mcp/
│   │   └── server.ts             # MCP server entry point
│   ├── core/
│   │   ├── extractor.ts          # Frame extraction orchestrator
│   │   ├── strategies/
│   │   │   ├── interval.ts       # Fixed-interval extraction
│   │   │   └── diff.ts           # Smart diff-based extraction
│   │   ├── output/
│   │   │   ├── individual.ts     # Save as individual images
│   │   │   └── grid.ts           # Generate contact sheet grid
│   │   ├── preprocessor.ts       # Trim & resize logic
│   │   └── ffmpeg.ts             # ffmpeg wrapper utilities
│   ├── index.ts                  # Public API (shared by CLI + MCP)
│   └── types.ts                  # Shared types/interfaces
├── tests/
│   ├── diff.test.ts
│   ├── grid.test.ts
│   └── timestamp.test.ts
├── package.json
├── tsconfig.json
├── README.md
├── CLAUDE.md
├── LICENSE
└── .gitignore
```

## Key Design Decisions

- **Diff fallback:** If diff mode finds <3 meaningful frames (static video), auto-fallback to interval mode
- **MCP frame cap:** Default 10 frames, evenly spaced across duration — avoids overwhelming context
- **MCP cleanup:** Temp frames deleted after base64 return by default; `keep: true` saves to `~/.dailies/`
- **Same binary:** `dailies` runs CLI by default, `dailies --mcp` launches MCP server
- **Errors:** Friendly plain-text (e.g., "ffmpeg not found. Install with: brew install ffmpeg")
- **Platforms:** macOS + Linux only for initial release
- **No URL/stdin support:** Local files only — keep it simple
