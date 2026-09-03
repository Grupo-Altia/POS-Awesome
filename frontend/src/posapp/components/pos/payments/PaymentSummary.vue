<template>
	<v-row v-if="invoice_doc" class="payment-summary-grid" dense>
		<v-col cols="12" sm="7">
			<v-text-field
				variant="solo"
				color="primary"
				:label="frappe._('Paid Amount')"
				class="sleek-field pos-themed-input"
				hide-details
				:model-value="total_payments_display"
				readonly
				:prefix="currencySymbol(invoice_doc.currency)"
				density="compact"
				@click="$emit('show-paid-amount')"
			></v-text-field>
		</v-col>
		<v-col cols="12" sm="5">
			<v-text-field
				variant="solo"
				color="primary"
				:label="diff_label"
				class="sleek-field pos-themed-input"
				hide-details
				:model-value="diff_payment_display"
				:prefix="currencySymbol(invoice_doc.currency)"
				density="compact"
				@focus="$emit('show-diff-payment')"
				persistent-placeholder
			></v-text-field>
		</v-col>

		<v-col v-if="baseCurrency" cols="12">
			<div
				class="payment-summary-base"
				:data-state="baseSettlementState"
				data-test="payment-base-settlement"
			>
				<div>
					<p class="payment-summary-base__label">{{ baseSettlementLabel }}</p>
					<p class="payment-summary-base__meta">
						{{ frappe._("Exact company-currency settlement") }}
					</p>
				</div>
				<strong class="payment-summary-base__amount">
					{{ currencySymbol(baseCurrency) }}
					{{ formatCurrency(Math.abs(baseSettlement?.difference || 0)) }}
				</strong>
			</div>
		</v-col>

		<!-- Venezuela Multi-currency, IVA & IGTF Liquidation Card (Demo Mockup) -->
		<v-col cols="12" v-if="invoice_doc">
			<div class="pa-3 rounded-lg border" style="background: rgba(var(--v-theme-surface-variant), 0.25); border-left: 4px solid #4CAF50 !important;">
				<div class="d-flex justify-space-between align-center mb-2">
					<span class="text-caption font-weight-bold text-success d-flex align-center">
						<v-icon size="16" class="mr-1">mdi-bank</v-icon>
						Liquidación Fiscal Venezuela (Tasa: {{ exchangeRate.toFixed(2) }} Bs/$)
					</span>
					<v-chip size="x-small" color="success" variant="tonal">Demo SENIAT</v-chip>
				</div>

				<div class="d-flex justify-space-between text-caption py-0-5 text-grey-darken-1">
					<span>Base Imponible (Gravable 16%):</span>
					<strong>{{ formatCurrencyCustom(veBaseBs, "Bs.") }} (≈ {{ formatCurrencyCustom(veBaseUSD, "$") }})</strong>
				</div>

				<div class="d-flex justify-space-between text-caption py-0-5 text-info">
					<span>+ IVA (16%):</span>
					<strong>{{ formatCurrencyCustom(veTaxesBs, "Bs.") }} (≈ {{ formatCurrencyCustom(veTaxesUSD, "$") }})</strong>
				</div>

				<div class="d-flex justify-space-between text-caption py-0-5 font-weight-medium">
					<span>Total Factura (con IVA):</span>
					<strong>{{ formatCurrencyCustom(veSubtotalBs, "Bs.") }} (≈ {{ formatCurrencyCustom(veSubtotalUSD, "$") }})</strong>
				</div>

				<div class="d-flex justify-space-between text-caption py-0-5 font-weight-medium" :class="selectedPaymentType === 'usd' ? 'text-warning' : 'text-success'">
					<span>{{ selectedPaymentType === 'usd' ? '+ IGTF Divisas (3%):' : 'IGTF Moneda Nacional (0%):' }}</span>
					<strong v-if="selectedPaymentType === 'usd'">{{ formatCurrencyCustom(veIgtfBs, "Bs.") }} (≈ {{ formatCurrencyCustom(veIgtfUSD, "$") }})</strong>
					<strong v-else class="text-success font-weight-regular">Bs. 0,00 ($ 0,00) — No aplica (Moneda Nacional)</strong>
				</div>

				<v-divider class="my-2"></v-divider>

				<div class="d-flex justify-space-between text-subtitle-2 font-weight-bold py-1">
					<span>{{ selectedPaymentType === 'usd' ? 'Total a Cobrar con IGTF:' : 'Total a Cobrar:' }}</span>
					<span class="text-primary font-weight-black">
						{{ formatCurrencyCustom(veTotalWithIgtfBs, "Bs.") }}
						<span class="text-caption font-weight-bold text-grey-darken-1">/ {{ formatCurrencyCustom(veTotalWithIgtfUSD, "$") }}</span>
					</span>
				</div>

				<div v-if="veChangeUSD > 0 || veChangeBs > 0" class="d-flex justify-space-between text-caption font-weight-bold pt-1 text-success">
					<span>Vuelto Sugerido:</span>
					<span>{{ formatCurrencyCustom(veChangeUSD, "$") }} (o {{ formatCurrencyCustom(veChangeBs, "Bs.") }})</span>
				</div>
			</div>
		</v-col>

		<v-col v-if="invoice_doc && giftCardAppliedAmount > 0" cols="12">
			<div class="payment-summary-pill payment-summary-pill--gift-card">
				<div class="payment-summary-pill__copy">
					<p class="payment-summary-pill__label">{{ frappe._("Gift Card Applied") }}</p>
					<h4 class="payment-summary-pill__amount">
						{{ formatCurrency(giftCardAppliedAmount) }}
					</h4>
					<p class="payment-summary-pill__meta">
						{{ giftCardCode || frappe._("Gift card") }}
						<span class="payment-summary-pill__dot">•</span>
						{{ frappe._("Included in settlement") }}
					</p>
				</div>
				<span class="payment-summary-pill__state">{{ frappe._("Applied") }}</span>
			</div>
		</v-col>

		<!-- Paid Change (if applicable) -->
		<v-col cols="12" sm="7" v-if="invoice_doc && change_due > 0 && !invoice_doc.is_return">
			<v-text-field
				variant="solo"
				color="primary"
				:label="frappe._('Paid Change')"
				class="sleek-field pos-themed-input"
				:model-value="formatCurrency(paid_change)"
				:prefix="currencySymbol(invoice_doc.currency)"
				:rules="paid_change_rules"
				density="compact"
				readonly
				type="text"
				@click="$emit('show-paid-change')"
			></v-text-field>
		</v-col>

		<!-- Credit Change (if applicable) -->
		<v-col cols="12" sm="5" v-if="invoice_doc && change_due > 0 && !invoice_doc.is_return">
			<v-text-field
				variant="solo"
				color="primary"
				:label="frappe._('Credit Change')"
				class="sleek-field pos-themed-input"
				:model-value="formatCurrency(Math.abs(credit_change))"
				:prefix="currencySymbol(invoice_doc.currency)"
				density="compact"
				type="text"
				@change="$emit('update-credit-change', $event)"
			></v-text-field>
		</v-col>
	</v-row>
</template>

<script setup>
import { computed } from "vue";
import { useVenezuelaMock } from "../../../composables/pos/useVenezuelaMock";

const { exchangeRate, toUSD, toBs, computeIgtf, formatCurrencyCustom, selectedPaymentType } = useVenezuelaMock();

const veGrandTotalBs = computed(() => Number(props.invoice_doc?.grand_total || 0));

const veTaxesBs = computed(() => {
	const realTaxes = Number(props.invoice_doc?.total_taxes_and_charges || 0);
	if (realTaxes > 0) return realTaxes;
	// Si no hay impuestos en la plantilla POS, desglosar el 16% de IVA estándar venezolano
	return Math.round((veGrandTotalBs.value - (veGrandTotalBs.value / 1.16)) * 100) / 100;
});

const veBaseBs = computed(() => {
	const realNet = Number(props.invoice_doc?.net_total || 0);
	if (Number(props.invoice_doc?.total_taxes_and_charges || 0) > 0) return realNet;
	return Math.round((veGrandTotalBs.value - veTaxesBs.value) * 100) / 100;
});

const veBaseUSD = computed(() => toUSD(veBaseBs.value));
const veTaxesUSD = computed(() => toUSD(veTaxesBs.value));

const veSubtotalBs = computed(() => veGrandTotalBs.value);
const veSubtotalUSD = computed(() => toUSD(veSubtotalBs.value));

const veIgtfUSD = computed(() => {
	if (selectedPaymentType.value === "bs") return 0;
	return computeIgtf(veSubtotalUSD.value, true);
});

const veIgtfBs = computed(() => {
	if (selectedPaymentType.value === "bs") return 0;
	return toBs(veIgtfUSD.value);
});

const veTotalWithIgtfUSD = computed(() => Math.round((veSubtotalUSD.value + veIgtfUSD.value) * 100) / 100);
const veTotalWithIgtfBs = computed(() => Math.round((veSubtotalBs.value + veIgtfBs.value) * 100) / 100);

const vePaidAmount = computed(() => {
	const payments = props.invoice_doc?.payments || [];
	return payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
});

const veChangeBs = computed(() => {
	if (vePaidAmount.value > veTotalWithIgtfBs.value) {
		return Math.round((vePaidAmount.value - veTotalWithIgtfBs.value) * 100) / 100;
	}
	return 0;
});

const veChangeUSD = computed(() => toUSD(veChangeBs.value));

const props = defineProps({
	invoice_doc: Object,
	total_payments_display: String,
	diff_payment_display: String,
	diff_label: String,
	diffPayment: {
		type: Number,
		default: 0,
	},
	change_due: Number,
	baseSettlement: Object,
	baseCurrency: String,
	paid_change: Number,
	credit_change: Number,
	paid_change_rules: Array,
	currencySymbol: Function,
	formatCurrency: Function,
	giftCardAppliedAmount: {
		type: Number,
		default: 0,
	},
	giftCardCode: {
		type: String,
		default: "",
	},
});

defineEmits(["show-paid-amount", "show-diff-payment", "show-paid-change", "update-credit-change"]);

const frappe = window.frappe;

const baseSettlementState = computed(() => {
	const difference = Number(props.baseSettlement?.difference || 0);
	if (difference > 0) return "remaining";
	if (difference < 0) return "change";
	return "balanced";
});

const baseSettlementLabel = computed(() => {
	if (baseSettlementState.value === "remaining") return frappe._("Base Remaining");
	if (baseSettlementState.value === "change") return frappe._("Base Change");
	return frappe._("Base Difference");
});
</script>

<style scoped>
.payment-summary-grid {
	margin: 0;
	row-gap: var(--pos-space-2);
}

.payment-summary-grid :deep(.v-col) {
	padding-top: 0;
	padding-bottom: 0;
}

.payment-summary-grid :deep(.v-field) {
	border-radius: var(--pos-radius-sm);
	background: var(--pos-surface-raised);
}

.payment-summary-base {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--pos-space-3);
	padding: 10px 14px;
	border: 1px solid var(--pos-border);
	border-radius: var(--pos-radius-sm);
	background: var(--pos-surface-raised);
}

.payment-summary-base[data-state="change"] {
	border-color: rgba(var(--v-theme-warning), 0.35);
	background: rgba(var(--v-theme-warning), 0.08);
}

.payment-summary-base[data-state="remaining"] {
	border-color: rgba(var(--v-theme-error), 0.3);
	background: rgba(var(--v-theme-error), 0.06);
}

.payment-summary-base__label,
.payment-summary-base__meta {
	margin: 0;
}

.payment-summary-base__label {
	font-size: 0.8rem;
	font-weight: 700;
	color: var(--pos-text-primary);
}

.payment-summary-base__meta {
	font-size: 0.72rem;
	color: var(--pos-text-secondary);
}

.payment-summary-base__amount {
	white-space: nowrap;
	color: var(--pos-text-primary);
}

.payment-summary-pill {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--pos-space-3);
	padding: 14px 16px;
	border-radius: var(--pos-radius-md);
	background:
		linear-gradient(
			180deg,
			rgba(var(--v-theme-success), 0.1) 0%,
			rgba(var(--v-theme-success), 0.04) 100%
		),
		var(--pos-surface-raised);
	border: 1px solid rgba(var(--v-theme-success), 0.18);
}

.payment-summary-pill__copy {
	min-width: 0;
}

.payment-summary-pill__label {
	margin: 0;
	font-size: 0.72rem;
	font-weight: 700;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--pos-text-secondary);
}

.payment-summary-pill__amount {
	margin: 4px 0 0;
	font-size: 1.05rem;
	font-weight: 700;
	color: var(--pos-text-primary);
}

.payment-summary-pill__meta {
	margin: 6px 0 0;
	font-size: 0.82rem;
	color: var(--pos-text-secondary);
}

.payment-summary-pill__dot {
	margin: 0 6px;
}

.payment-summary-pill__state {
	display: inline-flex;
	align-items: center;
	padding: 6px 10px;
	border-radius: 999px;
	background: rgba(var(--v-theme-success), 0.12);
	color: rgb(var(--v-theme-success));
	font-size: 0.74rem;
	font-weight: 700;
}
</style>
