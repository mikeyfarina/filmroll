#!/usr/bin/env bun
import { resolve } from "node:path";
import process from "node:process";
import { Command } from "commander";
import { extract } from "../core/extractor.ts";
import type { OutputFormat } from "../types.ts";
import { parsePositiveFloat, parsePositiveInt, parseTime } from "./parse.ts";

// --mcp must be intercepted before Commander parses, since MCP uses stdin/stdout
if (process.argv.includes("--mcp")) {
	const { startMcpServer } = await import("../mcp/server.ts");
	await startMcpServer();
	process.exit(0);
}

interface CliOptions {
	output: string;
	strategy: string;
	every: string;
	threshold: string;
	grid?: boolean;
	gridOnly?: boolean;
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

function resolveStrategy(opts: CliOptions): "diff" | "interval" {
	if (opts.strategy === "diff" || opts.strategy === "interval") {
		return opts.strategy;
	}
	eprintln(`Error: Unknown strategy "${opts.strategy}". Use "diff" or "interval".`);
	process.exit(1);
}

function resolveFormat(opts: CliOptions): OutputFormat {
	if (opts.format !== undefined) {
		if (opts.format !== "individual" && opts.format !== "grid") {
			eprintln(`Error: Unknown format "${opts.format}". Use "individual" or "grid".`);
			process.exit(1);
		}
		return opts.format;
	}
	if (opts.grid === true || opts.gridOnly === true) {
		return "grid";
	}
	return "individual";
}

const program: Command = new Command();

program
	.name("filmroll")
	.description("Extract meaningful frames from video files for AI review")
	.version("0.1.0")
	.argument("<input>", "path to video file")
	.option("-o, --output <dir>", "output directory", "./filmroll-output")
	.option("-s, --strategy <type>", "extraction strategy: diff or interval", "diff")
	.option("--every <seconds>", "seconds between frames (interval strategy)", "2")
	.option("--threshold <value>", "scene change threshold (diff strategy)", "0.3")
	.option("--grid", "output as contact sheet grid")
	.option("--grid-only", "output only the grid image (discard individual frames)")
	.option("--start <time>", "start time (H:MM:SS, M:SS, or seconds)")
	.option("--end <time>", "end time (H:MM:SS, M:SS, or seconds)")
	.option("--width <pixels>", "resize width (maintains aspect ratio)")
	.option("--max-frames <n>", "maximum number of frames to output")
	.option("--format <type>", "output format: individual or grid")
	.action(async (input: string, opts: CliOptions) => {
		const videoPath = resolve(input);
		const strategy = resolveStrategy(opts);
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
					gridOnly: opts.gridOnly === true,
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
