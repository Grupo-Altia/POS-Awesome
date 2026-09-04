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

		<!-- Banner: Totales en las 3 Monedas (DominaPOS Arquitectura §5.2 y §6) -->
		<v-col cols="12" v-if="invoice_doc" class="py-1">
			<div class="pa-2 rounded-lg border bg-surface d-flex justify-space-between align-center ga-2">
				<div class="text-center flex-grow-1 pa-2 rounded bg-grey-lighten-4 border">
					<div class="text-caption text-grey-darken-2 font-weight-bold">Total Bolívares</div>
					<div class="text-subtitle-2 font-weight-black text-primary">
						{{ formatCurrencyCustom(veTotals.totals_by_currency.VEF, "Bs.") }}
					</div>
				</div>
				<div class="text-center flex-grow-1 pa-2 rounded bg-grey-lighten-4 border">
					<div class="text-caption text-grey-darken-2 font-weight-bold">Total Dólares (+3% IGTF)</div>
					<div class="text-subtitle-2 font-weight-black text-success">
						$ {{ veTotals.totals_by_currency.USD.toFixed(2) }}
					</div>
				</div>
				<div class="text-center flex-grow-1 pa-2 rounded bg-grey-lighten-4 border">
					<div class="text-caption text-grey-darken-2 font-weight-bold">Total Euros (+3% IGTF)</div>
					<div class="text-subtitle-2 font-weight-black text-info">
						€ {{ veTotals.totals_by_currency.EUR.toFixed(2) }}
					</div>
				</div>
			</div>
		</v-col>

		<!-- Liquidación Fiscal SENIAT y Cobro en Curso (§5.2) -->
		<v-col cols="12" v-if="invoice_doc" class="py-1">
			<div class="pa-3 rounded-lg border" style="background: rgba(var(--v-theme-surface-variant), 0.25); border-left: 4px solid #4CAF50 !important;">
				<div class="d-flex justify-space-between align-center mb-2">
					<span class="text-caption font-weight-bold text-success d-flex align-center">
						<v-icon size="16" class="mr-1">mdi-bank</v-icon>
						Liquidación Fiscal (Tasas: ${{ exchangeRateUSD.toFixed(2) }} | €{{ exchangeRateEUR.toFixed(2) }})
					</span>
					<v-chip size="x-small" color="success" variant="tonal">SENIAT</v-chip>
				</div>

				<div class="d-flex justify-space-between text-caption py-0-5 text-grey-darken-1">
					<span>Base Imponible (Gravable 16%):</span>
					<strong>{{ formatCurrencyCustom(veTotals.subtotal, "Bs.") }}</strong>
				</div>

				<div class="d-flex justify-space-between text-caption py-0-5 text-info">
					<span>+ IVA (16%):</span>
					<strong>{{ formatCurrencyCustom(veTotals.tax_total, "Bs.") }}</strong>
				</div>

				<div class="d-flex justify-space-between text-caption py-0-5 font-weight-medium">
					<span>Total Factura (con IVA):</span>
					<strong>{{ formatCurrencyCustom(veTotals.total, "Bs.") }}</strong>
				</div>

				<div class="d-flex justify-space-between text-caption py-0-5 font-weight-medium" :class="veTotals.igtf_amount > 0 ? 'text-warning' : 'text-success'">
					<span>+ IGTF Divisas (3%):</span>
					<strong v-if="veTotals.igtf_amount > 0">
						{{ formatCurrencyCustom(veTotals.igtf_amount, "Bs.") }} (≈ $ {{ (veTotals.igtf_amount / exchangeRateUSD).toFixed(2) }})
					</strong>
					<strong v-else class="text-success font-weight-regular">
						Bs. 0,00 — Exento / No aplica
					</strong>
				</div>

				<v-divider class="my-2"></v-divider>

				<div class="d-flex justify-space-between text-subtitle-2 font-weight-bold py-1">
					<span>Total a Cobrar:</span>
					<span class="text-primary font-weight-black">
						{{ formatCurrencyCustom(veTotals.total_to_pay, "Bs.") }}
					</span>
				</div>

				<!-- Saldo Pendiente por Moneda (§6 pending_by_currency) -->
				<div v-if="veTotals.pending > 0" class="mt-2 pt-2 border-t text-caption">
					<div class="font-weight-bold text-error mb-1 d-flex align-center">
						<v-icon size="14" class="mr-1">mdi-clock-outline</v-icon>
						Restante para cerrar venta:
					</div>
					<div class="d-flex justify-space-between text-caption text-grey-darken-2">
						<span>En Bs: <strong>{{ formatCurrencyCustom(veTotals.pending_by_currency.VEF, "Bs.") }}</strong></span>
						<span>En USD: <strong>$ {{ veTotals.pending_by_currency.USD.toFixed(2) }}</strong></span>
						<span>En EUR: <strong>€ {{ veTotals.pending_by_currency.EUR.toFixed(2) }}</strong></span>
					</div>
				</div>

				<!-- Vuelto Multimoneda (§8.3) -->
				<div v-if="veTotals.change > 0" class="mt-2 pt-2 border-t">
					<div class="d-flex justify-space-between align-center mb-1">
						<span class="text-caption font-weight-bold text-success">
							<v-icon size="16" class="mr-1">mdi-cash-refund</v-icon>
							Vuelto Disponible:
						</span>
						<v-btn-toggle v-model="changeCurrencyChoice" mandatory density="compact" size="x-small">
							<v-btn value="VEF" size="x-small" variant="tonal" color="success">En Bs</v-btn>
							<v-btn value="USD" size="x-small" variant="tonal" color="primary">En USD</v-btn>
						</v-btn-toggle>
					</div>
					<div class="d-flex justify-space-between text-caption font-weight-bold text-success">
						<span>Monto a entregar:</span>
						<span>
							{{ changeCurrencyChoice === 'USD' ? `$ ${veTotals.change_usd.toFixed(2)} USD` : formatCurrencyCustom(veTotals.change, "Bs.") }}
						</span>
					</div>
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

const {
	exchangeRateUSD,
	exchangeRateEUR,
	formatCurrencyCustom,
	selectedPaymentType,
	changeCurrencyChoice,
	calculatePosTotals,
} = useVenezuelaMock();

const veTotals = computed(() => {
	const totalBs = Number(props.invoice_doc?.grand_total || 0);
	const payments = props.invoice_doc?.payments || [];
	return calculatePosTotals(totalBs, payments);
});

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
