import type { CustomerSummary } from "../../types/models";

type SearchableCustomer = CustomerSummary & {
	_search_text?: string;
};

export function normalizeCustomerSearchTerm(
	term: string | null | undefined,
): string {
	if (typeof term !== "string") {
		return "";
	}
	return term.trim();
}

export function buildCustomerSearchParts(
	term: string | null | undefined,
): string[] {
	return normalizeCustomerSearchTerm(term)
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean);
}

export function buildCustomerSearchText(
	customer: CustomerSummary | null | undefined,
): string {
	if (!customer) {
		return "";
	}

	return [
		customer.customer_name,
		customer.name,
		customer.mobile_no,
		customer.email_id,
		(customer as CustomerSummary & { tax_id?: unknown }).tax_id,
	]
		.filter((value) => value !== null && value !== undefined)
		.map((value) => String(value).toLowerCase())
		.join("\n");
}

export function customerMatchesSearchParts(
	customer: CustomerSummary | null | undefined,
	searchParts: readonly string[],
): boolean {
	if (!searchParts.length) {
		return true;
	}

	if (!customer) {
		return false;
	}

	const searchableCustomer = customer as SearchableCustomer;
	const searchText =
		searchableCustomer._search_text || buildCustomerSearchText(customer);

	return searchParts.every((part) => searchText.includes(part));
}

export function customerMatchesSearchTerm(
	customer: CustomerSummary | null | undefined,
	term: string | null | undefined,
): boolean {
	return customerMatchesSearchParts(customer, buildCustomerSearchParts(term));
}

export type CustomerDuplicateField =
	| "customer_name"
	| "mobile_no"
	| "email_id"
	| "tax_id";

export function normalizeCustomerDuplicateValue(
	field: CustomerDuplicateField,
	value: unknown,
): string {
	const normalized = String(value ?? "")
		.trim()
		.toLowerCase();
	if (field === "mobile_no") {
		return normalized.replace(/\D/g, "");
	}
	if (field === "customer_name") {
		return normalized.replace(/\s+/g, " ");
	}
	if (field === "tax_id") {
		return normalized.replace(/\s+/g, "");
	}
	return normalized;
}

export function getCustomerDuplicateFields(
	customer: CustomerSummary,
	candidate: Partial<CustomerSummary>,
	includeCustomerName = true,
): CustomerDuplicateField[] {
	const fields: CustomerDuplicateField[] = [
		...(includeCustomerName ? (["customer_name"] as const) : []),
		"mobile_no",
		"email_id",
		"tax_id",
	];
	return fields.filter((field) => {
		const candidateValue = normalizeCustomerDuplicateValue(
			field,
			candidate[field],
		);
		return (
			Boolean(candidateValue) &&
			candidateValue ===
				normalizeCustomerDuplicateValue(field, customer[field])
		);
	});
}
