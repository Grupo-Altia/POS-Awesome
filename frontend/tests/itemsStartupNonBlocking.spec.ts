import { nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/offline/index", () => ({
	startupInitPromise: new Promise<void>(() => {}),
}));

import { startItemsSelectorInitialization } from "../src/posapp/composables/pos/items/useItemsSelectorInitialization";

describe("item startup critical path", () => {
	it("starts catalog initialization without waiting for unrelated offline hydration", async () => {
		const initializeStore = vi.fn(async () => undefined);
		const isInitialized = ref(false);
		const initTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
		const stop = startItemsSelectorInitialization({
			uiPosProfile: ref({ name: "POS-1", currency: "PKR" }),
			selectedCustomer: ref("Walk In"),
			customerPriceList: ref("Retail"),
			selectedCurrency: ref(""),
			selectedExchangeRate: ref(0),
			selectedConversionRate: ref(0),
			isInitialized,
			initTimeout,
			initError: ref(null),
			itemsIntegration: { initializeStore },
			startItemWorker: vi.fn(),
			loadItemSettings: vi.fn(),
			startBackgroundSyncScheduler: vi.fn(),
			timeoutMs: 60_000,
		});

		await nextTick();
		await vi.waitFor(() => expect(isInitialized.value).toBe(true));

		expect(initializeStore).toHaveBeenCalledWith(
			expect.objectContaining({ name: "POS-1" }),
			"Walk In",
			"Retail",
		);
		stop();
		if (initTimeout.value) clearTimeout(initTimeout.value);
	});
});
