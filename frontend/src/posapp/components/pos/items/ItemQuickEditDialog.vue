<template>
	<v-dialog
		:model-value="modelValue"
		max-width="980"
		persistent
		@update:model-value="emit('update:modelValue', $event)"
	>
		<v-card class="item-quick-edit pos-themed-card">
			<v-card-title class="item-quick-edit__title">
				<div>
					<div class="text-h6">{{ __("Item Quick Edit") }}</div>
					<div v-if="form.item_code" class="text-caption text-medium-emphasis">
						{{ form.item_code }}
					</div>
				</div>
				<v-spacer></v-spacer>
				<v-btn icon="mdi-close" variant="text" :disabled="saving" @click="close"></v-btn>
			</v-card-title>

			<v-card-text>
				<v-alert
					v-if="errorMessage"
					type="error"
					density="compact"
					variant="tonal"
					class="mb-3"
				>
					{{ errorMessage }}
				</v-alert>
				<v-alert
					v-if="loaded && !canSave"
					type="warning"
					density="compact"
					variant="tonal"
					class="mb-3"
				>
					{{ __("A POS supervisor with Item Quick Edit enabled is required to save changes.") }}
				</v-alert>

				<v-form ref="formRef" @submit.prevent="save">
					<div class="item-quick-edit__lookup">
						<v-text-field
							ref="lookupField"
							v-model.trim="lookupValue"
							:label="__('Item Code or Barcode')"
							density="compact"
							variant="outlined"
							hide-details
							prepend-inner-icon="mdi-barcode-scan"
							:disabled="loading || saving"
							@keydown.enter.prevent="loadByLookup"
						></v-text-field>
						<v-btn
							color="primary"
							variant="tonal"
							:loading="loading"
							:disabled="!lookupValue || saving"
							@click="loadByLookup"
						>
							{{ __("Load") }}
						</v-btn>
					</div>

					<div class="item-quick-edit__grid mt-4">
						<div class="item-quick-edit__section">
							<div class="item-quick-edit__section-title">{{ __("Identity") }}</div>
							<v-row dense>
								<v-col cols="12" md="4">
									<v-text-field
										v-model="form.item_code"
										:label="__('Item Code')"
										density="compact"
										variant="outlined"
										readonly
									></v-text-field>
								</v-col>
								<v-col cols="12" md="8">
									<v-text-field
										v-model="form.item_name"
										:label="__('Name')"
										density="compact"
										variant="outlined"
										:rules="[(v) => !!v || __('* Required')]"
										:disabled="!loaded"
									></v-text-field>
								</v-col>
								<v-col cols="12" md="6">
									<v-text-field
										v-model="form.retailmind_short_name"
										:label="__('Short Name')"
										density="compact"
										variant="outlined"
										:disabled="!loaded"
									></v-text-field>
								</v-col>
								<v-col cols="12" md="6">
									<v-text-field
										v-model="form.barcode"
										:label="__('Barcode')"
										density="compact"
										variant="outlined"
										:disabled="!loaded"
									></v-text-field>
								</v-col>
								<v-col cols="12" md="6">
									<v-autocomplete
										v-model="form.item_group"
										:items="options.item_groups"
										:label="__('Item Group')"
										density="compact"
										variant="outlined"
										:rules="[(v) => !!v || __('* Required')]"
										:disabled="!loaded"
									></v-autocomplete>
								</v-col>
								<v-col cols="12" md="6">
									<v-text-field
										v-model="form.retailmind_old_pos_generic_name"
										:label="__('Generic')"
										density="compact"
										variant="outlined"
										:disabled="!loaded"
									></v-text-field>
								</v-col>
								<v-col cols="12" md="6">
									<v-text-field
										v-model="form.retailmind_old_pos_pack"
										:label="__('Pack')"
										density="compact"
										variant="outlined"
										:disabled="!loaded"
									></v-text-field>
								</v-col>
								<v-col cols="12" md="6">
									<v-autocomplete
										v-model="form.primary_supplier"
										:items="options.suppliers"
										:label="__('Primary Supplier')"
										density="compact"
										variant="outlined"
										clearable
										:disabled="!loaded"
									></v-autocomplete>
								</v-col>
							</v-row>
						</div>

						<div class="item-quick-edit__section">
							<div class="item-quick-edit__section-title">{{ __("Pricing") }}</div>
							<v-row dense>
								<v-col cols="12" md="6">
									<v-text-field
										v-model.number="form.retail_price"
										:label="__('Retail Price')"
										type="number"
										min="0"
										step="0.01"
										density="compact"
										variant="outlined"
										prefix="Rs"
										:disabled="!loaded"
									></v-text-field>
								</v-col>
								<v-col cols="12" md="6">
									<v-text-field
										v-model.number="form.trade_price"
										:label="__('Trade Price')"
										type="number"
										min="0"
										step="0.01"
										density="compact"
										variant="outlined"
										prefix="Rs"
										:disabled="!loaded"
									></v-text-field>
								</v-col>
								<v-col cols="12" md="6">
									<v-text-field
										v-model.number="form.retailmind_units_per_pack"
										:label="__('Unit in a Pack')"
										type="number"
										min="0"
										step="1"
										density="compact"
										variant="outlined"
										:disabled="!loaded"
									></v-text-field>
								</v-col>
								<v-col cols="12" md="6">
									<v-text-field
										v-model.number="form.max_discount"
										:label="__('Disc. on Retail')"
										type="number"
										min="0"
										max="100"
										step="0.01"
										density="compact"
										variant="outlined"
										suffix="%"
										:disabled="!loaded"
									></v-text-field>
								</v-col>
							</v-row>
						</div>

						<div class="item-quick-edit__section item-quick-edit__section--controls">
							<div class="item-quick-edit__section-title">{{ __("Controls") }}</div>
							<v-checkbox
								v-model="form.retailmind_controlled_item"
								:label="__('Steroid/Narcotics Item')"
								density="compact"
								hide-details
								:disabled="!loaded"
							></v-checkbox>
							<v-checkbox
								v-model="form.retailmind_non_discountable"
								:label="__('Imported/Non Discounted Item')"
								density="compact"
								hide-details
								:disabled="!loaded"
							></v-checkbox>
							<v-checkbox
								v-model="form.retailmind_locked_for_sale"
								:label="__('Lock for Sale')"
								density="compact"
								hide-details
								color="error"
								:disabled="!loaded"
							></v-checkbox>
						</div>
					</div>
				</v-form>
			</v-card-text>

			<v-card-actions class="px-5 pb-5">
				<v-spacer></v-spacer>
				<v-btn variant="text" color="error" :disabled="saving" @click="close">
					{{ __("Cancel") }}
				</v-btn>
				<v-btn
					color="primary"
					variant="tonal"
					:loading="saving"
					:disabled="!loaded || !canSave || !isOnline || loading"
					@click="save"
				>
					{{ __("Update") }}
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script setup lang="ts">
import { nextTick, reactive, ref, watch } from "vue";
import itemService from "../../../services/itemService";

declare const __: (_text: string, _args?: any[]) => string;

const props = withDefaults(
	defineProps<{
		modelValue: boolean;
		itemCode?: string;
		posProfile?: any;
		cashier?: string;
		isOnline?: boolean;
	}>(),
	{
		itemCode: "",
		isOnline: true,
	},
);

const emit = defineEmits<{
	"update:modelValue": [value: boolean];
	saved: [payload: any];
}>();

const lookupField = ref<any>(null);
const formRef = ref<any>(null);
const lookupValue = ref("");
const loading = ref(false);
const saving = ref(false);
const loaded = ref(false);
const canSave = ref(false);
const errorMessage = ref("");
const options = reactive({
	item_groups: [] as string[],
	suppliers: [] as string[],
});

const blankForm = () => ({
	item_code: "",
	item_name: "",
	description: "",
	item_group: "",
	brand: "",
	barcode: "",
	primary_supplier: "",
	retail_price: null as number | null,
	trade_price: null as number | null,
	selling_price_list: "",
	buying_price_list: "",
	max_discount: 0,
	retailmind_short_name: "",
	retailmind_old_pos_generic_code: "",
	retailmind_old_pos_generic_name: "",
	retailmind_old_pos_pack: "",
	retailmind_units_per_pack: 1,
	retailmind_controlled_item: false,
	retailmind_non_discountable: false,
	retailmind_locked_for_sale: false,
});

const form = reactive(blankForm());

const resetForm = () => {
	Object.assign(form, blankForm());
	loaded.value = false;
	canSave.value = false;
	errorMessage.value = "";
};

const normalizeItem = (item: any = {}) => ({
	...item,
	retailmind_controlled_item: Boolean(Number(item.retailmind_controlled_item || 0)),
	retailmind_non_discountable: Boolean(Number(item.retailmind_non_discountable || 0)),
	retailmind_locked_for_sale: Boolean(Number(item.retailmind_locked_for_sale || 0)),
	retailmind_units_per_pack: Number(item.retailmind_units_per_pack || 1),
	max_discount: Number(item.max_discount || 0),
	retail_price:
		item.retail_price === null || item.retail_price === undefined
			? null
			: Number(item.retail_price),
	trade_price:
		item.trade_price === null || item.trade_price === undefined
			? null
			: Number(item.trade_price),
});

const focusLookup = () => {
	nextTick(() => {
		const input = lookupField.value?.$el?.querySelector?.("input");
		input?.focus?.();
		input?.select?.();
	});
};

const loadItem = async (value: string) => {
	const query = String(value || "").trim();
	if (!query || !props.posProfile) {
		focusLookup();
		return;
	}

	loading.value = true;
	errorMessage.value = "";
	try {
		const payload = await itemService.getItemQuickEditData({
			item_code: query,
			barcode: query,
			pos_profile: props.posProfile,
		});
		const item = normalizeItem(payload?.item || {});
		Object.assign(form, blankForm(), item);
		options.item_groups = payload?.options?.item_groups || [];
		options.suppliers = payload?.options?.suppliers || [];
		canSave.value = Boolean(payload?.can_save);
		loaded.value = true;
		lookupValue.value = form.item_code || query;
	} catch (error: any) {
		resetForm();
		lookupValue.value = query;
		errorMessage.value = error?.message || __("Item was not found.");
		focusLookup();
	} finally {
		loading.value = false;
	}
};

const loadByLookup = () => loadItem(lookupValue.value);

const save = async () => {
	if (!loaded.value || saving.value) {
		return;
	}
	const validation = await formRef.value?.validate?.();
	if (validation && validation.valid === false) {
		return;
	}

	saving.value = true;
	errorMessage.value = "";
	try {
		const payload = await itemService.saveItemQuickEditData({
			...form,
			pos_profile: props.posProfile,
			cashier: props.cashier,
			retailmind_controlled_item: form.retailmind_controlled_item ? 1 : 0,
			retailmind_non_discountable: form.retailmind_non_discountable ? 1 : 0,
			retailmind_locked_for_sale: form.retailmind_locked_for_sale ? 1 : 0,
		});
		emit("saved", payload);
		emit("update:modelValue", false);
	} catch (error: any) {
		errorMessage.value = error?.message || __("Unable to update item.");
	} finally {
		saving.value = false;
	}
};

const close = () => {
	emit("update:modelValue", false);
};

watch(
	() => props.modelValue,
	(open) => {
		if (!open) {
			return;
		}
		resetForm();
		lookupValue.value = props.itemCode || "";
		if (lookupValue.value) {
			void loadItem(lookupValue.value);
		} else {
			focusLookup();
		}
	},
);
</script>

<style scoped>
.item-quick-edit__title {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 18px 20px 8px;
}

.item-quick-edit__lookup {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: 10px;
	align-items: start;
}

.item-quick-edit__grid {
	display: grid;
	grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.8fr);
	gap: 14px;
}

.item-quick-edit__section {
	border: 1px solid rgba(var(--v-border-color), 0.18);
	border-radius: 8px;
	padding: 14px;
	background: rgba(var(--v-theme-surface), 0.96);
}

.item-quick-edit__section--controls {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.item-quick-edit__section-title {
	font-size: 0.86rem;
	font-weight: 700;
	margin-bottom: 12px;
	color: rgb(var(--v-theme-primary));
	text-transform: uppercase;
}

@media (max-width: 820px) {
	.item-quick-edit__grid,
	.item-quick-edit__lookup {
		grid-template-columns: 1fr;
	}
}
</style>
