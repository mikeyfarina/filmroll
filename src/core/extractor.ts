import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { ExtractOptions, ExtractResult, FrameInfo } from "../types.ts";
import { getVideoMetadata, validateFfmpeg } from "./ffmpeg.ts";
import { outputGrid } from "./output/grid.ts";
import { outputIndividual } from "./output/individual.ts";
import { buildPreprocessArgs } from "./preprocessor.ts";
import { diffStrategy } from "./strategies/diff.ts";
import { intervalStrategy } from "./strategies/interval.ts";

export type ProgressCallback = (stage: string) => void;

async function extractFrames(
	inputPath: string,
	tempDir: string,
	options: ExtractOptions,
): Promise<FrameInfo[]> {
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
		return {
			frames: result.frames,
			gridPath: result.gridPath || undefined,
		};
	}
	return { frames: await outputIndividual(frames, options.maxFrames), gridPath: undefined };
}

async function copyToOutput(
	frames: FrameInfo[],
	outputDir: string,
	gridPath: string | undefined,
): Promise<OutputResult> {
	let finalGridPath = gridPath;
	if (gridPath) {
		finalGridPath = join(outputDir, "grid.png");
		await Bun.write(finalGridPath, Bun.file(gridPath));
	}

	const finalFrames = await Promise.all(
		frames.map(async (frame) => {
			const dest = join(outputDir, basename(frame.path));
			await Bun.write(dest, Bun.file(frame.path));
			return { ...frame, path: dest };
		}),
	);

	return { frames: finalFrames, gridPath: finalGridPath };
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

	onProgress?.("Extracting frames");
	const rawFrames = await extractFrames(inputPath, tempDir, options);

	await mkdir(options.outputDir, { recursive: true });

	onProgress?.("Processing output");
	const processed = await processOutput(rawFrames, tempDir, options);
	const output = await copyToOutput(processed.frames, options.outputDir, processed.gridPath);

	await rm(tempDir, { recursive: true, force: true });

	return {
		frames: output.frames,
		metadata,
		outputDir: options.outputDir,
		gridPath: output.gridPath,
		strategyUsed: options.strategy,
	};
}
