import { describe, expect, test } from "bun:test";
import { buildFrameInfoList, filterFrameFiles } from "../src/core/strategies/frames.ts";

describe("filterFrameFiles", () => {
	test("filters and sorts frame files", () => {
		const filenames = [
			"frame_0003.png",
			".DS_Store",
			"frame_0001.png",
			"thumb.jpg",
			"frame_0002.png",
		];
		expect(filterFrameFiles(filenames)).toEqual([
			"frame_0001.png",
			"frame_0002.png",
			"frame_0003.png",
		]);
	});

	test("returns empty array for no matches", () => {
		expect(filterFrameFiles([".DS_Store", "thumb.jpg"])).toEqual([]);
	});
});

describe("buildFrameInfoList", () => {
	test("builds correct FrameInfo with interval timestamps", () => {
		const filenames = [
			"frame_0001.png",
			"frame_0002.png",
			"frame_0003.png",
			"frame_0004.png",
			"frame_0005.png",
		];
		const result = buildFrameInfoList("/out", filenames, (i) => i * 2);

		expect(result).toHaveLength(5);
		expect(result[0]).toEqual({ path: "/out/frame_0001.png", timestamp: 0, index: 0 });
		expect(result[1]).toEqual({ path: "/out/frame_0002.png", timestamp: 2, index: 1 });
		expect(result[4]).toEqual({ path: "/out/frame_0005.png", timestamp: 8, index: 4 });
	});

	test("builds correct FrameInfo with lookup timestamps", () => {
		const timestamps = [0, 5.12, 10.24];
		const filenames = ["frame_0001.png", "frame_0002.png", "frame_0003.png"];
		const result = buildFrameInfoList("/out", filenames, (i) => timestamps[i] ?? 0);

		expect(result).toHaveLength(3);
		expect(result[0]).toEqual({ path: "/out/frame_0001.png", timestamp: 0, index: 0 });
		expect(result[1]).toEqual({ path: "/out/frame_0002.png", timestamp: 5.12, index: 1 });
		expect(result[2]).toEqual({ path: "/out/frame_0003.png", timestamp: 10.24, index: 2 });
	});

	test("returns empty array for empty filenames", () => {
		const result = buildFrameInfoList("/out", [], (i) => i);
		expect(result).toEqual([]);
	});
});
