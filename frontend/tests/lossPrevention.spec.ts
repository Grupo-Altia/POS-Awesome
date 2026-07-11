import { describe, expect, it } from "vitest";

import {
	findLossRiskItems,
	getEffectiveSellingRate,
	getItemLossRisk,
} from "../src/posapp/utils/lossPrevention";

describe("loss prevention", () => {
	it("flags sale rows priced below trade price", () => {
		const risk = getItemLossRisk({
			item_code: "02017",
			item_name: "ARINAC FORT",
			qty: 1,
			rate: 10,
			trade_price: 12.75,
		});

		expect(risk?.belowCost).toBe(true);
		expect(risk?.costField).toBe("trade_price");
		expect(risk?.sellingRate).toBe(10);
		expect(risk?.costRate).toBe(12.75);
	});

	it("allows rows at or above buying price", () => {
		expect(
			getItemLossRisk({
				item_code: "02017",
				qty: 1,
				rate: 12.75,
				trade_price: 12.75,
			}),
		).toBeNull();
	});

	it("uses amount divided by quantity when rate is unavailable", () => {
		expect(
			getEffectiveSellingRate({
				qty: 2,
				amount: 18,
				trade_price: 10,
			}),
		).toBe(9);
	});

	it("collects only below-cost rows", () => {
		const risks = findLossRiskItems([
			{ item_code: "LOW", qty: 1, rate: 5, buying_rate: 6 },
			{ item_code: "OK", qty: 1, rate: 7, buying_rate: 6 },
		]);

		expect(risks).toHaveLength(1);
		expect(risks[0].itemCode).toBe("LOW");
	});
});
