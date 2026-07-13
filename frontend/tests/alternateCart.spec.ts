import { describe, expect, it } from "vitest";

import {
	collectUnavailableCartItems,
	getCartAvailableQty,
} from "../src/posapp/utils/alternateCart";

describe("alternate cart eligibility", () => {
	it("normalizes base stock through the selected UOM conversion factor", () => {
		expect(
			getCartAvailableQty({
				_base_actual_qty: 24,
				conversion_factor: 12,
			}),
		).toBe(2);
		expect(
			getCartAvailableQty({ actual_qty: 3, conversion_factor: 0 }),
		).toBe(3);
	});

	it("returns only positive stock lines whose requested quantity is unavailable", () => {
		const sources = collectUnavailableCartItems(
			[
				{
					posa_row_id: "row-zero",
					item_code: "PANADOL",
					item_name: "Panadol",
					qty: 1,
					_base_actual_qty: 0,
					conversion_factor: 1,
					is_stock_item: 1,
				},
				{
					posa_row_id: "row-short",
					item_code: "SHORT",
					qty: 3,
					_base_actual_qty: 12,
					conversion_factor: 6,
					is_stock_item: 1,
				},
				{
					posa_row_id: "row-ok",
					item_code: "OK",
					qty: 2,
					actual_qty: 2,
					is_stock_item: 1,
				},
			],
			{ translate: (value) => `translated-${value}` },
		);

		expect(sources).toEqual([
			{
				row_id: "row-zero",
				item_code: "PANADOL",
				item_name: "Panadol",
				qty: 1,
				available_qty: 0,
				label: "Panadol (translated-stock 0)",
			},
			{
				row_id: "row-short",
				item_code: "SHORT",
				item_name: "SHORT",
				qty: 3,
				available_qty: 2,
				label: "SHORT (translated-stock 2)",
			},
		]);
	});

	it("excludes returns, non-stock lines, negative rows, and incomplete identities", () => {
		const rows = [
			{
				posa_row_id: "nonstock",
				item_code: "SERVICE",
				qty: 1,
				is_stock_item: 0,
			},
			{
				posa_row_id: "return",
				item_code: "RETURN",
				qty: -1,
				actual_qty: 0,
			},
			{ item_code: "NO-ROW", qty: 1, actual_qty: 0 },
			{ posa_row_id: "no-code", qty: 1, actual_qty: 0 },
		];

		expect(collectUnavailableCartItems(rows)).toEqual([]);
		expect(collectUnavailableCartItems(rows, { isReturn: true })).toEqual(
			[],
		);
	});

	it("treats invalid or negative availability as zero without emitting NaN", () => {
		const [source] = collectUnavailableCartItems([
			{
				posa_row_id: "row",
				item_code: "ITEM",
				qty: 1,
				actual_qty: "not-a-number",
				is_stock_item: 1,
			},
		]);

		expect(source.available_qty).toBe(0);
		expect(source.label).not.toContain("NaN");
	});
});
