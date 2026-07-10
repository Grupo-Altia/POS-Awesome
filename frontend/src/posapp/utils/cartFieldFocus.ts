export type CartGridColumnKey =
	| "qty"
	| "uom"
	| "discount_percentage"
	| "discount_amount"
	| "rate"
	| "posa_is_offer"
	| "actions"
	| "data-table-expand";

export type CartShortcutField =
	| "qty"
	| "uom"
	| "rate"
	| "discount_percentage"
	| "discount_amount";

export interface CartFieldFocusOptions {
	activate?: boolean;
}

const FIELD_SELECTORS: Record<CartGridColumnKey, string> = {
	qty: '[data-column-key="qty"] .posa-cart-table__qty-input-shell',
	uom: '[data-column-key="uom"] .posa-cart-table__editor-display',
	rate: '[data-column-key="rate"] .posa-cart-table__editor-display',
	discount_percentage: '[data-column-key="discount_percentage"] .posa-cart-table__editor-display',
	discount_amount: '[data-column-key="discount_amount"] .posa-cart-table__editor-display',
	posa_is_offer: '[data-column-key="posa_is_offer"] button',
	actions: '[data-column-key="actions"] button',
	"data-table-expand": '[data-column-key="data-table-expand"] button',
};

export const CART_GRID_NAVIGABLE_COLUMNS: CartGridColumnKey[] = [
	"qty",
	"uom",
	"discount_percentage",
	"discount_amount",
	"rate",
	"posa_is_offer",
	"actions",
	"data-table-expand",
];

const NAVIGABLE_COLUMN_SET = new Set<string>(CART_GRID_NAVIGABLE_COLUMNS);

export const isCartGridColumnKey = (key: unknown): key is CartGridColumnKey =>
	typeof key === "string" && NAVIGABLE_COLUMN_SET.has(key);

export const getCartGridRowId = (rowIndex: number) =>
	`posa-cart-grid-row-${rowIndex}`;

export const getCartGridCellId = (rowIndex: number, columnKey: string) =>
	`posa-cart-grid-cell-${rowIndex}-${columnKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

const isDisabled = (element: HTMLElement | null | undefined) =>
	Boolean(
		element &&
			(element.hasAttribute("disabled") ||
				element.getAttribute("aria-disabled") === "true" ||
				element.classList.contains("v-btn--disabled") ||
				element.closest("[disabled], [aria-disabled='true']")),
	);

export const getNavigableCartColumnKeys = (
	columns: Array<{ key?: unknown }> | null | undefined,
) => {
	if (!Array.isArray(columns)) {
		return [];
	}

	return columns
		.map((column) => column?.key)
		.filter(isCartGridColumnKey);
};

export const getCartGridRow = (
	container: ParentNode | null | undefined,
	rowIndex: number,
) => {
	if (!container || rowIndex < 0) {
		return null;
	}

	const byIndex = container.querySelector?.(
		`.posa-cart-item-row[data-cart-row-index="${rowIndex}"]`,
	) as HTMLElement | null;
	if (byIndex) {
		return byIndex;
	}

	const rows = container.querySelectorAll?.(".posa-cart-item-row");
	return (rows?.[rowIndex] as HTMLElement | undefined) || null;
};

export const getCartGridCellTarget = (
	container: ParentNode | null | undefined,
	rowIndex: number,
	field: CartGridColumnKey,
) => {
	const row = getCartGridRow(container, rowIndex);
	if (!row) {
		return null;
	}

	const target = row.querySelector(FIELD_SELECTORS[field]) as HTMLElement | null;
	return target && !isDisabled(target) ? target : null;
};

export const focusCartGridRow = (
	container: ParentNode | null | undefined,
	rowIndex: number,
) => {
	const row = getCartGridRow(container, rowIndex);
	if (!row) {
		return false;
	}

	row.scrollIntoView?.({ block: "nearest", inline: "nearest" });
	row.focus?.();
	return true;
};

export const focusCartGridCell = (
	container: ParentNode | null | undefined,
	rowIndex: number,
	field: CartGridColumnKey,
	options: CartFieldFocusOptions = {},
) => {
	const target = getCartGridCellTarget(container, rowIndex, field);
	if (!target) {
		return false;
	}

	target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
	target.focus?.();
	if (options.activate === true) {
		target.click?.();
	}
	return true;
};

export const activateCartGridCell = (
	container: ParentNode | null | undefined,
	rowIndex: number,
	field: CartGridColumnKey,
) => focusCartGridCell(container, rowIndex, field, { activate: true });

export const focusCartItemField = (
	container: ParentNode | null | undefined,
	rowIndex: number,
	field: CartShortcutField,
	options: CartFieldFocusOptions = {},
) => {
	return focusCartGridCell(container, rowIndex, field, {
		activate: options.activate !== false,
	});
};
