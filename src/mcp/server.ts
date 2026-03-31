import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { extract } from "../core/extractor.ts";
import type { ExtractionStrategy, ExtractResult, OutputFormat } from "../types.ts";

const DEFAULT_PROMPT = "Review this UI recording and describe what you see happening step by step.";
const DEFAULT_MAX_FRAMES = 10;

type McpContent =
	| { type: "text"; text: string }
	| { type: "image"; data: string; mimeType: string };

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

interface ReviewVideoInput {
	videoPath: string;
	prompt: string | undefined;
	strategy: "diff" | "interval" | undefined;
	maxFrames: number | undefined;
	every: number | undefined;
	threshold: number | undefined;
	start: number | undefined;
	end: number | undefined;
	width: number | undefined;
	grid: boolean | undefined;
	keep: boolean | undefined;
}

function resolveOutputDir(keep: boolean): string {
	if (keep) {
		return join(homedir(), ".dailies", `review-${Date.now()}`);
	}
	return join(tmpdir(), `dailies-mcp-${Date.now()}`);
}

async function handleReviewVideo(input: ReviewVideoInput) {
	const { videoPath, keep } = input;

	if (!existsSync(videoPath)) {
		return {
			content: [{ type: "text" as const, text: `Error: File not found: ${videoPath}` }],
			isError: true,
		};
	}

	const format: OutputFormat = input.grid ? "grid" : "individual";
	const outputDir = resolveOutputDir(keep ?? false);

	try {
		const result = await extract(videoPath, {
			outputDir,
			strategy: (input.strategy ?? "diff") as ExtractionStrategy,
			every: input.every ?? 2,
			threshold: input.threshold ?? 0.3,
			format,
			maxFrames: input.maxFrames ?? DEFAULT_MAX_FRAMES,
			start: input.start,
			end: input.end,
			width: input.width,
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
		return {
			content: [{ type: "text" as const, text: `Error: ${message}` }],
			isError: true,
		};
	} finally {
		if (!keep) {
			await rm(outputDir, { recursive: true, force: true }).catch(() => {});
		}
	}
}

const toolSchema = {
	videoPath: z.string().describe("Absolute path to the video file"),
	prompt: z.string().optional().describe("Prompt to include with the frames"),
	strategy: z.enum(["diff", "interval"]).optional().describe("Extraction strategy (default: diff)"),
	maxFrames: z
		.number()
		.int()
		.positive()
		.optional()
		.describe("Maximum number of frames to return (default: 10)"),
	every: z
		.number()
		.positive()
		.optional()
		.describe("Seconds between frames for interval strategy (default: 2)"),
	threshold: z
		.number()
		.min(0)
		.max(1)
		.optional()
		.describe("Scene change threshold for diff strategy (default: 0.3)"),
	start: z.number().min(0).optional().describe("Start time in seconds"),
	end: z.number().min(0).optional().describe("End time in seconds"),
	width: z.number().int().positive().optional().describe("Resize width in pixels"),
	grid: z
		.boolean()
		.optional()
		.describe("Output as contact sheet grid instead of individual frames"),
	keep: z
		.boolean()
		.optional()
		.describe("Save frames to ~/.dailies/ instead of deleting after return"),
};

export async function startMcpServer(): Promise<void> {
	const server = new McpServer({ name: "dailies", version: "0.1.0" });

	server.tool(
		"review_video",
		"Extract frames from a video file and return them as images for review",
		toolSchema,
		handleReviewVideo,
	);

	const transport = new StdioServerTransport();
	await server.connect(transport);
}
