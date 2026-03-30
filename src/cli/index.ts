#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { Command } from "commander";
import { extract } from "../core/extractor.ts";
import type { ExtractionStrategy, OutputFormat } from "../types.ts";

interface CliOptions {
	output: string;
	strategy: string;
	every: string;
	threshold: string;
	grid?: boolean;
	individual?: boolean;
	start?: string;
	end?: string;
	width?: string;
	maxFrames?: string;
	format?: string;
}

function println(message: string): void {
	process.stdout.write(`${message}\n`);
}

function eprintln(message: string): void {
	process.stderr.write(`${message}\n`);
}

function parseTime(value: string): number {
	// Support "M:SS" or raw seconds
	const parts = value.split(":");
	if (parts.length === 2) {
		const minutes = Number.parseInt(parts[0] ?? "", 10);
		const seconds = Number.parseInt(parts[1] ?? "", 10);
		if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
			throw new Error(`Invalid time format: "${value}". Use M:SS or seconds.`);
		}
		return minutes * 60 + seconds;
	}
	const n = Number.parseFloat(value);
	if (Number.isNaN(n)) {
		throw new Error(`Invalid time format: "${value}". Use M:SS or seconds.`);
	}
	return n;
}

const program = new Command();

program
	.name("dailies")
	.description("Extract meaningful frames from video files for AI review")
	.version("0.1.0")
	.argument("<input>", "path to video file")
	.option("-o, --output <dir>", "output directory", "./dailies-output")
	.option("-s, --strategy <type>", "extraction strategy: diff or interval", "diff")
	.option("--every <seconds>", "seconds between frames (interval strategy)", "2")
	.option("--threshold <value>", "scene change threshold (diff strategy)", "0.3")
	.option("--grid", "output as contact sheet grid")
	.option("--individual", "output as individual images (default)")
	.option("--start <time>", "start time (M:SS or seconds)")
	.option("--end <time>", "end time (M:SS or seconds)")
	.option("--width <pixels>", "resize width (maintains aspect ratio)")
	.option("--max-frames <n>", "maximum number of frames to output")
	.option("--format <type>", "output format: individual or grid")
	.action(async (input: string, opts: CliOptions) => {
		const videoPath = resolve(input);
		if (!existsSync(videoPath)) {
			eprintln(`Error: File not found: ${videoPath}`);
			process.exit(1);
		}

		const strategy = opts.strategy as ExtractionStrategy;
		if (strategy !== "diff" && strategy !== "interval") {
			eprintln(`Error: Unknown strategy "${strategy}". Use "diff" or "interval".`);
			process.exit(1);
		}

		let format: OutputFormat = "individual";
		if (opts.format === "grid" || opts.grid === true) {
			format = "grid";
		}

		try {
			const result = await extract(
				videoPath,
				{
					outputDir: resolve(opts.output),
					strategy,
					every: Number.parseFloat(opts.every),
					threshold: Number.parseFloat(opts.threshold),
					format,
					maxFrames: opts.maxFrames ? Number.parseInt(opts.maxFrames, 10) : undefined,
					start: opts.start ? parseTime(opts.start) : undefined,
					end: opts.end ? parseTime(opts.end) : undefined,
					width: opts.width ? Number.parseInt(opts.width, 10) : undefined,
				},
				(stage) => {
					process.stdout.write(`\r  ${stage}...`);
				},
			);

			// Clear progress line
			process.stdout.write("\r\x1b[K");

			if (result.gridPath) {
				println(`Extracted ${String(result.frames.length)} frames → ${result.gridPath}`);
			} else {
				println(`Extracted ${String(result.frames.length)} frames → ${result.outputDir}`);
			}
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			eprintln(`Error: ${message}`);
			process.exit(1);
		}
	});

program.parse();
