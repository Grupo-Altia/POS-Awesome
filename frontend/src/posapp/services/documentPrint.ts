import { printDocumentViaQz, type QzPrintDocumentOptions } from "./qzTray";
import { parseBooleanSetting } from "../utils/stock";
import {
	printRawDocumentViaQz,
	shouldUseRawDocumentPrinting,
	type RawDocumentPrintOptions,
} from "./rawDocumentPrint";

export { shouldUseRawDocumentPrinting } from "./rawDocumentPrint";

export interface ConfiguredQzDocumentPrintOptions extends QzPrintDocumentOptions {
	doc?: Record<string, any> | null;
	profile?: Record<string, any> | null;
	rawWidthChars?: number;
}

export async function printDocumentViaConfiguredQz(options: ConfiguredQzDocumentPrintOptions) {
	if (shouldUseRawDocumentPrinting(options.profile)) {
		const rawOptions: RawDocumentPrintOptions = {
			doctype: options.doctype,
			name: options.name,
			doc: options.doc,
			profile: options.profile,
			printerName: options.printerName,
			widthChars: options.rawWidthChars,
		};
		await printRawDocumentViaQz(rawOptions);
		return;
	}

	await printDocumentViaQz(options);
}

export function shouldUseConfiguredQzDocumentPrinting(profile?: Record<string, any> | null) {
	return shouldUseRawDocumentPrinting(profile) || parseBooleanSetting(profile?.posa_silent_print);
}

export function getQzPrintErrorMessage(error: unknown) {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	if (typeof error === "string" && error.trim()) {
		return error.trim();
	}
	return "Unknown QZ Tray printing error.";
}

export function confirmDocumentPrintFallback(
	error: unknown,
	options: { raw?: boolean; offline?: boolean } = {},
) {
	const reason = getQzPrintErrorMessage(error);
	const title = options.offline
		? "Raw/QZ printing is not available while the POS is offline."
		: options.raw
			? "Raw/QZ printing failed."
			: "QZ Tray printing failed.";
	const message = `${title}\n\nReason: ${reason}\n\nDo you want to print using the browser fallback instead?`;
	return window.confirm(message);
}
