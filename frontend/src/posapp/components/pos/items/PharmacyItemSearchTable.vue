<template>
	<div class="pharmacy-search-results" data-testid="pharmacy-item-search-results">
		<div class="pharmacy-search-controls">
			<v-select
				:model-value="searchField"
				:items="searchFields"
				item-title="title"
				item-value="value"
				:label="__('Search field')"
				density="compact"
				variant="outlined"
				hide-details
				class="pharmacy-search-controls__field"
				@update:model-value="emit('update:search-field', $event)"
			/>
			<v-select
				:model-value="itemGroup"
				:items="itemGroups"
				:label="__('Item group')"
				density="compact"
				variant="outlined"
				hide-details
				class="pharmacy-search-controls__group"
				@update:model-value="emit('update:item-group', $event)"
			/>
			<v-switch
				:model-value="includeZeroStock"
				:label="__('Include zero stock')"
				color="primary"
				density="compact"
				hide-details
				data-testid="pharmacy-include-zero-stock"
				@update:model-value="emit('update:include-zero-stock', $event)"
			/>
			<div class="pharmacy-search-controls__status" role="status" aria-live="polite">
				<span>{{ tableItems.length }} {{ __("results") }}</span>
				<span>{{ activePriceList || posProfile?.selling_price_list || __("No price list") }}</span>
				<span>{{ posProfile?.warehouse || __("No warehouse") }}</span>
				<span v-if="lastSyncTime">{{ __("Synced") }} {{ lastSyncTime }}</span>
			</div>
		</div>

		<v-data-table-virtual
			ref="tableRef"
			:headers="headers"
			:items="tableItems"
			item-value="item_code"
			fixed-header
			density="compact"
			height="100%"
			class="pharmacy-results-table"
			:row-props="getPharmacyRowProps"
			:no-data-text="__('No matching items')"
			@click:row="handleRowClick"
			@scroll.passive="emit('list-scroll', $event)"
			@keydown="handleTableKeydown"
		>
			<template #item.item_name="{ item }">
				<div class="pharmacy-product-cell">
					<strong>{{ cleanPharmacyText(item.item_name) || item.item_code }}</strong>
					<span v-if="cleanPharmacyText(item.retailmind_short_name)">
						{{ cleanPharmacyText(item.retailmind_short_name) }}
					</span>
				</div>
			</template>
			<template #item.pack="{ item }">
				{{ resolvePackLabel(item) || "-" }}
			</template>
			<template #item.company="{ item }">
				{{ cleanPharmacyText(item.brand || item.retailmind_old_pos_company_code) || "-" }}
			</template>
			<template #item.item_group="{ item }">
				{{ cleanPharmacyText(item.item_group) || "-" }}
			</template>
			<template #item.generic="{ item }">
				{{ cleanPharmacyText(item.retailmind_old_pos_generic_name) || "-" }}
			</template>
			<template #item.rate="{ item }">
				<span class="pharmacy-rate-cell">
					{{ currencySymbol(priceCurrency(item)) }}
					{{
						formatCurrency(
							resolveRetailPrice(item),
							priceCurrency(item),
							ratePrecision(resolveRetailPrice(item)),
						)
					}}
				</span>
			</template>
			<template #item.rack="{ item }">
				{{ cleanPharmacyText(item.retailmind_old_pos_rack) || "-" }}
			</template>
			<template #item.pack_stock="{ item }">
				<span :title="availableStockTitle(item)">{{ packStockLabel(item) }}</span>
			</template>
			<template #item.loose_stock="{ item }">
				<span :title="availableStockTitle(item)">{{ looseStockLabel(item) }}</span>
			</template>
		</v-data-table-virtual>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

import {
	cleanPharmacyText,
	projectPackLooseStock,
	resolvePackLabel,
	resolveRetailPrice,
} from "../../../utils/pharmacyItem";

const props = defineProps({
	displayedItems: { type: Array, default: () => [] },
	searchTerm: { type: String, default: "" },
	searchField: { type: String, default: "all" },
	includeZeroStock: { type: Boolean, default: false },
	highlightedItemCode: { type: String, default: "" },
	posProfile: { type: Object, default: () => ({}) },
	selectedCurrency: { type: String, default: "" },
	currencySymbol: { type: Function, required: true },
	formatCurrency: { type: Function, required: true },
	formatNumber: { type: Function, required: true },
	ratePrecision: { type: Function, required: true },
	rowProps: { type: [Object, Function], default: null },
	lastSyncTime: { type: String, default: "" },
	itemGroups: { type: Array, default: () => [] },
	itemGroup: { type: String, default: "ALL" },
	activePriceList: { type: String, default: "" },
});

const emit = defineEmits([
	"row-click",
	"list-scroll",
	"update:item-group",
	"update:search-field",
	"update:include-zero-stock",
]);
const __ = window.__ || ((value: string) => value);
const tableRef = ref<any>(null);
const tableItems = computed<Record<string, any>[]>(() =>
	Array.isArray(props.displayedItems) ? (props.displayedItems as Record<string, any>[]) : [],
);

const resolveRowItem = (candidate: any): Record<string, any> | null => {
	if (!candidate || typeof candidate !== "object") return null;
	if (candidate.item_code) return candidate;
	for (const key of ["raw", "item", "internalItem"]) {
		const resolved = resolveRowItem(candidate[key]);
		if (resolved?.item_code) return resolved;
	}
	return null;
};

const stripHighlightClass = (value: any): any => {
	if (typeof value === "string") {
		return value
			.split(/\s+/)
			.filter((className) => className && className !== "item-row-highlighted")
			.join(" ");
	}
	if (Array.isArray(value)) return value.map(stripHighlightClass);
	if (value && typeof value === "object") {
		const classes = { ...value };
		delete classes["item-row-highlighted"];
		return classes;
	}
	return value;
};

const getBaseRowProps = (rowData: any) => {
	if (typeof props.rowProps === "function") return props.rowProps(rowData) || {};
	return props.rowProps && typeof props.rowProps === "object" ? props.rowProps : {};
};

const getPharmacyRowProps = (rowData: any) => {
	const item = resolveRowItem(rowData);
	const itemCode = String(item?.item_code || "");
	const highlighted = Boolean(itemCode && itemCode === String(props.highlightedItemCode || ""));
	const baseProps = getBaseRowProps(rowData);
	return {
		...baseProps,
		"aria-selected": highlighted ? "true" : "false",
		"data-item-code": itemCode,
		"data-pharmacy-active": highlighted ? "true" : "false",
		class: [stripHighlightClass(baseProps.class), { "item-row-highlighted": highlighted }],
	};
};
const searchFields = computed(() => [
	{ title: __("All fields"), value: "all" },
	{ title: __("Code"), value: "code" },
	{ title: __("Product"), value: "product" },
	{ title: __("Pack"), value: "pack" },
	{ title: __("Company"), value: "company" },
	{ title: __("Group"), value: "group" },
	{ title: __("Generic"), value: "generic" },
	{ title: __("Rack"), value: "rack" },
]);

const headers = computed(() => [
	{ title: __("Code"), key: "item_code", width: 104, sortable: false },
	{ title: __("Product Name"), key: "item_name", minWidth: 230, sortable: false },
	{ title: __("Pack"), key: "pack", width: 92, sortable: false },
	{ title: __("Company"), key: "company", width: 132, sortable: false },
	{ title: __("Group"), key: "item_group", width: 120, sortable: false },
	{ title: __("Generic"), key: "generic", width: 145, sortable: false },
	{ title: __("R.P"), key: "rate", width: 104, align: "end" as const, sortable: false },
	{ title: __("Rack"), key: "rack", width: 88, sortable: false },
	{
		title: __("Pack Stock"),
		key: "pack_stock",
		width: 92,
		align: "end" as const,
		sortable: false,
	},
	{
		title: __("Loose"),
		key: "loose_stock",
		width: 82,
		align: "end" as const,
		sortable: false,
	},
]);

const priceCurrency = (item: Record<string, any>) =>
	item?.original_currency ||
	item?.currency ||
	item?.price_list_currency ||
	props.selectedCurrency ||
	props.posProfile?.currency;

const packStockLabel = (item: Record<string, any>) => {
	const stock = projectPackLooseStock(item);
	return stock.canSplit
		? props.formatNumber(stock.packQty, 0)
		: `${props.formatNumber(stock.availableQty, 4)} ${stock.uom}`;
};

const looseStockLabel = (item: Record<string, any>) => {
	const stock = projectPackLooseStock(item);
	return stock.canSplit ? props.formatNumber(stock.looseQty, 4) : "-";
};

const availableStockTitle = (item: Record<string, any>) => {
	const stock = projectPackLooseStock(item);
	return `${props.formatNumber(stock.availableQty, 4)} ${stock.uom}`;
};

const handleRowClick = (event: MouseEvent, data: any) => emit("row-click", event, data);

const handleTableKeydown = (event: KeyboardEvent) => {
	if (event.key !== "Enter" && event.key !== " ") return;
	const row = (event.target as HTMLElement | null)?.closest?.("[data-item-code]");
	const itemCode = row?.getAttribute("data-item-code");
	if (!itemCode) return;
	const item = tableItems.value.find((candidate) => candidate?.item_code === itemCode);
	if (!item) return;
	event.preventDefault();
	emit("row-click", event, { item });
};

const getTableRoot = () => tableRef.value?.$el || tableRef.value;
const syncRenderedHighlight = async () => {
	await nextTick();
	const root = getTableRoot() as HTMLElement | null;
	if (!root?.querySelectorAll) return;
	const activeCode = String(props.highlightedItemCode || "");
	root.querySelectorAll<HTMLElement>("[data-item-code]").forEach((row) => {
		const highlighted = Boolean(activeCode && row.getAttribute("data-item-code") === activeCode);
		row.classList.toggle("item-row-highlighted", highlighted);
		row.setAttribute("aria-selected", highlighted ? "true" : "false");
		row.setAttribute("data-pharmacy-active", highlighted ? "true" : "false");
		if (highlighted) {
			row.scrollIntoView?.({ block: "nearest", inline: "nearest" });
		}
	});
};

watch([() => props.highlightedItemCode, tableItems], () => void syncRenderedHighlight(), { flush: "post" });

defineExpose({ tableRef, syncRenderedHighlight });
</script>

<style scoped>
.pharmacy-search-results {
	display: flex;
	flex: 1 1 auto;
	flex-direction: column;
	min-height: 0;
	height: 100%;
}

.pharmacy-search-controls {
	display: flex;
	align-items: center;
	gap: 14px;
	min-height: 50px;
	padding: 6px 10px;
	border-bottom: 1px solid var(--pos-border);
	background: var(--pos-card-bg);
}

.pharmacy-search-controls__field {
	flex: 0 0 180px;
}

.pharmacy-search-controls__group {
	flex: 0 1 220px;
}

.pharmacy-search-controls__status {
	display: flex;
	align-items: center;
	gap: 14px;
	margin-inline-start: auto;
	color: var(--pos-text-secondary);
	font-size: 0.76rem;
}

.pharmacy-results-table {
	flex: 1 1 auto;
	min-height: 0;
	border: 0;
	border-radius: 0;
	background: var(--pos-card-bg);
}

.pharmacy-results-table :deep(.v-table__wrapper) {
	overflow: auto;
}

.pharmacy-results-table :deep(table) {
	min-width: 1180px;
}

.pharmacy-results-table :deep(th) {
	height: 38px !important;
	padding: 0 8px !important;
	background: var(--pos-surface-muted) !important;
	color: var(--pos-text-secondary) !important;
	font-size: 0.72rem;
	font-weight: 700 !important;
}

.pharmacy-results-table :deep(td) {
	height: 44px !important;
	padding: 4px 8px !important;
	border-bottom: 1px solid var(--pos-border-light) !important;
	font-size: 0.78rem;
	font-variant-numeric: tabular-nums;
}

.pharmacy-results-table :deep(tbody tr) {
	cursor: pointer;
}

.pharmacy-results-table :deep(tbody tr:not(.item-row-highlighted):hover > td) {
	background: rgba(var(--v-theme-on-surface), 0.035) !important;
}

.pharmacy-results-table :deep(tbody tr.item-row-highlighted > td),
.pharmacy-results-table :deep(tbody tr[aria-selected="true"] > td) {
	background: rgba(var(--v-theme-primary), 0.14) !important;
}

.pharmacy-results-table :deep(tbody tr.item-row-highlighted > td:first-child),
.pharmacy-results-table :deep(tbody tr[aria-selected="true"] > td:first-child) {
	box-shadow: inset 4px 0 0 rgb(var(--v-theme-primary));
}

.pharmacy-product-cell {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.pharmacy-product-cell strong,
.pharmacy-product-cell span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pharmacy-product-cell strong {
	font-size: 0.79rem;
	color: var(--pos-text-primary);
}

.pharmacy-product-cell span {
	color: var(--pos-text-secondary);
	font-size: 0.68rem;
}

.pharmacy-rate-cell {
	font-weight: 700;
	color: var(--pos-text-primary);
}

@media (max-width: 1100px) {
	.pharmacy-search-controls__status span:not(:first-child) {
		display: none;
	}
}
</style>
