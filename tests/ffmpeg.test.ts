import { describe, expect, test } from "bun:test";
import { extractFrames, parseFps, parseShowInfoTimestamps } from "../src/core/ffmpeg.ts";

describe("parseFps", () => {
	test("parses standard frame rate", () => {
		expect(parseFps("30000/1001")).toBeCloseTo(29.97, 1);
	});

	test("parses integer frame rate", () => {
		expect(parseFps("30/1")).toBe(30);
	});

	test("returns default for zero numerator", () => {
		expect(parseFps("0/1")).toBe(30);
	});

	test("returns default for zero denominator", () => {
		expect(parseFps("1/0")).toBe(30);
	});

	test("returns default for negative numerator", () => {
		expect(parseFps("-1/1")).toBe(30);
	});

	test("returns default for negative denominator", () => {
		expect(parseFps("30/-1")).toBe(30);
	});

	test("returns default for non-numeric input", () => {
		expect(parseFps("abc/def")).toBe(30);
	});

	test("returns default for missing denominator", () => {
		expect(parseFps("30")).toBe(30);
	});

	test("returns default for empty string", () => {
		expect(parseFps("")).toBe(30);
	});
});

describe("extractFrames", () => {
	test("throws on zero intervalSeconds", () => {
		expect(extractFrames("/fake.mp4", "/tmp", 0)).rejects.toThrow(
			"intervalSeconds must be positive",
		);
	});

	test("throws on negative intervalSeconds", () => {
		expect(extractFrames("/fake.mp4", "/tmp", -1)).rejects.toThrow(
			"intervalSeconds must be positive",
		);
	});
});

describe("parseShowInfoTimestamps", () => {
	test("parses pts_time from showinfo output", () => {
		const stderr = [
			"[Parsed_showinfo_1 @ 0x1234] n:   0 pts:      0 pts_time:0        pos:    1234 fmt:yuv420p",
			"[Parsed_showinfo_1 @ 0x1234] n:   1 pts:  15360 pts_time:5.12     pos:   56789 fmt:yuv420p",
			"[Parsed_showinfo_1 @ 0x1234] n:   2 pts:  30720 pts_time:10.24    pos:  112345 fmt:yuv420p",
		].join("\n");

		expect(parseShowInfoTimestamps(stderr)).toEqual([0, 5.12, 10.24]);
	});

	test("returns empty array for no matches", () => {
		const stderr = [
			"Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'input.mp4':",
			"  Duration: 00:01:00.00, start: 0.000000, bitrate: 5000 kb/s",
			"Stream #0:0: Video: h264, yuv420p, 1920x1080, 30 fps",
		].join("\n");

		expect(parseShowInfoTimestamps(stderr)).toEqual([]);
	});

	test("returns empty array for empty string", () => {
		expect(parseShowInfoTimestamps("")).toEqual([]);
	});

	test("ignores non-numeric pts_time values", () => {
		const stderr = [
			"[showinfo] n:0 pts_time:NaN extra stuff",
			"[showinfo] n:1 pts_time:3.5 extra stuff",
		].join("\n");

		expect(parseShowInfoTimestamps(stderr)).toEqual([3.5]);
	});

	test("handles mixed ffmpeg output with showinfo lines", () => {
		const stderr = [
			"ffmpeg version 6.0 Copyright (c) 2000-2023",
			"  configuration: --enable-gpl --enable-nonfree",
			"[Parsed_showinfo_1 @ 0xabc] n:   0 pts:0 pts_time:0 pos:0 fmt:yuv420p",
			"frame=    1 fps=0.0 q=-0.0 size=       0kB time=00:00:00.00",
			"[Parsed_showinfo_1 @ 0xabc] n:   1 pts:7680 pts_time:2.56 pos:12345 fmt:yuv420p",
			"frame=    2 fps=1.5 q=-0.0 size=     256kB time=00:00:02.56",
		].join("\n");

		expect(parseShowInfoTimestamps(stderr)).toEqual([0, 2.56]);
	});
});
