import { readFile, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { extract } from "../core/extractor.ts";
import { getVideoMetadata } from "../core/ffmpeg.ts";
import type { ExtractResult, OutputFormat } from "../types.ts";
import { DEFAULTS, MAX_DURATION_SECONDS, MAX_FRAMES_HARD_CAP, MAX_WIDTH } from "../types.ts";

const DEFAULT_PROMPT = "Review the extracted frames and describe what you see.";

const SERVER_INSTRUCTIONS = `filmroll extracts key frames from video files for visual analysis.

When to use: If the user references or provides a video file (.mp4, .mov, .webm, .avi, .mkv, .gif), use the review_video tool to extract frames and analyze the content.

Strategy guidance:
- Use "diff" (scene detection) by default. It finds visually meaningful moments and skips dead space — best for most videos.
- Only use "interval" when the user specifically asks for regular time-based sampling (e.g., "show me a frame every 2 seconds").

Output guidance:
- Use grid: true for quick overviews or when the user wants a summary view.
- Use individual frames (the default) when detailed analysis of each moment matters.
- The default of 10 max frames works for most videos. For longer videos (>2 min), consider increasing to 20-30.`;
const MAX_FRAMES_LIMIT = MAX_FRAMES_HARD_CAP;
const MIN_INTERVAL_SECONDS = 0.1;

type McpContent =
	| { type: "text"; text: string }
	| { type: "image"; data: string; mimeType: string };

function mcpError(text: string): { content: [{ type: "text"; text: string }]; isError: true } {
	return { content: [{ type: "text" as const, text }], isError: true };
}

async function validateVideoPath(videoPath: string): Promise<string | undefined> {
	try {
		const info = await stat(videoPath);
		if (!info.isFile()) {
			return `Error: Not a regular file: ${videoPath}`;
		}
	} catch {
		return `Error: File not found: ${videoPath}`;
	}
	return;
}

async function buildImageContent(result: ExtractResult): Promise<McpContent[]> {
	if (result.gridPath) {
		const data = await readFile(result.gridPath);
		return [{ type: "image", data: data.toString("base64"), mimeType: "image/png" }];
	}

	const images: McpContent[] = [];
	for (const frame of result.frames) {
		const data = await readFile(frame.path);
		images.push({ type: "image", data: data.toString("base64"), mimeType: "image/png" });
	}
	return images;
}

function buildSummary(result: ExtractResult, videoPath: string): string {
	const { frames, metadata } = result;
	return `Extracted ${String(frames.length)} frames from ${videoPath} (${metadata.duration.toFixed(1)}s, ${String(metadata.width)}x${String(metadata.height)})`;
}

const toolSchema = {
	videoPath: z.string().describe("Absolute path to the video file"),
	prompt: z.string().optional().describe("Prompt to include with the frames"),
	strategy: z.enum(["diff", "interval"]).optional().describe("Extraction strategy (default: diff)"),
	maxFrames: z
		.number()
		.int()
		.positive()
		.max(MAX_FRAMES_LIMIT)
		.optional()
		.describe(
			`Maximum number of frames to return (default: ${String(DEFAULTS.maxFrames)}, max: ${String(MAX_FRAMES_LIMIT)})`,
		),
	every: z
		.number()
		.min(MIN_INTERVAL_SECONDS)
		.optional()
		.describe(
			`Seconds between frames for interval strategy (default: ${String(DEFAULTS.every)}, min: ${String(MIN_INTERVAL_SECONDS)})`,
		),
	threshold: z
		.number()
		.min(0)
		.max(1)
		.optional()
		.describe("Scene change threshold for diff strategy (default: 0.3)"),
	start: z.number().min(0).optional().describe("Start time in seconds"),
	end: z.number().min(0).optional().describe("End time in seconds"),
	width: z
		.number()
		.int()
		.positive()
		.max(MAX_WIDTH)
		.optional()
		.describe(`Resize width in pixels (max: ${String(MAX_WIDTH)})`),
	grid: z
		.boolean()
		.optional()
		.describe("Output as contact sheet grid instead of individual frames"),
	gridOnly: z
		.boolean()
		.optional()
		.describe("Output only the grid image, discard individual frames (implies grid)"),
	keep: z
		.boolean()
		.optional()
		.describe("Save frames to ~/.filmroll/ instead of deleting after return"),
};

type ReviewVideoInput = z.infer<z.ZodObject<typeof toolSchema>>;

function resolveOutputDir(keep: boolean): string {
	if (keep) {
		return join(homedir(), ".filmroll", `review-${Date.now()}`);
	}
	return join(tmpdir(), `filmroll-mcp-${Date.now()}`);
}

async function validateInput(input: ReviewVideoInput): Promise<string | undefined> {
	const pathError = await validateVideoPath(input.videoPath);
	if (pathError) {
		return pathError;
	}

	if (input.start !== undefined && input.end !== undefined && input.end <= input.start) {
		return "Error: end time must be greater than start time.";
	}

	const metadata = await getVideoMetadata(input.videoPath);
	if (metadata.duration > MAX_DURATION_SECONDS) {
		return `Error: Video duration ${metadata.duration.toFixed(0)}s exceeds maximum of ${String(MAX_DURATION_SECONDS)}s (${String(MAX_DURATION_SECONDS / 3600)}h). Trim with --start/--end.`;
	}

	return;
}

async function handleReviewVideo(input: ReviewVideoInput) {
	const validationError = await validateInput(input);
	if (validationError) {
		return mcpError(validationError);
	}

	const { videoPath, keep } = input;
	const format: OutputFormat = input.grid || input.gridOnly ? "grid" : "individual";
	const outputDir = resolveOutputDir(keep ?? false);

	try {
		const result = await extract(videoPath, {
			outputDir,
			strategy: input.strategy ?? DEFAULTS.strategy,
			every: input.every ?? DEFAULTS.every,
			threshold: input.threshold ?? DEFAULTS.threshold,
			format,
			maxFrames: input.maxFrames ?? DEFAULTS.maxFrames,
			start: input.start,
			end: input.end,
			width: input.width,
			gridOnly: input.gridOnly ?? false,
		});

		const prompt = input.prompt ?? DEFAULT_PROMPT;
		const images = await buildImageContent(result);
		const content: McpContent[] = [
			{ type: "text", text: prompt },
			...images,
			{ type: "text", text: buildSummary(result, videoPath) },
		];

		return { content };
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return mcpError(`Error: ${message}`);
	} finally {
		if (!keep) {
			// Best-effort cleanup — don't fail the MCP response if temp dir removal fails
			await rm(outputDir, { recursive: true, force: true }).catch(() => {});
		}
	}
}

export async function startMcpServer(): Promise<void> {
	const server = new McpServer({
		name: "filmroll",
		version: "0.1.0",
		instructions: SERVER_INSTRUCTIONS,
	});

	server.tool(
		"review_video",
		"Extract key frames from a video file and return them as images for visual analysis. Automatically finds visually meaningful moments using scene detection. Use when a user shares or references a video file.",
		toolSchema,
		handleReviewVideo,
	);

	const transport = new StdioServerTransport();
	await server.connect(transport);
}
