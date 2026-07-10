// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
	activateCartGridCell,
	focusCartGridCell,
	focusCartGridRow,
	focusCartItemField,
	getNavigableCartColumnKeys,
} from "../src/posapp/utils/cartFieldFocus";

const createContainer = () => {
	const container = document.createElement("div");
	container.innerHTML = `
		<table>
			<tbody>
				<tr class="posa-cart-item-row">
					<td data-column-key="qty">
						<div class="posa-cart-table__qty-input-shell" tabindex="0">
							<input type="number" />
						</div>
					</td>
					<td data-column-key="uom">
						<div class="posa-cart-table__editor-display" tabindex="0"></div>
					</td>
					<td data-column-key="rate">
						<div class="posa-cart-table__editor-display" tabindex="0"></div>
					</td>
					<td data-column-key="discount_percentage">
						<div class="posa-cart-table__editor-display" tabindex="0"></div>
					</td>
					<td data-column-key="discount_amount">
						<div class="posa-cart-table__editor-display" tabindex="0"></div>
					</td>
					<td data-column-key="amount">
						<div class="currency-display"></div>
					</td>
					<td data-column-key="actions">
						<button type="button" class="delete-action-btn"></button>
					</td>
					<td data-column-key="data-table-expand">
						<button type="button" class="posa-cart-table__expand-btn"></button>
					</td>
				</tr>
				<tr class="posa-cart-item-row" data-cart-row-index="3" tabindex="-1">
					<td data-column-key="qty">
						<div class="posa-cart-table__qty-input-shell" tabindex="0">
							<input type="number" />
						</div>
					</td>
					<td data-column-key="rate">
						<div class="posa-cart-table__editor-display" tabindex="0"></div>
					</td>
				</tr>
			</tbody>
		</table>
	`;
	document.body.appendChild(container);
	return container;
};

describe("focusCartItemField", () => {
	it("focuses and clicks the quantity input for the requested row", () => {
		const container = createContainer();
		const activator = container.querySelector('[data-column-key="qty"] input') as HTMLElement;
		const clickSpy = vi.spyOn(activator, "click");

		expect(focusCartItemField(container, 0, "qty")).toBe(true);
		expect(document.activeElement).toBe(activator);
		expect(clickSpy).toHaveBeenCalledTimes(1);
	});

	it("focuses and clicks the uom activator for the requested row", () => {
		const container = createContainer();
		const activator = container.querySelector(
			'[data-column-key="uom"] .posa-cart-table__editor-display',
		) as HTMLElement;
		const clickSpy = vi.spyOn(activator, "click");

		expect(focusCartItemField(container, 0, "uom")).toBe(true);
		expect(document.activeElement).toBe(activator);
		expect(clickSpy).toHaveBeenCalledTimes(1);
	});

	it("focuses discount percentage without opening the editor when activation is disabled", () => {
		const container = createContainer();
		const activator = container.querySelector(
			'[data-column-key="discount_percentage"] .posa-cart-table__editor-display',
		) as HTMLElement;
		const clickSpy = vi.spyOn(activator, "click");

		expect(focusCartItemField(container, 0, "discount_percentage", { activate: false })).toBe(true);
		expect(document.activeElement).toBe(activator);
		expect(clickSpy).not.toHaveBeenCalled();
	});

	it("focuses rows by explicit rendered row index when available", () => {
		const container = createContainer();
		const row = container.querySelector('[data-cart-row-index="3"]') as HTMLElement;
		const focusSpy = vi.spyOn(row, "focus");

		expect(focusCartGridRow(container, 3)).toBe(true);
		expect(focusSpy).toHaveBeenCalledTimes(1);
	});

	it("focuses grid cells without activating unless requested", () => {
		const container = createContainer();
		const target = container.querySelector(
			'[data-column-key="discount_amount"] .posa-cart-table__editor-display',
		) as HTMLElement;
		const clickSpy = vi.spyOn(target, "click");

		expect(focusCartGridCell(container, 0, "discount_amount")).toBe(true);
		expect(document.activeElement).toBe(target);
		expect(clickSpy).not.toHaveBeenCalled();

		expect(activateCartGridCell(container, 0, "discount_amount")).toBe(true);
		expect(clickSpy).toHaveBeenCalledTimes(1);
	});

	it("derives navigable columns from visible table columns only", () => {
		expect(
			getNavigableCartColumnKeys([
				{ key: "item_name" },
				{ key: "qty" },
				{ key: "amount" },
				{ key: "actions" },
				{ key: "data-table-expand" },
			]),
		).toEqual(["qty", "actions", "data-table-expand"]);
	});
});
