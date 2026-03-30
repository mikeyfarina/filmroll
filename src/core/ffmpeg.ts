import { $ } from "bun";
import type { PreprocessArgs, VideoMetadata } from "../types.ts";

const DEFAULT_FPS = 30;

type ParsedVideoStream = Omit<VideoMetadata, "duration">;

export function parseFps(frameRate: string): number {
	const [numerator, denominator] = frameRate.split("/");
	if (numerator === undefined || denominator === undefined) {
		return DEFAULT_FPS;
	}
	const num = Number.parseFloat(numerator);
	const den = Number.parseFloat(denominator);
	if (!(Number.isFinite(num) && Number.isFinite(den)) || num <= 0 || den <= 0) {
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
	const width = extractNumber(stream, "width");
	const height = extractNumber(stream, "height");
	if (width === undefined || height === undefined || width <= 0 || height <= 0) {
		return;
	}
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
	let result: string;
	try {
		result =
			await $`ffprobe -v quiet -select_streams v:0 -print_format json -show_format -show_streams -- ${videoPath}`
				.quiet()
				.text();
	} catch (error: unknown) {
		throw new Error(`Failed to read video file: ${videoPath}`, { cause: error });
	}

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
	if (!Number.isFinite(duration) || duration <= 0) {
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

function resolvePreprocess(preprocess?: PreprocessArgs) {
	return {
		inputArgs: preprocess?.inputArgs ?? [],
		filterFragments: preprocess?.filterFragments ?? [],
		outputArgs: preprocess?.outputArgs ?? [],
	};
}

export async function extractFrames(
	videoPath: string,
	outputDir: string,
	intervalSeconds: number,
	preprocess?: PreprocessArgs,
): Promise<void> {
	if (intervalSeconds <= 0) {
		throw new Error(`intervalSeconds must be positive, got ${String(intervalSeconds)}`);
	}
	const { inputArgs, filterFragments, outputArgs } = resolvePreprocess(preprocess);
	const vf = [`fps=1/${intervalSeconds}`, ...filterFragments].join(",");
	const result =
		await $`ffmpeg -y ${inputArgs} -i ${videoPath} ${outputArgs} -vf ${vf} -loglevel error -- ${outputDir}/frame_%04d.png`
			.quiet()
			.nothrow();
	if (result.exitCode !== 0) {
		throw new Error(`ffmpeg frame extraction failed for: ${videoPath}`);
	}
}

export function parseShowInfoTimestamps(stderr: string): number[] {
	const timestamps: number[] = [];
	const regex = /pts_time:([\d.]+)/gu;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(stderr)) !== null) {
		if (match[1] !== undefined) {
			const time = Number.parseFloat(match[1]);
			if (Number.isFinite(time)) {
				timestamps.push(time);
			}
		}
	}
	return timestamps;
}

export async function extractSceneFrames(
	videoPath: string,
	outputDir: string,
	threshold: number,
	preprocess?: PreprocessArgs,
): Promise<number[]> {
	const { inputArgs, filterFragments, outputArgs } = resolvePreprocess(preprocess);
	const vf = [`select=gt(scene\\,${String(threshold)})`, ...filterFragments, "showinfo"].join(",");
	const result =
		await $`ffmpeg -y -nostats ${inputArgs} -i ${videoPath} ${outputArgs} -vf ${vf} -vsync vfr -- ${outputDir}/frame_%04d.png`
			.quiet()
			.nothrow();

	if (result.exitCode !== 0) {
		throw new Error(`ffmpeg scene detection failed for: ${videoPath}`);
	}

	return parseShowInfoTimestamps(result.stderr.toString());
}
