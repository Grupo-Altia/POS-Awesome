// @vitest-environment jsdom

import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PharmacyItemSearchTable from "../src/posapp/components/pos/items/PharmacyItemSearchTable.vue";

const VDataTableVirtualStub = defineComponent({
	name: "VDataTableVirtual",
	props: {
		items: { type: Array, default: () => [] },
		rowProps: { type: [Object, Function], default: null },
	},
	setup(props) {
		return () =>
			h("table", { class: "pharmacy-results-table" }, [
				h(
					"tbody",
					props.items.map((item: any, index: number) => {
						const rowData = {
							index,
							item: { raw: item },
							internalItem: { raw: item },
						};
						const attrs =
							typeof props.rowProps === "function"
								? props.rowProps(rowData)
								: props.rowProps || {};
						return h("tr", attrs, [h("td", item.item_name)]);
					}),
				),
			]);
	},
});

const items = [
	{ item_code: "02017", item_name: "ARINAC FORT", actual_qty: 4 },
	{ item_code: "A3106", item_name: "PANADOL CF", actual_qty: 7 },
	{ item_code: "22203", item_name: "PANADOL DROP", actual_qty: 0 },
];

const mountTable = (overrides: Record<string, unknown> = {}) =>
	mount(PharmacyItemSearchTable, {
		props: {
			displayedItems: items.slice(0, 2),
			searchTerm: "panadol",
			highlightedItemCode: "02017",
			currencySymbol: () => "Rs",
			formatCurrency: (value: unknown) => String(value ?? ""),
			formatNumber: (value: unknown) => String(value ?? ""),
			ratePrecision: () => 2,
			rowProps: (rowData: any) => ({
				"aria-selected":
					rowData?.item?.raw?.item_code === "A3106"
						? "true"
						: "false",
				class: {
					"item-row-highlighted":
						rowData?.item?.raw?.item_code === "A3106",
				},
			}),
			...overrides,
		},
		global: {
			components: {
				VDataTableVirtual: VDataTableVirtualStub,
			},
			stubs: {
				VSelect: true,
				"v-select": true,
				VSwitch: true,
				"v-switch": true,
				VIcon: true,
				"v-icon": true,
			},
		},
	});

const row = (wrapper: ReturnType<typeof mountTable>, itemCode: string) =>
	wrapper.get(`[data-item-code="${itemCode}"]`);

describe("PharmacyItemSearchTable active result", () => {
	beforeEach(() => {
		vi.stubGlobal("__", (value: string) => value);
	});

	it("overrides stale Vuetify row metadata so exactly the requested first row is active", async () => {
		const wrapper = mountTable();
		await flushPromises();

		expect(wrapper.findAll('tr[aria-selected="true"]')).toHaveLength(1);
		expect(row(wrapper, "02017").attributes("aria-selected")).toBe("true");
		expect(row(wrapper, "02017").classes()).toContain(
			"item-row-highlighted",
		);
		expect(row(wrapper, "A3106").attributes("aria-selected")).toBe("false");
		expect(row(wrapper, "A3106").classes()).not.toContain(
			"item-row-highlighted",
		);
	});

	it("moves the sole active state only after keyboard navigation changes the item code", async () => {
		const wrapper = mountTable();
		await wrapper.setProps({ highlightedItemCode: "A3106" });
		await flushPromises();

		expect(wrapper.findAll('tr[aria-selected="true"]')).toHaveLength(1);
		expect(row(wrapper, "02017").attributes("aria-selected")).toBe("false");
		expect(row(wrapper, "A3106").attributes("aria-selected")).toBe("true");
		expect(row(wrapper, "A3106").classes()).toContain(
			"item-row-highlighted",
		);
	});

	it("keeps the first visible row active after field and zero-stock filter rerenders", async () => {
		const wrapper = mountTable();

		await wrapper.setProps({
			displayedItems: items.slice(1),
			searchField: "generic",
			highlightedItemCode: "A3106",
		});
		await flushPromises();
		expect(wrapper.findAll('tr[aria-selected="true"]')).toHaveLength(1);
		expect(row(wrapper, "A3106").attributes("aria-selected")).toBe("true");

		await wrapper.setProps({
			displayedItems: [items[2]!, items[1]!],
			includeZeroStock: true,
			highlightedItemCode: "22203",
		});
		await flushPromises();
		expect(wrapper.findAll('tr[aria-selected="true"]')).toHaveLength(1);
		expect(row(wrapper, "22203").attributes("aria-selected")).toBe("true");
		expect(row(wrapper, "A3106").attributes("aria-selected")).toBe("false");
	});
});
