import sharp from "sharp";

export function formatLabel(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.round(seconds % 60);
	return `${String(m)}:${String(s).padStart(2, "0")}`;
}

function buildLabelSvg(text: string, imageWidth: number): Buffer {
	// Scale font size relative to image width
	const fontSize = Math.max(14, Math.round(imageWidth * 0.035));
	const paddingX = Math.round(fontSize * 0.6);
	const paddingY = Math.round(fontSize * 0.35);

	// Estimate text width (monospace-ish)
	const charWidth = fontSize * 0.62;
	const textWidth = Math.ceil(text.length * charWidth);

	const boxWidth = textWidth + paddingX * 2;
	const boxHeight = fontSize + paddingY * 2;

	const svg = `<svg width="${String(boxWidth)}" height="${String(boxHeight)}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${String(boxWidth)}" height="${String(boxHeight)}" rx="4" fill="rgba(0,0,0,0.7)"/>
  <text x="${String(paddingX)}" y="${String(paddingY + fontSize * 0.82)}"
    font-family="monospace" font-size="${String(fontSize)}" fill="white">${text}</text>
</svg>`;

	return Buffer.from(svg);
}

export async function burnTimestamp(imagePath: string, seconds: number): Promise<void> {
	const meta = await sharp(imagePath).metadata();
	if (meta.width === undefined || meta.height === undefined) {
		return;
	}

	const label = formatLabel(seconds);
	const svgBuf = buildLabelSvg(label, meta.width);
	const svgMeta = await sharp(svgBuf).metadata();
	const svgHeight = svgMeta.height ?? 30;

	const margin = Math.round(meta.width * 0.02);

	const buf = await sharp(imagePath)
		.composite([
			{
				input: svgBuf,
				left: margin,
				top: meta.height - svgHeight - margin,
			},
		])
		.png()
		.toBuffer();

	await sharp(buf).toFile(imagePath);
}
