import { describe, expect, test } from "bun:test";
import {
	parsePositiveFloat,
	parsePositiveInt,
	parseThreshold,
	parseTime,
} from "../src/cli/parse.ts";

describe("parseTime", () => {
	test("parses raw seconds", () => {
		expect(parseTime("30")).toBe(30);
	});

	test("parses fractional seconds", () => {
		expect(parseTime("2.5")).toBe(2.5);
	});

	test("parses M:SS format", () => {
		expect(parseTime("1:30")).toBe(90);
	});

	test("parses M:SS with zero minutes", () => {
		expect(parseTime("0:05")).toBe(5);
	});

	test("parses H:MM:SS format", () => {
		expect(parseTime("1:30:00")).toBe(5400);
	});

	test("parses H:MM:SS with all parts", () => {
		expect(parseTime("2:15:30")).toBe(8130);
	});

	test("throws on invalid input", () => {
		expect(() => parseTime("abc")).toThrow("Invalid time format");
	});

	test("throws on invalid M:SS", () => {
		expect(() => parseTime("a:bc")).toThrow("Invalid time format");
	});

	test("throws on invalid H:MM:SS", () => {
		expect(() => parseTime("x:y:z")).toThrow("Invalid time format");
	});

	test("throws on negative component in M:SS", () => {
		expect(() => parseTime("-1:65")).toThrow("must not be negative");
	});

	test("throws on negative seconds in M:SS", () => {
		expect(() => parseTime("0:-5")).toThrow("must not be negative");
	});

	test("throws on seconds >= 60 in M:SS", () => {
		expect(() => parseTime("1:60")).toThrow("Seconds must be 0–59");
	});

	test("throws on seconds >= 60 in H:MM:SS", () => {
		expect(() => parseTime("1:30:60")).toThrow("Seconds must be 0–59");
	});

	test("throws on minutes >= 60 in H:MM:SS", () => {
		expect(() => parseTime("1:60:00")).toThrow("Minutes must be 0–59");
	});

	test("throws on negative component in H:MM:SS", () => {
		expect(() => parseTime("-1:00:00")).toThrow("must not be negative");
	});

	test("throws on negative plain seconds", () => {
		expect(() => parseTime("-5")).toThrow("must not be negative");
	});

	test("allows fractional seconds under 60 in M:SS", () => {
		expect(parseTime("1:30.5")).toBe(90.5);
	});
});

describe("parsePositiveFloat", () => {
	test("parses valid positive float", () => {
		expect(parsePositiveFloat("2.5", "every")).toBe(2.5);
	});

	test("throws on zero", () => {
		expect(() => parsePositiveFloat("0", "every")).toThrow("must be a positive number");
	});

	test("throws on negative", () => {
		expect(() => parsePositiveFloat("-1", "every")).toThrow("must be a positive number");
	});

	test("throws on NaN", () => {
		expect(() => parsePositiveFloat("abc", "every")).toThrow("must be a positive number");
	});
});

describe("parsePositiveInt", () => {
	test("parses valid positive int", () => {
		expect(parsePositiveInt("10", "width")).toBe(10);
	});

	test("throws on zero", () => {
		expect(() => parsePositiveInt("0", "width")).toThrow("must be a positive integer");
	});

	test("throws on negative", () => {
		expect(() => parsePositiveInt("-5", "max-frames")).toThrow("must be a positive integer");
	});

	test("truncates float to int", () => {
		expect(parsePositiveInt("1.5", "width")).toBe(1);
	});

	test("throws on NaN", () => {
		expect(() => parsePositiveInt("abc", "width")).toThrow("must be a positive integer");
	});
});

describe("parseThreshold", () => {
	test("parses valid threshold", () => {
		expect(parseThreshold("0.3")).toBe(0.3);
	});

	test("accepts 0", () => {
		expect(parseThreshold("0")).toBe(0);
	});

	test("accepts 1", () => {
		expect(parseThreshold("1")).toBe(1);
	});

	test("accepts 0.5", () => {
		expect(parseThreshold("0.5")).toBe(0.5);
	});

	test("throws on value above 1", () => {
		expect(() => parseThreshold("1.5")).toThrow("must be a number between 0 and 1");
	});

	test("throws on negative value", () => {
		expect(() => parseThreshold("-0.1")).toThrow("must be a number between 0 and 1");
	});

	test("throws on NaN", () => {
		expect(() => parseThreshold("abc")).toThrow("must be a number between 0 and 1");
	});
});
