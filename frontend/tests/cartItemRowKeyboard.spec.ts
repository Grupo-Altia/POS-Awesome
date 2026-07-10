// @vitest-environment jsdom

import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import CartItemRow from "../src/posapp/components/pos/invoice/CartItemRow.vue";

const VTextFieldStub = defineComponent({
	name: "VTextField",
	props: {
		modelValue: { type: [String, Number], default: "" },
		disabled: { type: Boolean, default: false },
		type: { type: String, default: "text" },
	},
	setup(props, { attrs }) {
		const callAttr = (name: string, ...args: unknown[]) => {
			const handler = attrs[name] as
				| ((...handlerArgs: unknown[]) => void)
				| Array<(...handlerArgs: unknown[]) => void>
				| undefined;
			if (Array.isArray(handler)) {
				handler.forEach((entry) => entry(...args));
				return;
			}
			handler?.(...args);
		};

		return () =>
			h("input", {
				...attrs,
				type: props.type,
				value: props.modelValue,
				disabled: props.disabled,
				onInput: (event: Event) => {
					const value = (event.target as HTMLInputElement).value;
					callAttr("onUpdate:modelValue", value);
				},
				onFocus: (event: FocusEvent) => callAttr("onFocus", event),
				onBlur: (event: FocusEvent) => callAttr("onBlur", event),
				onKeydown: (event: KeyboardEvent) => {
					callAttr("onKeydown", event);
				},
			});
	},
});

const mountRow = (itemOverrides: Record<string, unknown> = {}, listeners = {}) =>
	mount(CartItemRow, {
		props: {
			item: {
				item_code: "ITEM-001",
				item_name: "Test Item",
				qty: 1,
				rate: 10,
				discount_percentage: 0,
				discount_amount: 0,
				price_list_rate: 10,
				item_uoms: [{ uom: "Nos" }],
				uom: "Nos",
				...itemOverrides,
			},
			visibleColumns: [{ key: "qty" }],
			posProfile: {},
			formatFloat: (value: unknown) => String(value ?? ""),
			formatCurrency: (value: unknown) => String(value ?? ""),
			currencySymbol: () => "Rs",
			isNumber: () => true,
			isNegative: (value: unknown) => Number(value) < 0,
			rowIndex: 0,
			...listeners,
		},
		global: {
			components: {
				"v-text-field": VTextFieldStub,
				VTextField: VTextFieldStub,
			},
			stubs: {
				"v-btn": true,
				VBtn: true,
				"v-icon": true,
				VIcon: true,
				"v-select": true,
				VSelect: true,
				"v-chip": true,
				VChip: true,
			},
		},
	});

describe("CartItemRow keyboard editing", () => {
	it("submits quantity on Enter even when the value matches the current quantity", async () => {
		vi.stubGlobal("__", (value: string) => value);
		const onQtyEditSubmitted = vi.fn();
		const wrapper = mountRow({ qty: 1 }, { onQtyEditSubmitted });
		const input = wrapper.get('input[type="number"]');

		await input.trigger("focus");
		await input.setValue("1");
		await input.trigger("keydown", { key: "Enter" });

		expect(wrapper.emitted("update-qty")).toBeUndefined();
		expect(onQtyEditSubmitted).toHaveBeenCalled();
	});
});
