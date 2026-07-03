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
