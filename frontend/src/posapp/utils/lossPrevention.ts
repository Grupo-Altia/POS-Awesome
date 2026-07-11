export type LossCostFloor = {
	field: string;
	label: string;
	rate: number;
};

export type LossRisk = {
	belowCost: boolean;
	itemCode: string;
	itemName: string;
	sellingRate: number;
	costRate: number;
	costLabel: string;
	costField: string;
};

const COST_CANDIDATES = [
	{ field: "trade_price", label: "Trade Price" },
	{ field: "buying_price", label: "Buying Price" },
	{ field: "buying_rate", label: "Buying Rate" },
	{ field: "last_buying_rate", label: "Last Buying Rate" },
	{ field: "last_purchase_rate", label: "Last Purchase Rate" },
	{ field: "valuation_rate", label: "Valuation Rate" },
	{ field: "manufacturing_cost", label: "Manufacturing Cost" },
];

const EPSILON = 0.0001;

export function toFiniteNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === "") {
		return null;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export function getItemCostFloor(
	item: Record<string, unknown> | null | undefined,
): LossCostFloor | null {
	if (!item) {
		return null;
	}
	for (const candidate of COST_CANDIDATES) {
		const rate = toFiniteNumber(item[candidate.field]);
		if (rate !== null && rate > EPSILON) {
			return {
				...candidate,
				rate,
			};
		}
	}
	return null;
}

export function getEffectiveSellingRate(
	item: Record<string, unknown> | null | undefined,
): number {
	if (!item) {
		return 0;
	}
	const rate = toFiniteNumber(item.rate);
	if (rate !== null) {
		return Math.abs(rate);
	}
	const amount = toFiniteNumber(item.amount);
	const qty = toFiniteNumber(item.qty);
	if (amount !== null && qty !== null && Math.abs(qty) > EPSILON) {
		return Math.abs(amount / qty);
	}
	const priceListRate = toFiniteNumber(item.price_list_rate) || 0;
	const discountAmount = Math.abs(toFiniteNumber(item.discount_amount) || 0);
	return Math.max(priceListRate - discountAmount, 0);
}

export function getItemLossRisk(
	item: Record<string, unknown> | null | undefined,
): LossRisk | null {
	if (!item || item.is_return || item.posa_is_replace) {
		return null;
	}
	const qty = toFiniteNumber(item.qty);
	if (qty !== null && qty < 0) {
		return null;
	}
	const cost = getItemCostFloor(item);
	if (!cost) {
		return null;
	}
	const sellingRate = getEffectiveSellingRate(item);
	if (sellingRate + EPSILON >= cost.rate) {
		return null;
	}
	return {
		belowCost: true,
		itemCode: String(item.item_code || ""),
		itemName: String(item.item_name || item.item_code || ""),
		sellingRate,
		costRate: cost.rate,
		costLabel: cost.label,
		costField: cost.field,
	};
}

export function findLossRiskItems(
	items: Array<Record<string, unknown>> | null | undefined,
): LossRisk[] {
	if (!Array.isArray(items)) {
		return [];
	}
	return items
		.map((item) => getItemLossRisk(item))
		.filter((risk): risk is LossRisk => Boolean(risk?.belowCost));
}
