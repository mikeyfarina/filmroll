# dailies — Implementation Plan

Video-to-slideshow tool for AI review. Extracts meaningful frames from video files for Claude to analyze — as a CLI tool and MCP server.

Named after the film industry term for raw footage reviewed daily by the director.

---

## Phase 1: Project Scaffolding & ffmpeg Foundation

**Goal:** Working TypeScript project that can talk to ffmpeg and extract raw frames.

- [x] `npm init` with package.json (name: `dailies`, bin entry, MIT license)
- [x] tsconfig.json, .gitignore, LICENSE
- [x] Install core deps: `sharp`, `commander` (using bun shell `$` instead of fluent-ffmpeg)
- [x] Install dev deps: `typescript`, `bun-types`, `@biomejs/biome` (bun test instead of vitest)
- [x] `src/core/ffmpeg.ts` — ffmpeg wrapper:
  - Validate ffmpeg is installed (friendly error: "Install with: brew install ffmpeg")
  - Get video metadata (duration, resolution, fps)
  - Extract frames at a configurable rate to a temp directory
  - Scene detection via ffmpeg's `select=gt(scene,threshold)` filter
- [x] `src/types.ts` — shared interfaces (ExtractOptions, ExtractResult, FrameInfo, StrategyFn)
- [x] Verify: can extract raw frames from a test video to a temp dir

**Deps:** sharp, commander, typescript, bun-types, @biomejs/biome

---

## Phase 2: Extraction Strategies

**Goal:** Both frame extraction strategies working end-to-end.

- [x] `src/core/strategies/interval.ts` — fixed-interval extraction:
  - Extract one frame every N seconds (default: 2s)
  - Return list of FrameInfo objects (path + timestamp)
- [x] `src/core/strategies/diff.ts` — smart diff-based extraction:
  - Uses ffmpeg scene detection (`select=gt(scene,threshold)`) instead of pixelmatch
  - **Fallback:** if fewer than 3 frames detected, auto-switch to interval mode
  - Clean up discarded frames from temp dir
- [x] `src/core/strategies/frames.ts` — shared frame file listing & FrameInfo builder
- [x] Unit tests: `tests/ffmpeg.test.ts`, `tests/interval.test.ts`
- [x] Verify: diff mode extracts only visually distinct frames; falls back on static video

**Deps:** none (uses ffmpeg scene detection instead of pixelmatch)

---

## Phase 3: Preprocessing & Output Formats

**Goal:** Trim/resize support, both output formats (individual images + grid).

- [x] `src/core/preprocessor.ts` — build ffmpeg flags for trim/resize:
  - Trim: build `-ss` and `-t` args from `--start` / `--end` options
  - Resize: build `-vf scale=W:-1` filter from `--width` option
  - Validates `end > start` (throws on invalid range)
  - Pass flags into existing `extractFrames` / `extractSceneFrames` calls via `PreprocessArgs`
- [x] `src/core/output/individual.ts` — individual image output:
  - Rename frames with timestamp-based names: `frame_00m05s.png`
  - When `--max-frames` is set, select evenly spaced frames from full set
  - Handles duplicate timestamps with `_1`, `_2` suffixes
  - Deletes unselected frames from disk
- [x] `src/core/output/grid.ts` — contact sheet grid:
  - Use `sharp` to composite frames into an NxM grid
  - Auto-calculate dimensions (√n rounded)
  - Small padding/border between frames
  - Empty input guard (returns early instead of crashing)
- [x] Unit tests: `tests/output.test.ts`
  - Timestamp formatting, max-frames even-spacing logic, grid dimension calculation
  - Preprocessor args building (including invalid range validation)
- [x] Hardened `src/core/ffmpeg.ts`:
  - `parseFps` rejects zero/negative numerator (prevents downstream division-by-zero)
  - `getVideoMetadata` wraps ffprobe call in try/catch with clear error
  - Duration validation requires `> 0` (rejects zero-length/corrupt videos)
  - `extractFrames` validates `intervalSeconds > 0` and checks ffmpeg exit code
  - `parseVideoStream` rejects missing/invalid width/height instead of defaulting to 0
- [x] Unit tests: `tests/ffmpeg.test.ts`
  - `parseFps` edge cases (zero, negative, non-numeric, missing parts)
  - `extractFrames` validation (zero/negative interval)
- [ ] Verify: trimmed/resized frames output correctly; grid image looks right

---

## Phase 4: Core Orchestrator & CLI

**Goal:** Working CLI tool users can run with `bun run dev input.mp4` (or `dailies` after build).

- [x] `src/core/extractor.ts` — orchestrator:
  - Wire together: preprocess → strategy → output
  - `extract(inputPath, options) → ExtractResult`
  - Progress callback for CLI progress bar
- [x] `src/index.ts` — public API re-export
- [x] `src/cli/index.ts` — CLI with commander:
  - All flags: `-o`, `-s`, `--every`, `--threshold`, `--grid`, `--individual`, `--start`, `--end`, `--width`, `--format`, `--max-frames`
  - Progress bar during extraction
  - Summary line: `✓ Extracted 8 frames to ./dailies-output`
  - Friendly error messages (no ffmpeg, bad file path, corrupt video)
- [x] Build setup: `bun build` to dist, bin entry points to compiled CLI
- [ ] Verify end-to-end:
  - `bun run dev test.mp4 -o ./out` (diff mode)
  - `bun run dev test.mp4 -o ./out --strategy interval --every 2`
  - `bun run dev test.mp4 -o ./out --grid --max-frames 8`
  - `bun run dev test.mp4 -o ./out --start 0:02 --end 0:10 --width 800`
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
  - Install instructions (`bun add -g dailies` / `npm install -g dailies`)
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
│   │   │   ├── diff.ts           # Smart diff-based extraction (ffmpeg scene detection)
│   │   │   └── frames.ts         # Shared frame file listing & FrameInfo builder
│   │   ├── output/
│   │   │   ├── individual.ts     # Save as individual images
│   │   │   └── grid.ts           # Generate contact sheet grid
│   │   ├── preprocessor.ts       # Build ffmpeg flags for trim & resize
│   │   └── ffmpeg.ts             # ffmpeg/ffprobe wrapper (bun shell $)
│   ├── index.ts                  # Public API (shared by CLI + MCP)
│   └── types.ts                  # Shared types/interfaces
├── tests/
│   ├── ffmpeg.test.ts            # parseFps, extractFrames validation, parseShowInfoTimestamps tests
│   ├── interval.test.ts          # filterFrameFiles & buildFrameInfoList tests
│   └── output.test.ts            # formatTimestamp, selectEvenlySpaced, calculateGridDimensions, buildPreprocessArgs tests
├── package.json
├── tsconfig.json
├── README.md
├── CLAUDE.md
├── LICENSE
└── .gitignore
```

## Key Design Decisions

- **Runtime:** Bun — uses bun shell `$` for ffmpeg calls, `bun:test` for testing, biome for linting
- **Scene detection:** ffmpeg's `select=gt(scene,threshold)` filter with showinfo — no pixelmatch dependency
- **Diff fallback:** If scene detection finds <3 frames (static video), auto-fallback to interval mode
- **MCP frame cap:** Default 10 frames, evenly spaced across duration — avoids overwhelming context
- **MCP cleanup:** Temp frames deleted after base64 return by default; `keep: true` saves to `~/.dailies/`
- **Same binary:** `dailies` runs CLI by default, `dailies --mcp` launches MCP server
- **Errors:** Friendly plain-text (e.g., "ffmpeg not found. Install with: brew install ffmpeg")
- **Platforms:** macOS + Linux only for initial release
- **No URL/stdin support:** Local files only — keep it simple
