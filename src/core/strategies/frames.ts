import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { FrameInfo } from "../../types.ts";

export function filterFrameFiles(filenames: string[]): string[] {
	return filenames.filter((f) => f.startsWith("frame_") && f.endsWith(".png")).sort();
}

export async function listFrameFiles(dir: string): Promise<string[]> {
	const files = await readdir(dir);
	return filterFrameFiles(files);
}

export function buildFrameInfoList(
	outputDir: string,
	filenames: string[],
	getTimestamp: (index: number) => number,
): FrameInfo[] {
	return filenames.map((filename, index) => ({
		path: join(outputDir, filename),
		timestamp: getTimestamp(index),
		index,
	}));
}
