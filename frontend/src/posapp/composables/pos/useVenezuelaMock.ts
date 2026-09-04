import { ref, computed } from "vue";

// Persistent state across component instances and page reloads
const storedRateUSD = localStorage.getItem("posa_ve_bcv_rate_usd") || localStorage.getItem("posa_ve_bcv_rate");
const storedRateEUR = localStorage.getItem("posa_ve_bcv_rate_eur");

const exchangeRateUSD = ref<number>(storedRateUSD ? parseFloat(storedRateUSD) : 801.0);
const exchangeRateEUR = ref<number>(storedRateEUR ? parseFloat(storedRateEUR) : 850.0);
const igtfRate = ref<number>(3.0);
const isMockActive = ref<boolean>(true);
const selectedPaymentType = ref<"bs" | "usd" | "eur" | "mixed">("bs");
const changeCurrencyChoice = ref<"VEF" | "USD">("VEF");

export function useVenezuelaMock() {
	function setExchangeRates(rates: { usd?: number; eur?: number }) {
		if (rates.usd && rates.usd > 0) {
			exchangeRateUSD.value = Math.round(rates.usd * 100) / 100;
			localStorage.setItem("posa_ve_bcv_rate_usd", exchangeRateUSD.value.toString());
			localStorage.setItem("posa_ve_bcv_rate", exchangeRateUSD.value.toString()); // legacy compat
		}
		if (rates.eur && rates.eur > 0) {
			exchangeRateEUR.value = Math.round(rates.eur * 100) / 100;
			localStorage.setItem("posa_ve_bcv_rate_eur", exchangeRateEUR.value.toString());
		}
	}

	function setPaymentType(type: "bs" | "usd" | "eur" | "mixed") {
		selectedPaymentType.value = type;
	}

	function toUSD(amountBs: number): number {
		if (!exchangeRateUSD.value || exchangeRateUSD.value <= 0) return 0;
		return Math.round((amountBs / exchangeRateUSD.value) * 100) / 100;
	}

	function toEUR(amountBs: number): number {
		if (!exchangeRateEUR.value || exchangeRateEUR.value <= 0) return 0;
		return Math.round((amountBs / exchangeRateEUR.value) * 100) / 100;
	}

	function toBs(amount: number, currency: "USD" | "EUR" = "USD"): number {
		const rate = currency === "EUR" ? exchangeRateEUR.value : exchangeRateUSD.value;
		return Math.round(amount * rate * 100) / 100;
	}

	function computeIgtf(amount: number, isDivisa: boolean = true): number {
		if (!isDivisa) return 0;
		return Math.round(amount * (igtfRate.value / 100) * 100) / 100;
	}

	function formatCurrencyCustom(val: number, symbol: string = "Bs."): string {
		const formatted = new Intl.NumberFormat("es-VE", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(val || 0);
		return `${symbol} ${formatted}`;
	}

	/**
	 * Exact calculation specified in DominaPOS Arquitectura de Cobro Multi-Moneda §5.2 y §6
	 */
	function calculatePosTotals(totalInvoiceBs: number, paidPayments: any[] = []) {
		const T = totalInvoiceBs || 0;
		let totalPaidBs = 0;
		let totalAppliedBs = 0;
		let totalIgtfBs = 0;

		paidPayments.forEach((p) => {
			const amount = Number(p.amount || 0);
			if (amount <= 0) return;

			const cur = (p.currency || p.posa_payment_currency || "VEF").toUpperCase();
			const isDivisa = cur !== "VEF" && cur !== "VES";
			const rate = cur === "EUR" ? exchangeRateEUR.value : (cur === "USD" ? exchangeRateUSD.value : 1);
			const baseAmount = Math.round(amount * rate * 100) / 100;

			totalPaidBs += baseAmount;

			if (isDivisa) {
				// applied = baseAmount / 1.03 (sin impuesto sobre impuesto)
				const applied = Math.round((baseAmount / (1 + igtfRate.value / 100)) * 100) / 100;
				const igtf = Math.round((applied * (igtfRate.value / 100)) * 100) / 100;
				totalAppliedBs += applied;
				totalIgtfBs += igtf;
			} else {
				totalAppliedBs += baseAmount;
			}
		});

		// If no payments yet, calculate full totals by currency as if 100% was paid in that currency
		const totals_by_currency = {
			VEF: T,
			USD: exchangeRateUSD.value > 0 ? Math.round(((T * 1.03) / exchangeRateUSD.value) * 100) / 100 : 0,
			EUR: exchangeRateEUR.value > 0 ? Math.round(((T * 1.03) / exchangeRateEUR.value) * 100) / 100 : 0,
		};

		const pendingInvoiceBs = Math.max(Math.round((T - totalAppliedBs) * 100) / 100, 0);

		// How much remains to close the bill in each currency (including 3% if closed in foreign currency)
		const pending_by_currency = {
			VEF: pendingInvoiceBs,
			USD: exchangeRateUSD.value > 0 ? Math.round(((pendingInvoiceBs * 1.03) / exchangeRateUSD.value) * 100) / 100 : 0,
			EUR: exchangeRateEUR.value > 0 ? Math.round(((pendingInvoiceBs * 1.03) / exchangeRateEUR.value) * 100) / 100 : 0,
		};

		const totalToPayBs = Math.round((T + totalIgtfBs) * 100) / 100;
		const changeBs = totalPaidBs > totalToPayBs ? Math.round((totalPaidBs - totalToPayBs) * 100) / 100 : 0;
		const changeUSD = toUSD(changeBs);

		return {
			subtotal: Math.round((T / 1.16) * 100) / 100,
			tax_total: Math.round((T - T / 1.16) * 100) / 100,
			total: T,
			igtf_amount: totalIgtfBs,
			total_to_pay: totalToPayBs,
			totals_by_currency,
			paid: totalPaidBs,
			applied: totalAppliedBs,
			pending: pendingInvoiceBs,
			pending_by_currency,
			change: changeBs,
			change_usd: changeUSD,
			exchange_rates: {
				USD: exchangeRateUSD.value,
				EUR: exchangeRateEUR.value,
			},
		};
	}

	return {
		exchangeRate: exchangeRateUSD, // backward compatibility
		exchangeRateUSD,
		exchangeRateEUR,
		igtfRate,
		isMockActive,
		selectedPaymentType,
		changeCurrencyChoice,
		setExchangeRates,
		setPaymentType,
		toUSD,
		toEUR,
		toBs,
		computeIgtf,
		formatCurrencyCustom,
		calculatePosTotals,
	};
}
