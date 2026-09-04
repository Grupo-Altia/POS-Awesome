<template>
	<div v-if="payments && payments.length" class="payment-methods">
		<!-- Selector de Modo de Pago Venezuela: Efectivo Bs vs Efectivo USD vs Efectivo EUR -->
		<div class="ve-payment-type-selector mb-2 pa-3 rounded-lg border" style="background: rgba(var(--v-theme-surface-variant), 0.15);">
			<div class="text-caption font-weight-bold mb-2 d-flex align-center justify-space-between">
				<span class="d-flex align-center">
					<v-icon size="16" class="mr-1 text-primary">mdi-swap-horizontal</v-icon>
					Moneda de Cobro (Arquitectura Multi-Moneda):
				</span>
				<v-chip size="x-small" :color="selectedPaymentType === 'bs' ? 'success' : (selectedPaymentType === 'usd' ? 'warning' : 'info')" variant="flat">
					{{ selectedPaymentType === 'bs' ? 'Moneda Nacional (0% IGTF)' : 'Moneda Extranjera (+3% IGTF)' }}
				</v-chip>
			</div>
			<div class="d-flex ga-2 mb-3">
				<v-btn
					:color="selectedPaymentType === 'bs' ? 'primary' : undefined"
					:variant="selectedPaymentType === 'bs' ? 'flat' : 'outlined'"
					class="flex-grow-1 font-weight-bold"
					size="small"
					@click="selectCurrencyTab('bs')"
				>
					<v-icon start size="16">mdi-cash</v-icon>
					Efectivo Bs (0%)
				</v-btn>
				<v-btn
					:color="selectedPaymentType === 'usd' ? 'warning' : undefined"
					:variant="selectedPaymentType === 'usd' ? 'flat' : 'outlined'"
					class="flex-grow-1 font-weight-bold"
					size="small"
					@click="selectCurrencyTab('usd')"
				>
					<v-icon start size="16">mdi-currency-usd</v-icon>
					Efectivo USD (+3%)
				</v-btn>
				<v-btn
					:color="selectedPaymentType === 'eur' ? 'info' : undefined"
					:variant="selectedPaymentType === 'eur' ? 'flat' : 'outlined'"
					class="flex-grow-1 font-weight-bold"
					size="small"
					@click="selectCurrencyTab('eur')"
				>
					<v-icon start size="16">mdi-currency-eur</v-icon>
					Efectivo EUR (+3%)
				</v-btn>
			</div>

			<!-- Selector Desplegable de Método de Pago y Toggle de Vista -->
			<div class="d-flex align-center ga-2">
				<v-select
					v-model="selectedPrimaryMethod"
					:items="paymentOptionsList"
					item-title="title"
					item-value="value"
					density="compact"
					variant="solo"
					label="Método de Pago"
					prepend-inner-icon="mdi-credit-card-outline"
					hide-details
					class="flex-grow-1 font-weight-bold"
					color="primary"
					@update:model-value="onSelectPrimaryMethod"
				></v-select>
				<v-btn
					:icon="showAllMethods ? 'mdi-view-agenda-outline' : 'mdi-filter-variant'"
					size="small"
					variant="text"
					:color="showAllMethods ? 'primary' : 'default'"
					:title="showAllMethods ? 'Cambiar a Vista Select / Compacta' : 'Mostrar todos los métodos a la vez'"
					@click="showAllMethods = !showAllMethods"
				/>
			</div>
		</div>

		<div
			v-for="(payment, paymentIndex) in displayedPayments"
			:key="payment.name || payment.mode_of_payment"
			class="payment-method-card mb-2"
			:data-payment-shortcut-index="
				showKeyboardShortcuts && paymentIndex < 9 ? paymentIndex + 1 : undefined
			"
		>
			<div class="payment-method-card__header">
				<div>
					<p class="payment-method-card__label">{{ frappe._("Method") }}</p>
					<h4 class="payment-method-card__title">
						{{ payment.mode_of_payment }}
					</h4>
				</div>
				<div class="payment-method-card__badges">
					<span
						v-if="isReturn"
						class="payment-method-card__badge payment-method-card__badge--refund"
					>
						{{ __("Refund") }}
					</span>
					<span v-if="payment.default === 1" class="payment-method-card__badge">
						{{ __("Default") }}
					</span>
					<span
						v-if="payment._posa_auto_remainder"
						class="payment-method-card__badge payment-method-card__badge--auto"
					>
						{{ __("Auto remainder") }}
					</span>
					<v-btn
						v-if="!isMpesaC2bPayment(payment) && !isGiftCardPayment(payment)"
						icon
						size="x-small"
						variant="text"
						:color="payment._posa_remainder_locked ? 'warning' : 'secondary'"
						:title="remainderLockTitle(payment)"
						:data-test="`payment-remainder-lock-${payment.mode_of_payment}`"
						@click="$emit('toggle-remainder-lock', payment)"
					>
						<v-icon size="16">
							{{ payment._posa_remainder_locked ? "mdi-lock" : "mdi-lock-open-variant" }}
						</v-icon>
					</v-btn>
					<!-- Botón para quitar método si hay más de uno activo en modo compacto -->
					<v-btn
						v-if="!showAllMethods && displayedPayments.length > 1"
						icon="mdi-close"
						size="x-small"
						variant="text"
						color="error"
						title="Quitar este método"
						@click="removePayment(payment)"
					/>
					<kbd
						v-if="showKeyboardShortcuts && paymentIndex < 9"
						class="payment-method-card__shortcut"
					>
						Ctrl/⌘+{{ paymentIndex + 1 }}
					</kbd>
				</div>
			</div>

			<v-row class="payments ma-0" dense>
				<v-col
					v-if="!isMpesaC2bPayment(payment) && multiCurrencyEnabled"
					cols="12"
					md="3"
				>
					<v-select
						density="compact"
						variant="solo"
						class="sleek-field pos-themed-input"
						hide-details
						:label="frappe._('Tender Currency')"
						:items="allowedCurrencies"
						:model-value="payment.posa_payment_currency || currency"
						:readonly="!allowCurrencySelection"
						@update:model-value="$emit('update-currency', payment, $event)"
					></v-select>
				</v-col>
				<v-col cols="12" :md="multiCurrencyEnabled ? 4 : 7" v-if="!isMpesaC2bPayment(payment)">
					<v-text-field
						data-pos-keyboard-target="payment-amount"
						:data-testid="`payment-amount-${payment.mode_of_payment}`"
						density="compact"
						variant="solo"
						:color="isReturn ? 'error' : 'primary'"
						:label="frappe._('Amount')"
						:class="['sleek-field pos-themed-input', isReturn ? 'pos-themed-input--refund' : '']"
						hide-details
						:model-value="formatCurrency(getPaymentDisplayAmount(payment))"
						@focusin="$emit('set-rest-amount', payment, isReturn)"
						@change="onPaymentAmountChange(payment, $event)"
						:rules="[isNumber]"
						:prefix="getPaymentPrefix(payment)"
						@keydown.enter="blurTarget"
						@keydown.esc="blurTarget"
						:readonly="isGiftCardPayment(payment)"
					></v-text-field>
					<div class="payment-currency-equivalent mt-1 text-caption font-weight-medium">
						<span v-if="isUsdPayment(payment)" class="text-warning-darken-1">
							Equivalente: <strong>{{ formatCurrencyCustom(payment.amount || (getPaymentDisplayAmount(payment) * exchangeRateUSD), 'Bs.') }}</strong> (Tasa: ${{ exchangeRateUSD.toFixed(2) }})
						</span>
						<span v-else-if="isEurPayment(payment)" class="text-info-darken-1">
							Equivalente: <strong>{{ formatCurrencyCustom(payment.amount || (getPaymentDisplayAmount(payment) * exchangeRateEUR), 'Bs.') }}</strong> (Tasa: €{{ exchangeRateEUR.toFixed(2) }})
						</span>
						<span v-else-if="multiCurrencyEnabled" class="text-grey-darken-1">
							<span v-if="payment._posa_rate_error" class="payment-currency-equivalent--error">
								{{ __("Exchange rate unavailable") }}
							</span>
							<span v-else>
								{{ __("Invoice equivalent") }}:
								{{ currencySymbol(currency) }}{{ formatCurrency(payment.amount) }}
							</span>
						</span>
						<span v-else class="text-grey-darken-1">
							Equivalente: <strong>$ {{ ((payment.amount || 0) / exchangeRateUSD).toFixed(2) }} USD</strong>
						</span>
					</div>
				</v-col>
				<v-col cols="12" :md="multiCurrencyEnabled ? 5 : 5" v-if="!isMpesaC2bPayment(payment)">
					<v-text-field
						v-if="allowManualRate && payment.posa_payment_currency !== currency"
						density="compact"
						variant="solo"
						class="sleek-field pos-themed-input mb-2"
						hide-details
						type="number"
						min="0"
						step="any"
						:label="frappe._('Rate to Invoice Currency')"
						:model-value="payment.posa_exchange_rate"
						@change="$emit('update-rate', payment, $event)"
					></v-text-field>
					<div class="payment-method-actions">
						<v-btn
							block
							:color="isUsdPayment(payment) ? 'warning' : (isEurPayment(payment) ? 'info' : 'primary')"
							variant="flat"
							class="payment-method-action-btn font-weight-bold"
							data-pos-keyboard-target="payment-action"
							:data-test="`payment-method-action-${payment.mode_of_payment}`"
							:aria-keyshortcuts="
								showKeyboardShortcuts && paymentIndex < 9
									? `Control+${paymentIndex + 1} Meta+${paymentIndex + 1}`
									: undefined
							"
							@click="handlePrimaryAction(payment)"
						>
							{{ isGiftCardPayment(payment) ? __("Redeem / Scan") : (isReturn ? 'Reembolsar' : (isUsdPayment(payment) ? 'Cobrar en USD' : (isEurPayment(payment) ? 'Cobrar en EUR' : 'Cobrar en Bs'))) }}
						</v-btn>
					</div>
				</v-col>

				<!-- Referencia bancaria para medios electrónicos -->
				<v-col cols="12" class="pt-1 pb-1" v-if="!payment.mode_of_payment.toLowerCase().startsWith('efectivo')">
					<v-text-field
						v-model="payment.reference_no"
						density="compact"
						variant="solo"
						:label="`Nro. Referencia (${payment.mode_of_payment})`"
						placeholder="Ej. 984512"
						prefix="#"
						class="sleek-field pos-themed-input"
						hide-details
					></v-text-field>
				</v-col>

				<v-col
					cols="12"
					v-if="
						(isCashLikePayment(payment) || isUsdPayment(payment) || isEurPayment(payment)) &&
						getPaymentDenominations(payment).length
					"
					class="pa-0"
				>
					<div class="payment-denominations d-flex ga-1 flex-wrap">
						<v-btn
							v-for="d in getPaymentDenominations(payment)"
							:key="d"
							size="small"
							color="secondary"
							variant="tonal"
							class="payment-denominations__btn font-weight-bold"
							data-pos-keyboard-target="payment-denomination"
							@click="onSelectDenomination(payment, d)"
						>
							{{ getPaymentPrefix(payment) }} {{ Number(d).toFixed(isUsdPayment(payment) || isEurPayment(payment) ? 2 : 0) }}
						</v-btn>
					</div>
				</v-col>

				<v-col cols="12" v-if="isMpesaC2bPayment(payment)" class="pa-0">
					<v-btn
						block
						color="success"
						variant="flat"
						class="payment-method-action-btn payment-method-action-btn--success"
						data-pos-keyboard-target="payment-action"
						:aria-keyshortcuts="
							showKeyboardShortcuts && paymentIndex < 9
								? `Control+${paymentIndex + 1} Meta+${paymentIndex + 1}`
								: undefined
						"
						@click="$emit('mpesa-dialog', payment)"
					>
						{{ __("Get Payments") }}
					</v-btn>
				</v-col>

				<v-col
					cols="12"
					v-if="payment.type === 'Phone' && payment.amount > 0 && requestPaymentField"
					class="pa-0"
				>
					<v-btn
						block
						color="success"
						variant="tonal"
						class="payment-method-action-btn payment-method-action-btn--secondary"
						data-pos-keyboard-target="payment-action"
						:disabled="payment.amount === 0"
						@click="$emit('request-payment', payment)"
					>
						{{ __("Request Payment") }}
					</v-btn>
				</v-col>
			</v-row>
		</div>

		<!-- Botón para Agregar otro método de pago si es Pago Mixto -->
		<div
			v-if="!showAllMethods && availableToAddMethods.length > 0"
			class="d-flex align-center justify-space-between mt-2 pa-2 rounded-lg border"
			style="background: rgba(var(--v-theme-surface-variant), 0.1);"
		>
			<v-menu location="bottom start">
				<template #activator="{ props: menuProps }">
					<v-btn
						v-bind="menuProps"
						variant="tonal"
						color="primary"
						size="small"
						prepend-icon="mdi-plus-circle-outline"
						class="font-weight-bold"
					>
						➕ Agregar otro método (Pago Mixto)
					</v-btn>
				</template>
				<v-list density="compact">
					<v-list-item
						v-for="opt in availableToAddMethods"
						:key="opt.mode_of_payment"
						:title="opt.mode_of_payment"
						prepend-icon="mdi-wallet-plus"
						@click="addAdditionalMethod(opt.mode_of_payment)"
					/>
				</v-list>
			</v-menu>
			<span class="text-caption text-medium-emphasis">
				{{ displayedPayments.length }} de {{ payments.length }} métodos activos
			</span>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useVenezuelaMock } from "../../../composables/pos/useVenezuelaMock";

const {
	selectedPaymentType,
	setPaymentType,
	exchangeRateUSD,
	exchangeRateEUR,
	formatCurrencyCustom,
} = useVenezuelaMock();

const showAllMethods = ref(false);
const selectedPrimaryMethod = ref("");
const additionalActiveMethods = ref(new Set());

const frappe = window.frappe;
const __ = window.__;

const props = defineProps({
	payments: Array,
	currency: String,
	isReturn: Boolean,
	invoiceDoc: Object,
	requestPaymentField: Boolean,
	multiCurrencyEnabled: Boolean,
	allowCurrencySelection: Boolean,
	allowManualRate: Boolean,
	allowedCurrencies: {
		type: Array,
		default: () => [],
	},
	currencySymbol: Function,
	formatCurrency: Function,
	isNumber: Function,
	getVisibleDenominations: Function,
	isCashLikePayment: Function,
	isMpesaC2bPayment: Function,
	isGiftCardPayment: {
		type: Function,
		default: () => false,
	},
	showKeyboardShortcuts: Boolean,
});

const emit = defineEmits([
	"update-amount",
	"update-currency",
	"update-rate",
	"set-rest-amount",
	"toggle-remainder-lock",
	"set-full-amount",
	"set-denomination",
	"mpesa-dialog",
	"request-payment",
	"open-gift-card",
]);

function isUsdPayment(payment) {
	const name = String(payment?.mode_of_payment || "").toLowerCase();
	const cur = String(payment?.posa_payment_currency || "").toUpperCase();
	return cur === "USD" || name.includes("usd") || name.includes("zelle") || name.includes("dolar");
}

function isEurPayment(payment) {
	const name = String(payment?.mode_of_payment || "").toLowerCase();
	const cur = String(payment?.posa_payment_currency || "").toUpperCase();
	return cur === "EUR" || name.includes("eur") || name.includes("euro");
}

function getPaymentPrefix(payment) {
	if (isUsdPayment(payment)) return "$";
	if (isEurPayment(payment)) return "€";
	return "Bs.";
}

function getPaymentDisplayAmount(payment) {
	if (isUsdPayment(payment)) {
		if (payment.posa_original_amount !== undefined && payment.posa_original_amount !== null && Number(payment.posa_original_amount) > 0) {
			return Number(payment.posa_original_amount);
		}
		if (payment.amount && Number(payment.amount) > 0) {
			const rate = exchangeRateUSD.value || 801.0;
			return Math.round((Number(payment.amount) / rate) * 100) / 100;
		}
		return 0;
	}
	if (isEurPayment(payment)) {
		if (payment.posa_original_amount !== undefined && payment.posa_original_amount !== null && Number(payment.posa_original_amount) > 0) {
			return Number(payment.posa_original_amount);
		}
		if (payment.amount && Number(payment.amount) > 0) {
			const rate = exchangeRateEUR.value || 850.0;
			return Math.round((Number(payment.amount) / rate) * 100) / 100;
		}
		return 0;
	}
	return Number(payment.amount || 0);
}

function onPaymentAmountChange(payment, event) {
	let rawVal = event && event.target ? event.target.value : event;
	if (typeof rawVal === "string") {
		rawVal = rawVal.replace(/,/g, "");
	}
	const num = parseFloat(rawVal) || 0;
	if (isUsdPayment(payment)) {
		const rate = exchangeRateUSD.value || 801.0;
		payment.posa_payment_currency = "USD";
		payment.posa_original_amount = num;
		payment.posa_exchange_rate = rate;
		payment.amount = Math.round(num * rate * 100) / 100;
		emit("update-amount", payment, num);
	} else if (isEurPayment(payment)) {
		const rate = exchangeRateEUR.value || 850.0;
		payment.posa_payment_currency = "EUR";
		payment.posa_original_amount = num;
		payment.posa_exchange_rate = rate;
		payment.amount = Math.round(num * rate * 100) / 100;
		emit("update-amount", payment, num);
	} else {
		payment.posa_payment_currency = "VEF";
		payment.amount = num;
		payment.posa_original_amount = num;
		emit("update-amount", payment, event);
	}
}

function getPaymentDenominations(payment) {
	if (isUsdPayment(payment) || isEurPayment(payment)) {
		const curr = getPaymentDisplayAmount(payment);
		const bills = [1, 5, 10, 20, 50, 100];
		const suggestions = bills.filter((b) => b >= Math.floor(curr));
		if (suggestions.length < 4) {
			return bills.slice(-4);
		}
		return suggestions.slice(0, 5);
	}
	return props.getVisibleDenominations ? props.getVisibleDenominations(payment) : [];
}

function onSelectDenomination(payment, d) {
	if (isUsdPayment(payment) || isEurPayment(payment)) {
		onPaymentAmountChange(payment, d);
	} else {
		emit("set-denomination", payment, d);
	}
}

function selectCurrencyTab(type) {
	setPaymentType(type);

	let target = null;
	if (type === "usd") {
		target =
			(props.payments || []).find((p) => isUsdPayment(p)) ||
			(props.payments || []).find((p) => p.mode_of_payment.toLowerCase().includes("usd"));
	} else if (type === "eur") {
		target =
			(props.payments || []).find((p) => isEurPayment(p)) ||
			(props.payments || []).find((p) => p.mode_of_payment.toLowerCase().includes("eur"));
	} else {
		target =
			(props.payments || []).find((p) => p.mode_of_payment === "Efectivo") ||
			(props.payments || []).find((p) => !isUsdPayment(p) && !isEurPayment(p));
	}

	if (!target) return;

	selectedPrimaryMethod.value = target.mode_of_payment;

	// Total in Bs to allocate: always the constant grand total of the invoice
	const totalBs = Number(
		props.invoiceDoc?.rounded_total || props.invoiceDoc?.grand_total || 0
	);

	// Zero out all other payments cleanly
	for (const p of props.payments || []) {
		if (p.mode_of_payment !== target.mode_of_payment) {
			p.amount = 0;
			p.base_amount = 0;
			p.posa_original_amount = 0;
			p._posa_auto_remainder = false;
		}
	}

	// Set target amount
	if (type === "usd") {
		const rate = exchangeRateUSD.value || 801.0;
		const usdAmount = Math.round((totalBs / rate) * 100) / 100;
		target.posa_payment_currency = "USD";
		target.posa_original_amount = usdAmount;
		target.posa_exchange_rate = rate;
		target.posa_rate_source = "manual";
		target.amount = totalBs;
		target.base_amount = totalBs;
		target._posa_auto_remainder = false;
		emit("update-amount", target, usdAmount);
	} else if (type === "eur") {
		const rate = exchangeRateEUR.value || 850.0;
		const eurAmount = Math.round((totalBs / rate) * 100) / 100;
		target.posa_payment_currency = "EUR";
		target.posa_original_amount = eurAmount;
		target.posa_exchange_rate = rate;
		target.posa_rate_source = "manual";
		target.amount = totalBs;
		target.base_amount = totalBs;
		target._posa_auto_remainder = false;
		emit("update-amount", target, eurAmount);
	} else {
		target.posa_payment_currency = "VEF";
		target.posa_original_amount = totalBs;
		target.posa_exchange_rate = 1.0;
		target.amount = totalBs;
		target.base_amount = totalBs;
		target._posa_auto_remainder = false;
		emit("update-amount", target, totalBs);
	}
}

const paymentOptionsList = computed(() => {
	return (props.payments || []).map((p) => ({
		title: p.mode_of_payment,
		value: p.mode_of_payment,
	}));
});

const displayedPayments = computed(() => {
	if (!props.payments || !props.payments.length) return [];
	if (showAllMethods.value) return props.payments;

	return props.payments.filter((p) => {
		if (p.mode_of_payment === selectedPrimaryMethod.value) return true;
		if (Math.abs(Number(p.amount || 0)) > 0.0001) return true;
		if (additionalActiveMethods.value.has(p.mode_of_payment)) return true;
		return false;
	});
});

const availableToAddMethods = computed(() => {
	const activeNames = new Set(displayedPayments.value.map((p) => p.mode_of_payment));
	return (props.payments || []).filter((p) => !activeNames.has(p.mode_of_payment));
});

function onSelectPrimaryMethod(mode) {
	selectedPrimaryMethod.value = mode;
	const lower = String(mode || "").toLowerCase();
	if (lower.includes("usd") || lower.includes("zelle")) {
		selectCurrencyTab("usd");
	} else if (lower.includes("eur")) {
		selectCurrencyTab("eur");
	} else {
		selectCurrencyTab("bs");
	}
}

function addAdditionalMethod(mode) {
	additionalActiveMethods.value.add(mode);
}

function removePayment(payment) {
	emit("update-amount", payment, 0);
	additionalActiveMethods.value.delete(payment.mode_of_payment);
	if (selectedPrimaryMethod.value === payment.mode_of_payment) {
		const remaining = displayedPayments.value.find(
			(p) => p.mode_of_payment !== payment.mode_of_payment
		);
		if (remaining) {
			selectedPrimaryMethod.value = remaining.mode_of_payment;
		}
	}
}

watch(
	() => props.payments,
	(newPayments) => {
		if (newPayments && newPayments.length) {
			const efectivoBs = newPayments.find(
				(p) => p.mode_of_payment === "Efectivo" || p.mode_of_payment?.toLowerCase() === "efectivo",
			);
			const def =
				efectivoBs ||
				newPayments.find(
					(p) =>
						(p.default === 1 || p.default === true) &&
						!isUsdPayment(p) &&
						!isEurPayment(p),
				) ||
				newPayments.find((p) => p.default === 1 || p.default === true) ||
				newPayments[0];

			if (
				!selectedPrimaryMethod.value ||
				selectedPrimaryMethod.value.toLowerCase().includes("usd")
			) {
				selectedPrimaryMethod.value = def ? def.mode_of_payment : "";
				setPaymentType("bs");
			}
		}
	},
	{ immediate: true }
);

const remainderLockTitle = (payment) =>
	payment?._posa_remainder_locked
		? __("Unlock automatic remainder")
		: __("Lock automatic remainder");

const handlePrimaryAction = (payment) => {
	if (props.isGiftCardPayment(payment)) {
		emit("open-gift-card", payment);
		return;
	}
	if (isUsdPayment(payment) || isEurPayment(payment)) {
		const val = getPaymentDisplayAmount(payment);
		if (val > 0) {
			onPaymentAmountChange(payment, val);
		}
	}
	emit("set-full-amount", payment, props.isReturn);
};

const blurTarget = (event) => {
	event?.target?.blur?.();
};
</script>

<style scoped>
.payment-methods {
	display: flex;
	flex-direction: column;
	gap: var(--pos-space-2);
}

.payment-method-card {
	background: var(--pos-surface-raised);
	border: 1px solid var(--pos-border-light);
	border-radius: var(--pos-radius-md);
	padding: var(--pos-space-3);
	display: flex;
	flex-direction: column;
	gap: var(--pos-space-3);
}

.payment-method-card__header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: var(--pos-space-2);
}

.payment-method-card__label {
	margin: 0 0 var(--pos-space-1);
	font-size: 0.72rem;
	font-weight: 700;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--pos-text-secondary);
}

.payment-method-card__title {
	margin: 0;
	font-size: 1rem;
	line-height: 1.2;
	font-weight: 700;
	color: var(--pos-text-primary);
}

.payment-method-card__badges {
	display: flex;
	gap: var(--pos-space-1);
	align-items: center;
	flex-wrap: wrap;
	justify-content: flex-end;
}

.payment-method-card__badge {
	padding: 6px 10px;
	border-radius: 999px;
	background: #174a70;
	color: #ffffff;
	font-size: 0.78rem;
	font-weight: 700;
	white-space: nowrap;
}

.payment-method-card__badge--refund {
	background: #9f1239;
	color: #ffffff;
}

.payment-method-card__shortcut {
	padding: 4px 7px;
	border: 1px solid var(--pos-border);
	border-bottom-width: 2px;
	border-radius: 3px;
	background: var(--pos-surface);
	color: var(--pos-text-secondary);
	font: inherit;
	font-size: 0.68rem;
	font-weight: 800;
	line-height: 1;
	white-space: nowrap;
}

:deep(.pos-themed-input--refund input) {
	color: rgb(var(--v-theme-error)) !important;
	font-weight: 700;
}

.payment-method-action-btn {
	--v-theme-overlay-multiplier: 0 !important;
	min-height: 44px;
	border-radius: var(--pos-radius-sm);
	font-weight: 700;
	text-transform: none;
	letter-spacing: 0.01em;
	transition:
		box-shadow 0.18s ease,
		background-color 0.18s ease,
		transform 0.18s ease !important;
	background-color: #0b5cab !important;
	color: #ffffff !important;
}

.payment-method-actions {
	display: block;
}

.payment-method-card__badge--auto {
	background: #0f766e;
	color: #ffffff;
}

.payment-currency-equivalent {
	margin-top: 6px;
	font-size: 0.75rem;
	color: var(--pos-text-secondary);
}

.payment-currency-equivalent--error {
	color: rgb(var(--v-theme-error));
	font-weight: 700;
}

.payment-method-action-btn:hover,
.payment-method-action-btn:focus,
.payment-method-action-btn:focus-visible,
.payment-method-action-btn:active {
	box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18) !important;
	transform: translateY(-1px);
	background-color: #084d96 !important;
}

.payment-method-action-btn:active {
	transform: translateY(0);
}

:deep(.payment-method-action-btn .v-btn__overlay),
:deep(.payment-method-action-btn .v-btn__underlay) {
	opacity: 0 !important;
	background: transparent !important;
}

:deep(.payment-method-action-btn .v-btn__content) {
	color: #ffffff !important;
}

.payment-method-action-btn--success {
	background: #047857 !important;
	color: #ffffff !important;
}

.payment-method-action-btn--success:hover,
.payment-method-action-btn--success:focus,
.payment-method-action-btn--success:focus-visible,
.payment-method-action-btn--success:active {
	background-color: #065f46 !important;
}

.payment-method-action-btn--secondary {
	background: #047857 !important;
	color: #ffffff !important;
}

.payment-method-action-btn--secondary:hover,
.payment-method-action-btn--secondary:focus,
.payment-method-action-btn--secondary:focus-visible,
.payment-method-action-btn--secondary:active {
	background-color: #065f46 !important;
}

.payment-denominations {
	display: flex;
	flex-wrap: wrap;
	gap: var(--pos-space-2);
}

.payment-denominations__btn {
	border-radius: var(--pos-radius-sm);
	text-transform: none;
	font-weight: 600;
}

@media (max-width: 768px) {
	.payment-method-card {
		padding: var(--pos-space-2);
		gap: var(--pos-space-2);
	}

	.payment-method-actions {
		grid-template-columns: 1fr;
	}
}
</style>
