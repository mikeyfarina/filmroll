# filmroll

Video-to-slideshow tool: extracts meaningful frames from video files for AI review. CLI tool and MCP server.

## Stack

- **Runtime:** Bun (shell `$` for ffmpeg, `bun:test` for testing)
- **Language:** TypeScript (strict mode, `noUncheckedIndexedAccess`)
- **Linting:** Biome (tabs, double quotes, semicolons, all rules at error)
- **Dependencies:** sharp (image processing), commander (CLI)

## Commands

- `bun test` — run all tests
- `bun run dev <video> [flags]` — run CLI in dev mode
- `bun run build` — compile to dist/

## Conventions

- Use bun shell `$` for ffmpeg/ffprobe calls, not child_process
- Use `import type` for type-only imports (`verbatimModuleSyntax` enforced)
- Use `.ts` extensions in imports
- Prefer `!` (non-null assertion) over `as T` when the value is known to be defined
- Pure functions for anything testable; side effects only in top-level orchestrators
- Validate at system boundaries (user input, ffmpeg args) — don't over-validate internal calls
- Friendly error messages for user-facing failures (e.g., "ffmpeg not found. Install with: brew install ffmpeg")

## Architecture

- `src/core/ffmpeg.ts` — ffmpeg/ffprobe wrapper (validate, metadata, extract frames, scene detection)
- `src/core/strategies/` — extraction strategies (interval, diff with scene detection, shared frame utils)
- `src/core/preprocessor.ts` — builds ffmpeg trim/resize args from user options
- `src/core/output/` — output formatters (individual timestamp-named images, contact sheet grid)
- `src/types.ts` — shared interfaces
- `tests/` — unit tests for pure functions (no mocking of ffmpeg)
