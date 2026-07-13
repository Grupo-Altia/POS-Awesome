export interface AlternateCartSource {
	row_id: string;
	item_code: string;
	item_name: string;
	qty: number;
	available_qty: number;
	label: string;
}

type Translate = (value: string) => string;

const finiteNumber = (value: unknown, fallback = 0) => {
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : fallback;
};

export function getCartAvailableQty(item: Record<string, any>): number {
	const baseQty = finiteNumber(
		item?._base_actual_qty ?? item?.actual_qty ?? item?.available_qty,
	);
	const conversionFactor = finiteNumber(item?.conversion_factor, 1);
	return baseQty / (conversionFactor > 0 ? conversionFactor : 1);
}

export function collectUnavailableCartItems(
	items: Record<string, any>[],
	options: { isReturn?: boolean; translate?: Translate } = {},
): AlternateCartSource[] {
	if (options.isReturn) return [];
	const translate = options.translate || ((value) => value);

	return (Array.isArray(items) ? items : []).flatMap((item) => {
		const requestedQty = finiteNumber(item?.qty);
		const rowId = String(item?.posa_row_id || "").trim();
		const itemCode = String(item?.item_code || "").trim();
		const availableQty = Math.max(0, getCartAvailableQty(item));
		if (
			!rowId ||
			!itemCode ||
			requestedQty <= 0 ||
			Number(item?.is_stock_item) === 0 ||
			availableQty >= requestedQty
		) {
			return [];
		}

		const itemName = String(item?.item_name || itemCode);
		return [
			{
				row_id: rowId,
				item_code: itemCode,
				item_name: itemName,
				qty: Math.abs(requestedQty),
				available_qty: availableQty,
				label: `${itemName} (${translate("stock")} ${availableQty})`,
			},
		];
	});
}
