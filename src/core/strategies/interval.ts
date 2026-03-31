import type { StrategyFn } from "../../types.ts";
import { extractFrames } from "../ffmpeg.ts";
import { buildFrameInfoList, listFrameFiles } from "./frames.ts";

export const intervalStrategy: StrategyFn = async (videoPath, outputDir, options, preprocess) => {
	await extractFrames(videoPath, outputDir, options.every, preprocess);
	const files = await listFrameFiles(outputDir);
	return {
		frames: buildFrameInfoList(outputDir, files, (i) => i * options.every),
		strategyUsed: "interval",
	};
};
