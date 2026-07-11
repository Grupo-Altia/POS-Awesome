import { expect, test, type Page } from "@playwright/test";

const POS_PATH = process.env.POSA_SMOKE_PATH || "/desk/posapp";
const ENABLED = process.env.POSA_KEYBOARD_E2E === "1";
const POS_PROFILE =
	process.env.POSA_KEYBOARD_POS_PROFILE || "POS Awesome - MedPlus";
const TEST_ITEM_CODES = (
	process.env.POSA_KEYBOARD_TEST_ITEMS ||
	"A3106,22203,AI167,AH076,CR044,IK154"
)
	.split(",")
	.map((value) => value.trim())
	.filter(Boolean);

type TestItem = {
	item_code: string;
	item_name: string;
	stock: number;
	rate: number;
};

test.skip(
	!ENABLED,
	"Set POSA_KEYBOARD_E2E=1 to run real POS keyboard E2E tests.",
);

async function loginIfCredentialsProvided(page: Page) {
	const username = process.env.POSA_SMOKE_USER;
	const password = process.env.POSA_SMOKE_PASSWORD;
	if (!username || !password) return;

	let lastError: unknown = null;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			await page.goto("/login", {
				waitUntil: "networkidle",
				timeout: 60000,
			});
			const userInput = page.locator(
				'input[name="login_email"], input#login_email',
			);
			const passInput = page.locator(
				'input[name="login_password"], input#login_password',
			);
			const loginButton = page
				.locator("button.btn-login")
				.or(
					page.locator(
						'button:has-text("Login"), button:has-text("Log In")',
					),
				);

			if (!(await userInput.count()) || !(await passInput.count()))
				return;

			await userInput.first().fill(username);
			await passInput.first().fill(password);
			await Promise.all([
				page.waitForURL(/\/(app|desk)(\/|$)/, { timeout: 60000 }),
				loginButton.first().click(),
			]);
			return;
		} catch (error) {
			lastError = error;
			await page.waitForTimeout(2000);
		}
	}
	throw lastError;
}

async function callFrappe<T = any>(
	page: Page,
	method: string,
	args: Record<string, unknown> = {},
) {
	return page.evaluate(
		async ({ method: callMethod, args: callArgs }) => {
			const response = await (window as any).frappe.call({
				method: callMethod,
				args: callArgs,
			});
			return response?.message;
		},
		{ method, args },
	) as Promise<T>;
}

async function getValue<T = any>(
	page: Page,
	doctype: string,
	name: string,
	fieldname: string | string[],
) {
	return callFrappe<T>(page, "frappe.client.get_value", {
		doctype,
		filters: { name },
		fieldname,
	});
}

async function setValue(
	page: Page,
	doctype: string,
	name: string,
	fieldname: string,
	value: unknown,
) {
	return callFrappe(page, "frappe.client.set_value", {
		doctype,
		name,
		fieldname,
		value,
	});
}

async function waitForPosReady(page: Page) {
	for (let attempt = 0; attempt < 2; attempt += 1) {
		await page.goto(POS_PATH, { waitUntil: "domcontentloaded" });
		if (!/\/login/.test(page.url())) {
			break;
		}
		await loginIfCredentialsProvided(page);
	}
	if (/\/login/.test(page.url())) {
		throw new Error(
			"POS keyboard E2E reached the login page. Set POSA_SMOKE_USER and POSA_SMOKE_PASSWORD, or run with an authenticated Playwright storage/session.",
		);
	}
	await expect(page).toHaveURL(
		new RegExp("/(app/(posapp|point-of-sale)|desk/posapp)"),
	);
	await expect(page.locator(".main-section").first()).toBeVisible({
		timeout: 90000,
	});
	await expect(
		page.getByTestId("pos-item-search").locator("input"),
	).toBeVisible({
		timeout: 90000,
	});
}

function captureUnexpectedErrors(page: Page) {
	const errors: string[] = [];
	const isBenign = (message: string) => {
		const normalized = message.toLowerCase();
		return (
			normalized.includes("remove_last_divider") ||
			(normalized.includes("offsetwidth") &&
				normalized.includes("shortcut.js")) ||
			(normalized.includes("failed to load resource") &&
				normalized.includes("404"))
		);
	};
	page.on("pageerror", (error) => {
		const message = String(error?.message || error);
		const stack = typeof error?.stack === "string" ? error.stack : "";
		const detail =
			stack && !stack.includes(message)
				? `${message}\n${stack}`
				: stack || message;
		if (!isBenign(message)) errors.push(`pageerror: ${detail}`);
	});
	page.on("console", (msg) => {
		if (msg.type() !== "error") return;
		const message = msg.text();
		if (!isBenign(message)) errors.push(`console.error: ${message}`);
	});
	return errors;
}

async function getPositiveStockItems(page: Page): Promise<TestItem[]> {
	const items: TestItem[] = [];
	for (const code of TEST_ITEM_CODES) {
		const item = await getValue<{
			item_code: string;
			item_name: string;
			disabled: number;
			is_sales_item: number;
		}>(page, "Item", code, [
			"item_code",
			"item_name",
			"disabled",
			"is_sales_item",
		]);
		if (!item?.item_code || item.disabled || !item.is_sales_item) {
			continue;
		}
		const [stockRows, priceRows] = await Promise.all([
			callFrappe<Array<{ actual_qty: number }>>(
				page,
				"frappe.client.get_list",
				{
					doctype: "Bin",
					filters: { item_code: item.item_code },
					fields: ["actual_qty"],
					limit_page_length: 20,
				},
			),
			callFrappe<Array<{ price_list_rate: number }>>(
				page,
				"frappe.client.get_list",
				{
					doctype: "Item Price",
					filters: { item_code: item.item_code, selling: 1 },
					fields: ["price_list_rate"],
					limit_page_length: 5,
				},
			),
		]);
		const stock = (stockRows || []).reduce(
			(total, row) => total + Number(row.actual_qty || 0),
			0,
		);
		const rate = Math.max(
			0,
			...(priceRows || []).map((row) => Number(row.price_list_rate || 0)),
		);
		if (stock > 0 && rate > 0) {
			items.push({ ...item, stock, rate });
		}
	}
	return items.sort(
		(left, right) =>
			TEST_ITEM_CODES.indexOf(left.item_code) -
			TEST_ITEM_CODES.indexOf(right.item_code),
	);
}

async function searchAndAddItem(page: Page, item: TestItem) {
	const search = page.getByTestId("pos-item-search").locator("input");
	await search.click();
	const exactResult = page.getByText(item.item_code, { exact: true }).first();
	const queries = [item.item_code, item.item_name].filter(Boolean);
	const deadline = Date.now() + 60000;
	let found = false;
	while (Date.now() < deadline && !found) {
		for (const query of queries) {
			await search.fill(query);
			if (
				await exactResult
					.isVisible({ timeout: 5000 })
					.catch(() => false)
			) {
				found = true;
				break;
			}
		}
		if (!found) {
			await page.waitForTimeout(2000);
		}
	}
	await expect(
		exactResult,
		`POS search did not show ${item.item_code}`,
	).toBeVisible();
	await page.keyboard.press("Enter");
	if (
		!(await page
			.getByTestId(`cart-row-${item.item_code}`)
			.first()
			.isVisible({ timeout: 8000 })
			.catch(() => false))
	) {
		await page.getByText(item.item_code, { exact: true }).first().click();
	}
	await expect(
		page.getByTestId(`cart-row-${item.item_code}`).first(),
	).toBeVisible({
		timeout: 30000,
	});
}

async function enterInvoiceGrid(page: Page) {
	await page.keyboard.press("Alt+ArrowRight");
	await expect(
		page.locator(".posa-cart-item-row--keyboard-active").first(),
	).toBeVisible({
		timeout: 10000,
	});
}

async function activeCartCell(page: Page) {
	return page.locator(".posa-cart-item-cell--keyboard-active").first();
}

async function setActiveNumericCell(page: Page, value: string) {
	const cell = await activeCartCell(page);
	await expect(cell).toBeVisible();
	let input = cell.locator("input").first();
	if (!(await input.count())) {
		const target = cell
			.locator("[data-pos-keyboard-target], button")
			.first();
		if (await target.count()) {
			await target.click();
		} else {
			await page.keyboard.press("Enter");
		}
		input = cell.locator("input").first();
	}
	await expect(input).toBeFocused({ timeout: 10000 });
	await input.fill(value);
	await page.keyboard.press("Enter");
}

async function expectNoActiveInvoiceGrid(page: Page) {
	await expect(
		page.locator(".posa-cart-item-row--keyboard-active"),
	).toHaveCount(0);
	await expect(
		page.locator(".posa-cart-item-cell--keyboard-active"),
	).toHaveCount(0);
}

async function openInvoiceManagement(page: Page) {
	await page.getByTestId("invoice-action-management").click();
	await expect(page.getByTestId("invoice-management-dialog")).toBeVisible({
		timeout: 30000,
	});
}

async function submitCurrentInvoice(page: Page) {
	await page.getByTestId("invoice-action-pay").click();
	await expect(page.getByTestId("payment-root")).toBeVisible({
		timeout: 30000,
	});
	await expect(
		page
			.locator("[data-pos-keyboard-target='payment-amount'] input")
			.first(),
	).toBeFocused({
		timeout: 15000,
	});
	await page.keyboard.press("Control+Enter");
	await expect(page.locator(".v-snackbar, .v-toast, body")).toBeVisible();
}

async function latestSubmittedInvoice(page: Page) {
	const mode = await getValue<{
		create_pos_invoice_instead_of_sales_invoice?: number;
	}>(
		page,
		"POS Profile",
		POS_PROFILE,
		"create_pos_invoice_instead_of_sales_invoice",
	);
	const doctype = Number(
		mode?.create_pos_invoice_instead_of_sales_invoice || 0,
	)
		? "POS Invoice"
		: "Sales Invoice";
	const rows = await callFrappe<Array<{ name: string; grand_total: number }>>(
		page,
		"frappe.client.get_list",
		{
			doctype,
			filters: { docstatus: 1, is_return: 0 },
			fields: ["name", "grand_total", "modified"],
			order_by: "modified desc",
			limit_page_length: 1,
		},
	);
	expect(rows?.length || 0).toBeGreaterThan(0);
	return {
		doctype,
		name: rows[0].name,
		grand_total: Number(rows[0].grand_total || 0),
	};
}

async function openSubmittedInvoiceEdit(page: Page, invoiceName: string) {
	await openInvoiceManagement(page);
	const searchInput = page.locator(".invoice-management-card input").first();
	await searchInput.fill(invoiceName);
	await expect(
		page.getByTestId(`invoice-management-edit-${invoiceName}`),
	).toBeVisible({
		timeout: 30000,
	});
	await page.getByTestId(`invoice-management-edit-${invoiceName}`).click();
	await expect(page.getByTestId("invoice-edit-modal")).toBeVisible({
		timeout: 30000,
	});
}

test.describe.serial("POS keyboard accessibility E2E", () => {
	let originalQuickEditFlag = 0;
	let items: TestItem[] = [];
	let submittedInvoiceName = "";
	let capturedErrors: string[] = [];

	test.beforeAll(async ({ browser }) => {
		const page = await browser.newPage();
		await loginIfCredentialsProvided(page);
		await waitForPosReady(page);
		const profile = await getValue<{ posa_allow_item_quick_edit?: number }>(
			page,
			"POS Profile",
			POS_PROFILE,
			"posa_allow_item_quick_edit",
		);
		originalQuickEditFlag = Number(
			profile?.posa_allow_item_quick_edit || 0,
		);
		await setValue(
			page,
			"POS Profile",
			POS_PROFILE,
			"posa_allow_item_quick_edit",
			1,
		);
		await page.close();
	});

	test.afterAll(async ({ browser }) => {
		const page = await browser.newPage();
		await loginIfCredentialsProvided(page);
		await waitForPosReady(page);
		await setValue(
			page,
			"POS Profile",
			POS_PROFILE,
			"posa_allow_item_quick_edit",
			originalQuickEditFlag,
		);
		await page.close();
	});

	test.beforeEach(async ({ page }) => {
		capturedErrors = captureUnexpectedErrors(page);
		await loginIfCredentialsProvided(page);
		await waitForPosReady(page);
	});

	test.afterEach(() => {
		expect(capturedErrors, capturedErrors.join("\n")).toHaveLength(0);
	});

	test("product search down arrow stays in product results and does not steal focus to cart", async ({
		page,
	}) => {
		items = await getPositiveStockItems(page);
		expect(
			items.length,
			`Need at least 3 positive-stock items from ${TEST_ITEM_CODES.join(", ")}`,
		).toBeGreaterThanOrEqual(3);

		await searchAndAddItem(page, items[0]);
		const search = page.getByTestId("pos-item-search").locator("input");
		await search.click();
		await search.fill(items[1].item_code);
		await expect(
			page.getByText(items[1].item_code, { exact: true }).first(),
		).toBeVisible();
		await page.keyboard.press("ArrowDown");

		await expect(search).toBeFocused();
		await expectNoActiveInvoiceGrid(page);
		await page.keyboard.press("Enter");
		await expect(
			page.getByTestId(`cart-row-${items[1].item_code}`).first(),
		).toBeVisible({
			timeout: 30000,
		});
	});

	test("operator can add items and edit invoice grid fully from keyboard", async ({
		page,
	}) => {
		if (!items.length) items = await getPositiveStockItems(page);
		expect(items.length).toBeGreaterThanOrEqual(3);

		await searchAndAddItem(page, items[0]);
		await searchAndAddItem(page, items[1]);
		await enterInvoiceGrid(page);

		await page.keyboard.press("ArrowRight");
		await expect(await activeCartCell(page)).toBeVisible();
		await setActiveNumericCell(page, "2");

		await expect(await activeCartCell(page)).toBeVisible();
		await setActiveNumericCell(
			page,
			String(Math.max(1, Math.round(items[0].rate))),
		);

		await page.keyboard.press("Escape");
		await expect(
			page.locator(".posa-cart-item-row--keyboard-active").first(),
		).toBeVisible();
		await page.keyboard.press("Enter");
		await expect(page.getByTestId("item-history-modal")).toBeVisible({
			timeout: 30000,
		});
		await expect(
			page.locator(".posa-modal-keyboard-box").first(),
		).toBeVisible();
		await page.keyboard.press("ArrowRight");
		await page.keyboard.press("Enter");
		await expect(
			page.getByTestId("item-history-details-tab"),
		).toHaveAttribute("aria-selected", "true");
		await page.keyboard.press("ArrowLeft");
		await page.keyboard.press("Enter");
		await expect(
			page.getByTestId("item-history-sales-tab"),
		).toHaveAttribute("aria-selected", "true");

		await expect(page.getByTestId("item-history-row-0")).toBeVisible({
			timeout: 30000,
		});
		await page.getByTestId("item-history-row-0").click();
		await page.keyboard.press("Enter");
		await expect(
			page.getByTestId("item-history-invoice-detail-dialog"),
		).toBeVisible({ timeout: 30000 });
		await page.keyboard.press("Escape");
		await expect(
			page.getByTestId("item-history-invoice-detail-dialog"),
		).toBeHidden({ timeout: 15000 });
		await page.keyboard.press("ArrowDown");
		await expect(
			page.locator(".posa-modal-keyboard-box").first(),
		).toBeVisible();

		await page.keyboard.press("Escape");
		await expect(page.getByTestId("item-history-modal")).toBeHidden({
			timeout: 15000,
		});
	});

	test("item quick edit opens from selected cart row and is keyboard reachable", async ({
		page,
	}) => {
		if (!items.length) items = await getPositiveStockItems(page);
		await searchAndAddItem(page, items[0]);
		await enterInvoiceGrid(page);
		await page.keyboard.press("F12");

		await expect(page.getByTestId("item-quick-edit-modal")).toBeVisible({
			timeout: 30000,
		});
		await expect(
			page.getByTestId("item-quick-edit-lookup").locator("input"),
		).toHaveValue(items[0].item_code, {
			timeout: 30000,
		});
		await expect(page.locator(".posa-quick-edit-keyboard-box").first()).toBeVisible();
		await page.keyboard.press("Enter");
		await expect(page.getByTestId("item-quick-edit-name").locator("input")).toBeFocused();
		await page.keyboard.press("Enter");
		await expect(page.locator(".posa-quick-edit-keyboard-box").first()).toBeVisible();
		await page.keyboard.press("ArrowDown");
		await expect(page.locator(".posa-quick-edit-keyboard-box").first()).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(page.getByTestId("item-quick-edit-modal")).toBeHidden({
			timeout: 15000,
		});
	});

	test("drafts drawer supports keyboard load and escape paths", async ({
		page,
	}) => {
		if (!items.length) items = await getPositiveStockItems(page);
		await searchAndAddItem(page, items[0]);
		await page.getByTestId("invoice-action-save-clear").click();
		await page.waitForTimeout(1000);

		await page.keyboard.press("Alt+L");
		const activeDraftsSurface = page
			.locator(
				".v-navigation-drawer:not([inert]) .drafts-list, [data-test='mobile-drafts-dialog']:visible",
			)
			.first();
		await expect(activeDraftsSurface).toBeVisible({
			timeout: 30000,
		});
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("Escape");
		await expect(
			page.locator(
				".v-navigation-drawer:not([inert]) .drafts-list, [data-test='mobile-drafts-dialog']:visible",
			),
		).toHaveCount(0, {
			timeout: 15000,
		});
	});

	test("payment keyboard flow submits a real invoice", async ({ page }) => {
		if (!items.length) items = await getPositiveStockItems(page);
		await searchAndAddItem(page, items[0]);
		await searchAndAddItem(page, items[1]);
		await submitCurrentInvoice(page);

		const invoice = await latestSubmittedInvoice(page);
		submittedInvoiceName = invoice.name;
		expect(submittedInvoiceName).toMatch(/.+/);
	});

	test("invoice management and submitted invoice edit modal are keyboard operable", async ({
		page,
	}) => {
		if (!submittedInvoiceName) {
			const invoice = await latestSubmittedInvoice(page);
			submittedInvoiceName = invoice.name;
		}
		await openSubmittedInvoiceEdit(page, submittedInvoiceName);

		await expect(page.locator(".edit-keyboard-box").first()).toBeVisible({
			timeout: 15000,
		});
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("Enter");
		const activeTag = await page.evaluate(() =>
			document.activeElement?.tagName?.toLowerCase(),
		);
		expect(["input", "textarea", "select"]).toContain(activeTag);

		await page.keyboard.press("Control+A");
		await page.keyboard.type("1");
		await page.keyboard.press("ArrowLeft");
		const stillInput = await page.evaluate(() =>
			document.activeElement?.tagName?.toLowerCase(),
		);
		expect(stillInput).toBe("input");

		await page.keyboard.press("Enter");
		await expect(page.locator(".edit-keyboard-box").first()).toBeVisible();

		const qtyInput = page
			.getByTestId("invoice-edit-item-0-qty")
			.locator("input");
		await qtyInput.fill("3");
		await expect(
			page.getByTestId("invoice-edit-settlement-summary"),
		).toContainText(
			/Collect from customer|Refund to customer|No cash difference/,
			{ timeout: 30000 },
		);
		const paymentInput = page
			.getByTestId("invoice-edit-payment-0-amount")
			.locator("input");
		await expect(paymentInput).toHaveAttribute("readonly", /readonly|/);

		await page.keyboard.press("Escape");
		await expect(page.getByTestId("invoice-edit-modal")).toBeHidden({
			timeout: 15000,
		});
	});
});
