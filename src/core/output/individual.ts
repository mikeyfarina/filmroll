import { rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FrameInfo } from "../../types.ts";
import { burnTimestamp } from "./label.ts";

export function formatTimestamp(seconds: number): string {
	const totalSeconds = Math.round(seconds);
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = totalSeconds % 60;
	if (h > 0) {
		return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
	}
	return `${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
}

export function selectEvenlySpaced<T>(items: T[], count: number): T[] {
	if (count <= 0) {
		return [];
	}
	if (count >= items.length) {
		return items;
	}
	if (count === 1) {
		const first = items[0];
		return first !== undefined ? [first] : [];
	}

	const result: T[] = [];
	for (let i = 0; i < count; i++) {
		const index = Math.round((i * (items.length - 1)) / (count - 1));
		const item = items[index];
		if (item !== undefined) {
			result.push(item);
		}
	}
	return result;
}

export async function outputIndividual(
	frames: FrameInfo[],
	maxFrames?: number,
): Promise<FrameInfo[]> {
	let selected = frames;
	if (maxFrames !== undefined && maxFrames < frames.length) {
		const kept = new Set(selectEvenlySpaced(frames, maxFrames));
		const toDelete: FrameInfo[] = [];
		const toKeep: FrameInfo[] = [];
		for (const f of frames) {
			if (kept.has(f)) {
				toKeep.push(f);
			} else {
				toDelete.push(f);
			}
		}
		await Promise.all(toDelete.map((f) => unlink(f.path)));
		selected = toKeep;
	}

	if (selected.length === 0) {
		return [];
	}

	const first = selected[0];
	if (!first) {
		return [];
	}
	const dir = dirname(first.path);
	const nameCount = new Map<string, number>();
	const renames: Array<{ frame: FrameInfo; newPath: string }> = [];

	for (const frame of selected) {
		const base = formatTimestamp(frame.timestamp);
		const count = nameCount.get(base) ?? 0;
		nameCount.set(base, count + 1);
		const suffix = count > 0 ? `_${String(count)}` : "";
		const newPath = join(dir, `frame_${base}${suffix}.png`);
		renames.push({ frame, newPath });
	}

	return Promise.all(
		renames.map(async ({ frame, newPath }) => {
			await burnTimestamp(frame.path, frame.timestamp);
			await rename(frame.path, newPath);
			return { ...frame, path: newPath };
		}),
	);
}
