import { unlink } from "node:fs/promises";
import { join } from "node:path";
import type { StrategyFn } from "../../types.ts";
import { extractSceneFrames } from "../ffmpeg.ts";
import { buildFrameInfoList, listFrameFiles } from "./frames.ts";
import { intervalStrategy } from "./interval.ts";

const MIN_KEPT_FRAMES = 3;

export const diffStrategy: StrategyFn = async (videoPath, outputDir, options, preprocess) => {
	const timestamps = await extractSceneFrames(videoPath, outputDir, options.threshold, preprocess);
	const files = await listFrameFiles(outputDir);

	if (files.length < MIN_KEPT_FRAMES) {
		await Promise.all(files.map((f) => unlink(join(outputDir, f))));
		return intervalStrategy(videoPath, outputDir, options, preprocess);
	}

	if (files.length !== timestamps.length) {
		throw new Error(
			`Frame count mismatch: ${String(files.length)} files but ${String(timestamps.length)} timestamps`,
		);
	}

	return buildFrameInfoList(outputDir, files, (i) => timestamps[i] ?? 0);
};
