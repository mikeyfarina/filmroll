function parseColonTime(parts: string[], value: string): number {
	// Normalize M:SS → [0, M, SS] so both formats share one code path
	const raw = parts.length === 3 ? parts : ["0", ...parts];
	const hours = Number.parseInt(raw[0] ?? "", 10);
	const minutes = Number.parseInt(raw[1] ?? "", 10);
	const seconds = Number.parseFloat(raw[2] ?? "");

	if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) {
		throw new Error(`Invalid time format: "${value}". Use H:MM:SS, M:SS, or seconds.`);
	}
	if (hours < 0 || minutes < 0 || seconds < 0) {
		throw new Error(`Time components must not be negative: "${value}".`);
	}
	if (parts.length === 3 && minutes >= 60) {
		throw new Error(`Invalid time format: "${value}". Minutes must be 0–59.`);
	}
	if (seconds >= 60) {
		throw new Error(`Invalid time format: "${value}". Seconds must be 0–59.`);
	}
	return hours * 3600 + minutes * 60 + seconds;
}

export function parseTime(value: string): number {
	const parts = value.split(":");
	if (parts.length === 2 || parts.length === 3) {
		return parseColonTime(parts, value);
	}
	const n = Number.parseFloat(value);
	if (Number.isNaN(n)) {
		throw new Error(`Invalid time format: "${value}". Use H:MM:SS, M:SS, or seconds.`);
	}
	if (n < 0) {
		throw new Error(`Time must not be negative: "${value}".`);
	}
	return n;
}

export function parsePositiveFloat(value: string, name: string): number {
	const n = Number.parseFloat(value);
	if (!Number.isFinite(n) || n <= 0) {
		throw new Error(`--${name} must be a positive number, got "${value}".`);
	}
	return n;
}

export function parsePositiveInt(value: string, name: string): number {
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n) || n <= 0) {
		throw new Error(`--${name} must be a positive integer, got "${value}".`);
	}
	return n;
}
