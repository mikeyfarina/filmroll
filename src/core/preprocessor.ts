import type { PreprocessArgs } from "../types.ts";

export function buildPreprocessArgs(options: {
	start?: number | undefined;
	end?: number | undefined;
	width?: number | undefined;
}): PreprocessArgs {
	const inputArgs: string[] = [];
	const filterFragments: string[] = [];
	const outputArgs: string[] = [];

	if (options.start !== undefined) {
		inputArgs.push("-ss", String(options.start));
	}

	if (options.end !== undefined) {
		const duration = options.end - (options.start ?? 0);
		if (duration <= 0) {
			throw new Error(
				`end (${String(options.end)}) must be greater than start (${String(options.start ?? 0)})`,
			);
		}
		outputArgs.push("-t", String(duration));
	}

	if (options.width !== undefined) {
		filterFragments.push(`scale=${String(options.width)}:-1`);
	}

	return { inputArgs, filterFragments, outputArgs };
}
