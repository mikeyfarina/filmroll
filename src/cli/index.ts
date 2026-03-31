#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { Command } from "commander";
import { extract } from "../core/extractor.ts";
import { startMcpServer } from "../mcp/server.ts";
import type { ExtractionStrategy, OutputFormat } from "../types.ts";

if (process.argv.includes("--mcp")) {
	await startMcpServer();
	process.exit(0);
}

interface CliOptions {
	output: string;
	strategy: string;
	every: string;
	threshold: string;
	grid?: boolean;
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
	const parts = value.split(":");
	if (parts.length === 3) {
		const hours = Number.parseInt(parts[0] ?? "", 10);
		const minutes = Number.parseInt(parts[1] ?? "", 10);
		const seconds = Number.parseInt(parts[2] ?? "", 10);
		if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) {
			throw new Error(`Invalid time format: "${value}". Use H:MM:SS, M:SS, or seconds.`);
		}
		return hours * 3600 + minutes * 60 + seconds;
	}
	if (parts.length === 2) {
		const minutes = Number.parseInt(parts[0] ?? "", 10);
		const seconds = Number.parseInt(parts[1] ?? "", 10);
		if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
			throw new Error(`Invalid time format: "${value}". Use H:MM:SS, M:SS, or seconds.`);
		}
		return minutes * 60 + seconds;
	}
	const n = Number.parseFloat(value);
	if (Number.isNaN(n)) {
		throw new Error(`Invalid time format: "${value}". Use H:MM:SS, M:SS, or seconds.`);
	}
	return n;
}

function parsePositiveFloat(value: string, name: string): number {
	const n = Number.parseFloat(value);
	if (Number.isNaN(n) || n <= 0) {
		throw new Error(`--${name} must be a positive number, got "${value}".`);
	}
	return n;
}

function parsePositiveInt(value: string, name: string): number {
	const n = Number.parseInt(value, 10);
	if (Number.isNaN(n) || n <= 0) {
		throw new Error(`--${name} must be a positive integer, got "${value}".`);
	}
	return n;
}

function resolveFormat(opts: CliOptions): OutputFormat {
	if (opts.format !== undefined) {
		if (opts.format !== "individual" && opts.format !== "grid") {
			eprintln(`Error: Unknown format "${opts.format}". Use "individual" or "grid".`);
			process.exit(1);
		}
		return opts.format;
	}
	if (opts.grid === true) {
		return "grid";
	}
	return "individual";
}

const program: Command = new Command();

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
	.option("--start <time>", "start time (H:MM:SS, M:SS, or seconds)")
	.option("--end <time>", "end time (H:MM:SS, M:SS, or seconds)")
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

		const format = resolveFormat(opts);

		try {
			const every = parsePositiveFloat(opts.every, "every");
			const threshold = parsePositiveFloat(opts.threshold, "threshold");
			const maxFrames = opts.maxFrames ? parsePositiveInt(opts.maxFrames, "max-frames") : undefined;
			const width = opts.width ? parsePositiveInt(opts.width, "width") : undefined;

			const result = await extract(
				videoPath,
				{
					outputDir: resolve(opts.output),
					strategy,
					every,
					threshold,
					format,
					maxFrames,
					start: opts.start ? parseTime(opts.start) : undefined,
					end: opts.end ? parseTime(opts.end) : undefined,
					width,
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
