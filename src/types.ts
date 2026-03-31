export interface FrameInfo {
	/** Absolute path to the extracted frame image */
	path: string;
	/** Timestamp in seconds from the start of the video */
	timestamp: number;
	/** Frame index (0-based) */
	index: number;
}

export interface VideoMetadata {
	/** Duration in seconds */
	duration: number;
	/** Width in pixels */
	width: number;
	/** Height in pixels */
	height: number;
	/** Frames per second */
	fps: number;
	/** Video codec name */
	codec: string;
}

export type ExtractionStrategy = "diff" | "interval";
export type OutputFormat = "individual" | "grid";

export const DEFAULTS = {
	strategy: "diff" as ExtractionStrategy,
	every: 2,
	threshold: 0.3,
	maxFrames: 10,
} as const;

export interface ExtractOptions {
	/** Output directory for extracted frames */
	outputDir: string;
	/** Extraction strategy */
	strategy: ExtractionStrategy;
	/** Seconds between frames for interval strategy */
	every: number;
	/** Pixel diff threshold for diff strategy (0-1) */
	threshold: number;
	/** Output format */
	format: OutputFormat;
	/** Maximum number of frames to output */
	maxFrames: number | undefined;
	/** Start time in seconds */
	start: number | undefined;
	/** End time in seconds */
	end: number | undefined;
	/** Resize width (maintains aspect ratio) */
	width: number | undefined;
}

export interface ExtractResult {
	/** Extracted frames */
	frames: FrameInfo[];
	/** Video metadata */
	metadata: VideoMetadata;
	/** Output directory */
	outputDir: string;
	/** Path to grid image if grid format was used */
	gridPath: string | undefined;
	/** Strategy that was actually used (may differ from requested if fallback occurred) */
	strategyUsed: ExtractionStrategy;
}

export interface PreprocessArgs {
	/** Extra args to place before -i (e.g., ["-ss", "5"]) */
	inputArgs: string[];
	/** Extra filter fragments to append to -vf (e.g., ["scale=800:-1"]) */
	filterFragments: string[];
	/** Extra args to place after -i (e.g., ["-t", "8"]) */
	outputArgs: string[];
}

export interface StrategyOptions {
	/** Seconds between frames for interval strategy */
	every: number;
	/** Pixel diff threshold for diff strategy (0-1) */
	threshold: number;
}

export interface StrategyResult {
	frames: FrameInfo[];
	strategyUsed: ExtractionStrategy;
}

export type StrategyFn = (
	videoPath: string,
	outputDir: string,
	options: StrategyOptions,
	preprocess?: PreprocessArgs,
) => Promise<StrategyResult>;
