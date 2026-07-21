<template>
	<v-dialog v-model="dialogVisible" max-width="760" scrollable>
		<v-card class="posa-batch-serial-dialog">
			<v-card-title class="d-flex align-center">
				<v-icon class="me-2">mdi-barcode-scan</v-icon>
				<div>
					<div>{{ __("Batch & Serial Selection") }}</div>
					<div class="text-caption text-medium-emphasis">
						{{ item?.item_name || item?.item_code }} - {{ __("Required stock quantity") }}:
						{{ requiredQuantity }}
					</div>
				</div>
			</v-card-title>

			<v-divider />
			<v-card-text>
				<v-alert
					v-if="errorMessage"
					type="error"
					variant="tonal"
					density="compact"
					class="mb-4"
				>
					{{ errorMessage }}
				</v-alert>

				<v-autocomplete
					v-if="item?.has_batch_no"
					v-model="workingBatch"
					:items="batchOptions"
					item-title="batch_no"
					item-value="batch_no"
					:label="__('Batch Number')"
					:placeholder="__('Search batch number')"
					prepend-inner-icon="mdi-package-variant-closed"
					variant="outlined"
					clearable
					autofocus
					@update:model-value="handleBatchChange"
				>
					<template #item="{ props, item: option }">
						<v-list-item v-bind="props">
							<v-list-item-subtitle>
								{{ __("Available") }}: {{ getBatchAvailableQty(option.raw) }}
								<span v-if="option.raw.expiry_date">
									- {{ __("Expiry") }}: {{ option.raw.expiry_date }}
								</span>
								<span v-if="hasPositiveBatchPrice(option.raw)">
									- {{ __("Price") }}: {{ option.raw.batch_price }}
								</span>
							</v-list-item-subtitle>
						</v-list-item>
					</template>
				</v-autocomplete>

				<v-alert
					v-if="item?.has_batch_no && batchOptions.length === 0"
					type="warning"
					variant="tonal"
					density="compact"
					class="mb-4"
				>
					{{ __("No available batches were found for the POS Profile warehouse.") }}
				</v-alert>

				<v-autocomplete
					v-if="item?.has_serial_no"
					v-model="workingSerials"
					:items="serialOptions"
					item-title="serial_no"
					item-value="serial_no"
					:label="__('Serial Numbers')"
					:placeholder="__('Search or scan a serial number')"
					prepend-inner-icon="mdi-barcode"
					variant="outlined"
					:autofocus="!item?.has_batch_no"
					multiple
					chips
					closable-chips
					:hint="serialSelectionHint"
					persistent-hint
				>
					<template #item="{ props, item: option }">
						<v-list-item v-bind="props">
							<v-list-item-subtitle v-if="getOptionRaw(option).batch_no">
								{{ __("Batch") }}: {{ getOptionRaw(option).batch_no }}
							</v-list-item-subtitle>
						</v-list-item>
					</template>
				</v-autocomplete>

				<div v-if="item?.has_serial_no" class="text-caption mt-1">
					{{ workingSerials.length }} / {{ requiredQuantity }} {{ __("selected") }}
				</div>
			</v-card-text>

			<v-divider />
			<v-card-actions>
				<v-btn
					v-if="item?.has_batch_no && item?.batch_no"
					variant="text"
					@click="restoreAutomaticSelection"
				>
							{{ __("Reset Changes") }}
				</v-btn>
				<v-spacer />
				<v-btn variant="text" @click="cancel">{{ __("Cancel") }}</v-btn>
				<v-btn color="primary" variant="flat" @click="save">
					{{ __("Save Selection") }}
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { getDisplayableBatchOptions } from "../../../composables/pos/shared/useBatchSerial";
import {
	getRequiredStockQuantity,
	getSelectedSerials,
	validateBatchSerialSelection,
} from "../../../composables/pos/shared/batchSerialValidation";

const props = withDefaults(
	defineProps<{
		modelValue: boolean;
		item: any | null;
		cartItems?: any[];
		isReturnInvoice?: boolean;
	}>(),
	{
		cartItems: () => [],
		isReturnInvoice: false,
	},
);

const emit = defineEmits<{
	"update:modelValue": [value: boolean];
	save: [selection: { batchNo: string | null; serials: string[] }];
}>();

const __ = (window as any).__ || ((text: string) => text);
const workingBatch = ref<string | null>(null);
const workingSerials = ref<string[]>([]);
const errorMessage = ref("");

const dialogVisible = computed({
	get: () => props.modelValue,
	set: (value: boolean) => emit("update:modelValue", value),
});

const requiredQuantity = computed(() => getRequiredStockQuantity(props.item));

const batchOptions = computed(() => {
	const available = getDisplayableBatchOptions(props.item?.batch_no_data);
	const currentBatch = String(props.item?.batch_no || "").trim();
	if (!currentBatch || available.some((batch) => batch.batch_no === currentBatch)) {
		return available;
	}
	const currentRow = Array.isArray(props.item?.batch_no_data)
		? props.item.batch_no_data.find((batch: any) => batch?.batch_no === currentBatch)
		: null;
	return currentRow ? [currentRow, ...available] : available;
});

const usedSerialsElsewhere = computed(() => {
	const used = new Set<string>();
	for (const line of props.cartItems || []) {
		if (!line || line.posa_row_id === props.item?.posa_row_id) continue;
		getSelectedSerials(line).forEach((serial) => used.add(serial));
	}
	return used;
});

const serialOptions = computed(() => {
	const rows = Array.isArray(props.item?.serial_no_data)
		? props.item.serial_no_data
		: [];
	return rows.filter((row: any) => {
		const serial = String(row?.serial_no || "").trim();
		if (!serial || usedSerialsElsewhere.value.has(serial)) return false;
		if (workingBatch.value && row?.batch_no) {
			return String(row.batch_no) === workingBatch.value;
		}
		return true;
	});
});

const serialSelectionHint = computed(() => {
	if (props.item?.has_batch_no && !workingBatch.value) {
		return __("Select a batch first to filter its serial numbers.");
	}
	return __("Already-used serial numbers are hidden.");
});

const getBatchAvailableQty = (batch: any) =>
	batch?.available_qty ?? batch?.remaining_qty ?? batch?.batch_qty ?? 0;
const hasPositiveBatchPrice = (batch: any) => Number(batch?.batch_price) > 0;
const getOptionRaw = (option: any) => option?.raw || {};

const initializeDraft = () => {
	workingBatch.value = props.item?.batch_no || null;
	workingSerials.value = getSelectedSerials(props.item);
	errorMessage.value = "";
};

watch(
	() => [props.modelValue, props.item?.posa_row_id],
	([visible]) => {
		if (visible) initializeDraft();
	},
	{ immediate: true },
);

const handleBatchChange = () => {
	const validSerials = new Set(serialOptions.value.map((row: any) => row.serial_no));
	workingSerials.value = workingSerials.value.filter((serial) => validSerials.has(serial));
	errorMessage.value = "";
};

const restoreAutomaticSelection = () => initializeDraft();

const cancel = () => {
	initializeDraft();
	dialogVisible.value = false;
};

const save = () => {
	if (!props.item) return;
	const duplicateInCart = workingSerials.value.find((serial) =>
		usedSerialsElsewhere.value.has(serial),
	);
	if (duplicateInCart) {
		errorMessage.value = `Serial ${duplicateInCart} is already selected on another cart line`;
		return;
	}
	const issues = validateBatchSerialSelection(
		props.item,
		{
			batchNo: workingBatch.value,
			serials: workingSerials.value,
		},
		{ isReturnInvoice: props.isReturnInvoice },
	);
	if (issues.length) {
		errorMessage.value = issues[0]?.message || __("Invalid batch or serial selection");
		return;
	}
	emit("save", {
		batchNo: workingBatch.value,
		serials: [...workingSerials.value],
	});
	dialogVisible.value = false;
};
</script>

<style scoped>
.posa-batch-serial-dialog :deep(.v-card-text) {
	padding-top: 20px;
}

.posa-batch-serial-dialog {
	border-top: 4px solid var(--pos-primary, #1976d2);
}

.posa-batch-serial-dialog :deep(.v-card-title) {
	background: var(--pos-surface-variant, rgba(25, 118, 210, 0.08));
}
</style>
