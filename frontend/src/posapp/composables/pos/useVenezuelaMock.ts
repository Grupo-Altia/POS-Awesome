import { ref, computed } from "vue";

// Persistent state across component instances and page reloads
const storedRate = localStorage.getItem("posa_ve_bcv_rate");
const exchangeRate = ref<number>(storedRate ? parseFloat(storedRate) : 50.0);
const igtfRate = ref<number>(3.0);
const isMockActive = ref<boolean>(true);
const selectedPaymentType = ref<"bs" | "usd">("usd");

export function useVenezuelaMock() {
	function setExchangeRate(newRate: number) {
		if (newRate > 0) {
			exchangeRate.value = Math.round(newRate * 100) / 100;
			localStorage.setItem("posa_ve_bcv_rate", exchangeRate.value.toString());
		}
	}

	function setPaymentType(type: "bs" | "usd") {
		selectedPaymentType.value = type;
	}

	function toUSD(amountBs: number): number {
		if (!exchangeRate.value || exchangeRate.value <= 0) return 0;
		return Math.round((amountBs / exchangeRate.value) * 100) / 100;
	}

	function toBs(amountUSD: number): number {
		return Math.round(amountUSD * exchangeRate.value * 100) / 100;
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

	const formattedRate = computed(() => {
		return formatCurrencyCustom(exchangeRate.value, "Bs.");
	});

	return {
		exchangeRate,
		igtfRate,
		isMockActive,
		selectedPaymentType,
		setExchangeRate,
		setPaymentType,
		toUSD,
		toBs,
		computeIgtf,
		formatCurrencyCustom,
		formattedRate,
	};
}
