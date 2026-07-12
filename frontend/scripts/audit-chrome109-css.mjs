import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const COUNTER_GRID_COLOR_MIX_CLASSES = [
	"posa-cart-empty-state",
	"posa-cart-empty-state__icon-wrap",
	"posa-cart-item-row--keyboard-active",
	"posa-cart-item-cell--keyboard-active",
];

function parseDeclarations(body) {
	return body
		.split(";")
		.map((declaration) => declaration.trim())
		.filter(Boolean)
		.map((declaration) => {
			const separator = declaration.indexOf(":");
			return {
				property: declaration.slice(0, separator).trim(),
				value: declaration.slice(separator + 1).trim(),
			};
		});
}

export function auditChrome109CounterGridCss(css, label = "Counter Grid CSS") {
	const seenClasses = new Set();
	const failures = [];
	const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
	let match;
	while ((match = rulePattern.exec(css))) {
		const selector = match[1];
		const matchingClasses = COUNTER_GRID_COLOR_MIX_CLASSES.filter((className) =>
			selector.includes(`.${className}`),
		);
		if (!matchingClasses.length || !match[2].includes("color-mix(")) continue;
		matchingClasses.forEach((className) => seenClasses.add(className));

		const declarations = parseDeclarations(match[2]);
		declarations.forEach((declaration, index) => {
			if (!declaration.value.includes("color-mix(")) return;
			const hasFallback = declarations
				.slice(0, index)
				.some(
					(candidate) =>
						candidate.property === declaration.property &&
						!candidate.value.includes("color-mix("),
				);
			if (!hasFallback) {
				failures.push(
					`${selector.trim()} -> ${declaration.property} needs a preceding Chrome 109 fallback`,
				);
			}
		});
	}

	for (const className of COUNTER_GRID_COLOR_MIX_CLASSES) {
		if (!seenClasses.has(className)) {
			failures.push(`.${className} color-mix rule was not found`);
		}
	}
	if (failures.length) {
		throw new Error(`${label} compatibility audit failed:\n${failures.join("\n")}`);
	}
	return { auditedClasses: Array.from(seenClasses), label };
}

function auditBuiltCss() {
	const scriptDir = path.dirname(fileURLToPath(import.meta.url));
	const outputDir = path.resolve(scriptDir, "../../posawesome/public/dist/js");
	const cssFiles = readdirSync(outputDir).filter((fileName) =>
		fileName.endsWith(".css"),
	);
	if (!cssFiles.length) {
		throw new Error(`No production CSS artifacts found in ${outputDir}`);
	}
	const css = cssFiles
		.map((fileName) => readFileSync(path.join(outputDir, fileName), "utf8"))
		.join("\n");
	const result = auditChrome109CounterGridCss(css, "production CSS");
	process.stdout.write(
		`Chrome 109 CSS audit passed for ${result.auditedClasses.length} Counter Grid states.\n`,
	);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
	auditBuiltCss();
}
