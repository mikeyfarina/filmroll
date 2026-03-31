import { describe, expect, test } from "bun:test";
import { calculateGridDimensions } from "../src/core/output/grid.ts";
import { formatTimestamp, selectEvenlySpaced } from "../src/core/output/individual.ts";
import { buildPreprocessArgs } from "../src/core/preprocessor.ts";

describe("formatTimestamp", () => {
	test("formats zero seconds", () => {
		expect(formatTimestamp(0)).toBe("00m00s");
	});

	test("formats seconds under a minute", () => {
		expect(formatTimestamp(5)).toBe("00m05s");
	});

	test("formats exactly one minute", () => {
		expect(formatTimestamp(60)).toBe("01m00s");
	});

	test("formats minutes and seconds", () => {
		expect(formatTimestamp(65.3)).toBe("01m05s");
	});

	test("formats timestamps over an hour", () => {
		expect(formatTimestamp(3661)).toBe("01h01m01s");
	});

	test("formats exactly one hour", () => {
		expect(formatTimestamp(3600)).toBe("01h00m00s");
	});

	test("formats multi-hour timestamp", () => {
		expect(formatTimestamp(5400)).toBe("01h30m00s");
	});

	test("rounds fractional seconds up", () => {
		expect(formatTimestamp(5.7)).toBe("00m06s");
	});

	test("rounds sub-second timestamp to zero", () => {
		expect(formatTimestamp(0.4)).toBe("00m00s");
	});
});

describe("selectEvenlySpaced", () => {
	const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

	test("returns empty for count 0", () => {
		expect(selectEvenlySpaced(items, 0)).toEqual([]);
	});

	test("returns empty for negative count", () => {
		expect(selectEvenlySpaced(items, -1)).toEqual([]);
	});

	test("returns first item for count 1", () => {
		expect(selectEvenlySpaced(items, 1)).toEqual([0]);
	});

	test("returns first and last for count 2", () => {
		expect(selectEvenlySpaced(items, 2)).toEqual([0, 9]);
	});

	test("selects evenly from 10 items, count 3", () => {
		expect(selectEvenlySpaced(items, 3)).toEqual([0, 5, 9]);
	});

	test("selects evenly from 10 items, count 4", () => {
		expect(selectEvenlySpaced(items, 4)).toEqual([0, 3, 6, 9]);
	});

	test("returns all when count equals length", () => {
		expect(selectEvenlySpaced(items, 10)).toEqual(items);
	});

	test("returns all when count exceeds length", () => {
		expect(selectEvenlySpaced(items, 15)).toEqual(items);
	});
});

describe("calculateGridDimensions", () => {
	test("0 frames", () => {
		expect(calculateGridDimensions(0)).toEqual({ cols: 0, rows: 0 });
	});

	test("1 frame", () => {
		expect(calculateGridDimensions(1)).toEqual({ cols: 1, rows: 1 });
	});

	test("4 frames — perfect square", () => {
		expect(calculateGridDimensions(4)).toEqual({ cols: 2, rows: 2 });
	});

	test("5 frames", () => {
		expect(calculateGridDimensions(5)).toEqual({ cols: 3, rows: 2 });
	});

	test("8 frames", () => {
		expect(calculateGridDimensions(8)).toEqual({ cols: 3, rows: 3 });
	});

	test("9 frames — perfect square", () => {
		expect(calculateGridDimensions(9)).toEqual({ cols: 3, rows: 3 });
	});

	test("10 frames", () => {
		expect(calculateGridDimensions(10)).toEqual({ cols: 4, rows: 3 });
	});

	test("16 frames — perfect square", () => {
		expect(calculateGridDimensions(16)).toEqual({ cols: 4, rows: 4 });
	});
});

describe("buildPreprocessArgs", () => {
	test("returns empty args when no options", () => {
		const result = buildPreprocessArgs({});
		expect(result).toEqual({ inputArgs: [], filterFragments: [], outputArgs: [] });
	});

	test("builds -ss for start time", () => {
		const result = buildPreprocessArgs({ start: 5 });
		expect(result.inputArgs).toEqual(["-ss", "5"]);
		expect(result.filterFragments).toEqual([]);
		expect(result.outputArgs).toEqual([]);
	});

	test("builds -t for end time only", () => {
		const result = buildPreprocessArgs({ end: 10 });
		expect(result.inputArgs).toEqual([]);
		expect(result.outputArgs).toEqual(["-t", "10"]);
	});

	test("builds -ss and -t for start+end", () => {
		const result = buildPreprocessArgs({ start: 2, end: 10 });
		expect(result.inputArgs).toEqual(["-ss", "2"]);
		expect(result.outputArgs).toEqual(["-t", "8"]);
	});

	test("builds scale filter for width", () => {
		const result = buildPreprocessArgs({ width: 800 });
		expect(result.filterFragments).toEqual(["scale=800:-1"]);
		expect(result.inputArgs).toEqual([]);
		expect(result.outputArgs).toEqual([]);
	});

	test("combines trim and resize", () => {
		const result = buildPreprocessArgs({ start: 2, end: 10, width: 800 });
		expect(result.inputArgs).toEqual(["-ss", "2"]);
		expect(result.outputArgs).toEqual(["-t", "8"]);
		expect(result.filterFragments).toEqual(["scale=800:-1"]);
	});

	test("throws when end is less than start", () => {
		expect(() => buildPreprocessArgs({ start: 10, end: 5 })).toThrow(
			"end (5) must be greater than start (10)",
		);
	});

	test("throws when end equals start", () => {
		expect(() => buildPreprocessArgs({ start: 5, end: 5 })).toThrow("must be greater than start");
	});
});
