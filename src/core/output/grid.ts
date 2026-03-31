import { unlink } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { FrameInfo } from "../../types.ts";
import { selectEvenlySpaced } from "./individual.ts";

const GRID_PADDING = 12;
const GRID_BORDER = 12;
const GRID_BACKGROUND = { r: 40, g: 40, b: 40 };
const GRID_TARGET_WIDTH = 1920;

export function calculateGridDimensions(n: number): { cols: number; rows: number } {
	if (n <= 0) {
		return { cols: 0, rows: 0 };
	}
	const cols = Math.ceil(Math.sqrt(n));
	const rows = Math.ceil(n / cols);
	return { cols, rows };
}

export async function outputGrid(
	frames: FrameInfo[],
	outputDir: string,
	maxFrames?: number,
): Promise<{ frames: FrameInfo[]; gridPath: string | undefined }> {
	let selected = frames;
	if (maxFrames !== undefined && maxFrames < frames.length) {
		selected = selectEvenlySpaced(frames, maxFrames);
		const kept = new Set(selected);
		await Promise.all(frames.filter((f) => !kept.has(f)).map((f) => unlink(f.path)));
	}

	if (selected.length === 0) {
		return { frames: selected, gridPath: undefined };
	}

	const firstMeta = await sharp(selected[0]?.path).metadata();
	if (firstMeta.width === undefined || firstMeta.height === undefined) {
		throw new Error(`Could not read dimensions from: ${selected[0]?.path}`);
	}

	const { cols, rows } = calculateGridDimensions(selected.length);

	// Scale cells so the full grid targets GRID_TARGET_WIDTH
	const chromeWidth = (cols - 1) * GRID_PADDING + 2 * GRID_BORDER;
	const cellWidth = Math.round((GRID_TARGET_WIDTH - chromeWidth) / cols);
	const cellHeight = Math.round(cellWidth * (firstMeta.height / firstMeta.width));

	const canvasWidth = cols * cellWidth + chromeWidth;
	const canvasHeight = rows * cellHeight + (rows - 1) * GRID_PADDING + 2 * GRID_BORDER;

	const { burnTimestamp } = await import("./label.ts");
	await Promise.all(selected.map((frame) => burnTimestamp(frame.path, frame.timestamp)));

	const overlays: sharp.OverlayOptions[] = await Promise.all(
		selected.map(async (frame, i) => {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const buf = await sharp(frame.path).resize(cellWidth, cellHeight).png().toBuffer();
			return {
				input: buf,
				left: GRID_BORDER + col * (cellWidth + GRID_PADDING),
				top: GRID_BORDER + row * (cellHeight + GRID_PADDING),
			};
		}),
	);

	const gridPath = join(outputDir, "grid.png");

	await sharp({
		create: {
			width: canvasWidth,
			height: canvasHeight,
			channels: 3,
			background: GRID_BACKGROUND,
		},
	})
		.composite(overlays)
		.png()
		.toFile(gridPath);

	return { frames: selected, gridPath };
}
