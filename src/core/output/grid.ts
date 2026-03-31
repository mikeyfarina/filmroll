import { unlink } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { FrameInfo } from "../../types.ts";
import { selectEvenlySpaced } from "./individual.ts";

const GRID_PADDING = 4;
const GRID_BORDER = 2;
const GRID_BACKGROUND = { r: 26, g: 26, b: 26 };

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
	const cellWidth = firstMeta.width;
	const cellHeight = firstMeta.height;

	if (cellWidth === undefined || cellHeight === undefined) {
		throw new Error(`Could not read dimensions from: ${selected[0]?.path}`);
	}

	const { cols, rows } = calculateGridDimensions(selected.length);

	const canvasWidth = cols * cellWidth + (cols - 1) * GRID_PADDING + 2 * GRID_BORDER;
	const canvasHeight = rows * cellHeight + (rows - 1) * GRID_PADDING + 2 * GRID_BORDER;

	const overlays: sharp.OverlayOptions[] = selected.map((frame, i) => {
		const col = i % cols;
		const row = Math.floor(i / cols);
		return {
			input: frame.path,
			left: GRID_BORDER + col * (cellWidth + GRID_PADDING),
			top: GRID_BORDER + row * (cellHeight + GRID_PADDING),
		};
	});

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
