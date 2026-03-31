import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { ExtractOptions, ExtractResult, FrameInfo, StrategyResult } from "../types.ts";
import { getVideoMetadata, validateFfmpeg } from "./ffmpeg.ts";
import { outputGrid } from "./output/grid.ts";
import { outputIndividual } from "./output/individual.ts";
import { buildPreprocessArgs } from "./preprocessor.ts";
import { diffStrategy } from "./strategies/diff.ts";
import { intervalStrategy } from "./strategies/interval.ts";

export type ProgressCallback = (stage: string) => void;

function _offsetTimestamps(frames: FrameInfo[], startTime: number | undefined): FrameInfo[] {
	if (!startTime) {
		return frames;
	}
	return frames.map((f) => ({ ...f, timestamp: f.timestamp + startTime }));
}

async function _runStrategy(
	inputPath: string,
	tempDir: string,
	options: ExtractOptions,
): Promise<StrategyResult> {
	const preprocess = buildPreprocessArgs({
		start: options.start,
		end: options.end,
		width: options.width,
	});

	const strategyOpts = { every: options.every, threshold: options.threshold };

	if (options.strategy === "diff") {
		return diffStrategy(inputPath, tempDir, strategyOpts, preprocess);
	}
	return intervalStrategy(inputPath, tempDir, strategyOpts, preprocess);
}

interface OutputResult {
	frames: FrameInfo[];
	gridPath: string | undefined;
}

async function processOutput(
	frames: FrameInfo[],
	tempDir: string,
	options: ExtractOptions,
): Promise<OutputResult> {
	if (options.format === "grid") {
		const result = await outputGrid(frames, tempDir, options.maxFrames);
		return { frames: result.frames, gridPath: result.gridPath };
	}
	return { frames: await outputIndividual(frames, options.maxFrames), gridPath: undefined };
}

export async function extract(
	inputPath: string,
	options: ExtractOptions,
	onProgress?: ProgressCallback,
): Promise<ExtractResult> {
	onProgress?.("Validating ffmpeg");
	await validateFfmpeg();

	onProgress?.("Reading video metadata");
	const metadata = await getVideoMetadata(inputPath);

	const tempDir = join(tmpdir(), `dailies-${Date.now()}`);
	await mkdir(tempDir, { recursive: true });

	try {
		onProgress?.("Extracting frames");
		const { frames: rawFrames, strategyUsed } = await _runStrategy(inputPath, tempDir, options);
		const frames = _offsetTimestamps(rawFrames, options.start);

		await mkdir(options.outputDir, { recursive: true });

		onProgress?.("Processing output");
		const processed = await processOutput(frames, tempDir, options);

		let finalFrames: FrameInfo[];
		let finalGridPath: string | undefined;

		if (options.format === "grid" && processed.gridPath) {
			const dest = join(options.outputDir, "grid.png");
			await Bun.write(dest, Bun.file(processed.gridPath));
			finalGridPath = dest;
			finalFrames = processed.frames;
		} else {
			finalFrames = await Promise.all(
				processed.frames.map(async (frame) => {
					const dest = join(options.outputDir, basename(frame.path));
					await Bun.write(dest, Bun.file(frame.path));
					return { ...frame, path: dest };
				}),
			);
		}

		return {
			frames: finalFrames,
			metadata,
			outputDir: options.outputDir,
			gridPath: finalGridPath,
			strategyUsed,
		};
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
}
