import { describe, expect, it } from "vitest";

import {
	POS_APP_ID,
	POS_BRAND_NAME,
	POS_BRAND_SHORT_NAME,
	getPosAppDisplayName,
} from "../src/posapp/config/branding";

describe("RetailMind-POS branding", () => {
	it("keeps the stable app identifier separate from the display brand", () => {
		expect(POS_APP_ID).toBe("posawesome");
		expect(POS_BRAND_NAME).toBe("RetailMind-POS");
		expect(POS_BRAND_SHORT_NAME).toBe("RM-POS");
	});

	it("rebrands only the POS app in installed-app displays", () => {
		expect(getPosAppDisplayName("posawesome")).toBe("RetailMind-POS");
		expect(getPosAppDisplayName("erpnext")).toBe("erpnext");
	});
});
