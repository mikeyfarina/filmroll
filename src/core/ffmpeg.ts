import { $ } from "bun";
import type { VideoMetadata } from "../types.ts";

const DEFAULT_FPS = 30;

type ParsedVideoStream = Omit<VideoMetadata, "duration">;

function parseFps(frameRate: string): number {
	const [numerator, denominator] = frameRate.split("/");
	if (numerator === undefined || denominator === undefined) {
		return DEFAULT_FPS;
	}
	const num = Number.parseFloat(numerator);
	const den = Number.parseFloat(denominator);
	if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) {
		return DEFAULT_FPS;
	}
	return num / den;
}

function extractString(obj: object, key: string): string | undefined {
	if (!(key in obj)) {
		return;
	}
	const val = (obj as Record<string, unknown>)[key];
	if (typeof val !== "string") {
		return;
	}
	return val;
}

function extractNumber(obj: object, key: string): number | undefined {
	if (!(key in obj)) {
		return;
	}
	const val = (obj as Record<string, unknown>)[key];
	if (typeof val !== "number") {
		return;
	}
	return val;
}

function isVideoStream(stream: unknown): stream is object {
	return (
		typeof stream === "object" && stream !== null && extractString(stream, "codec_type") === "video"
	);
}

function parseVideoStream(streams: unknown[]): ParsedVideoStream | undefined {
	const stream = streams.find(isVideoStream);
	if (stream === undefined) {
		return;
	}
	const width = extractNumber(stream, "width") ?? 0;
	const height = extractNumber(stream, "height") ?? 0;
	const codec = extractString(stream, "codec_name") ?? "unknown";
	const frameRateRaw = extractString(stream, "r_frame_rate");
	let fps = DEFAULT_FPS;
	if (frameRateRaw !== undefined) {
		fps = parseFps(frameRateRaw);
	}
	return { width, height, fps, codec };
}

export async function validateFfmpeg(): Promise<void> {
	try {
		await $`ffmpeg -version`.quiet();
	} catch (error: unknown) {
		throw new Error("ffmpeg not found. Install with: brew install ffmpeg", { cause: error });
	}
	try {
		await $`ffprobe -version`.quiet();
	} catch (error: unknown) {
		throw new Error("ffprobe not found. Install with: brew install ffmpeg", { cause: error });
	}
}

export async function getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
	const result =
		await $`ffprobe -v quiet -select_streams v:0 -print_format json -show_format -show_streams -- ${videoPath}`
			.quiet()
			.text();

	let parsed: unknown;
	try {
		parsed = JSON.parse(result);
	} catch (error: unknown) {
		throw new Error(`Failed to read video metadata: ${videoPath}`, { cause: error });
	}

	if (typeof parsed !== "object" || parsed === null) {
		throw new Error(`Unexpected ffprobe output for: ${videoPath}`);
	}

	if (!("streams" in parsed && Array.isArray(parsed.streams))) {
		throw new Error(`No streams found in ffprobe output for: ${videoPath}`);
	}

	if (!("format" in parsed) || typeof parsed.format !== "object" || parsed.format === null) {
		throw new Error(`No format found in ffprobe output for: ${videoPath}`);
	}

	const videoStream = parseVideoStream(parsed.streams);
	if (videoStream === undefined) {
		throw new Error(`No video stream found in: ${videoPath}`);
	}

	const durationStr = extractString(parsed.format, "duration");
	if (durationStr === undefined) {
		throw new Error(`Could not determine video duration: ${videoPath}`);
	}

	const duration = Number.parseFloat(durationStr);
	if (!Number.isFinite(duration)) {
		throw new Error(`Invalid video duration "${durationStr}" in: ${videoPath}`);
	}

	return {
		duration,
		width: videoStream.width,
		height: videoStream.height,
		fps: videoStream.fps,
		codec: videoStream.codec,
	};
}

export async function extractFrames(
	videoPath: string,
	outputDir: string,
	intervalSeconds: number,
): Promise<void> {
	const fpsFilter = `fps=1/${intervalSeconds}`;
	await $`ffmpeg -y -i ${videoPath} -vf ${fpsFilter} -loglevel error -- ${outputDir}/frame_%04d.png`.quiet();
}
