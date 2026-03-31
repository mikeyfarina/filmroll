import { unlink } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { FrameInfo } from "../../types.ts";
import { selectEvenlySpaced } from "./individual.ts";
import { buildLabelSvg, formatLabel } from "./label.ts";

const GRID_PADDING = 12;
const GRID_BORDER = 12;
const GRID_BACKGROUND = { r: 40, g: 40, b: 40 };
const GRID_TARGET_WIDTH = 1920;
const BATCH_SIZE = 10;

export function calculateGridDimensions(n: number): { cols: number; rows: number } {
	if (n <= 0) {
		return { cols: 0, rows: 0 };
	}
	const cols = Math.ceil(Math.sqrt(n));
	const rows = Math.ceil(n / cols);
	return { cols, rows };
}

interface CellLayout {
	cols: number;
	cellWidth: number;
	cellHeight: number;
}

async function buildOverlays(
	frames: FrameInfo[],
	layout: CellLayout,
): Promise<sharp.OverlayOptions[]> {
	const { cols, cellWidth, cellHeight } = layout;
	const overlays: sharp.OverlayOptions[] = [];

	for (let start = 0; start < frames.length; start += BATCH_SIZE) {
		const batch = frames.slice(start, start + BATCH_SIZE);
		const batchResults = await Promise.all(
			batch.map(async (frame, batchIdx) => {
				const i = start + batchIdx;
				const col = i % cols;
				const row = Math.floor(i / cols);

				const label = formatLabel(frame.timestamp);
				const svgBuf = buildLabelSvg(label, cellWidth);
				const svgMeta = await sharp(svgBuf).metadata();
				const svgHeight = svgMeta.height ?? 30;
				const margin = Math.round(cellWidth * 0.02);

				const buf = await sharp(frame.path)
					.resize(cellWidth, cellHeight)
					.composite([{ input: svgBuf, left: margin, top: cellHeight - svgHeight - margin }])
					.png()
					.toBuffer();

				return {
					input: buf,
					left: GRID_BORDER + col * (cellWidth + GRID_PADDING),
					top: GRID_BORDER + row * (cellHeight + GRID_PADDING),
				};
			}),
		);
		overlays.push(...batchResults);
	}

	return overlays;
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

	const chromeWidth = (cols - 1) * GRID_PADDING + 2 * GRID_BORDER;
	const cellWidth = Math.round((GRID_TARGET_WIDTH - chromeWidth) / cols);
	const cellHeight = Math.round(cellWidth * (firstMeta.height / firstMeta.width));

	const canvasWidth = cols * cellWidth + chromeWidth;
	const canvasHeight = rows * cellHeight + (rows - 1) * GRID_PADDING + 2 * GRID_BORDER;

	const overlays = await buildOverlays(selected, { cols, cellWidth, cellHeight });

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
