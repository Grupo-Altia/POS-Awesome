import frappe
from frappe import _
from frappe.utils import flt


LOCKED_FIELD = "retailmind_locked_for_sale"
NON_DISCOUNTABLE_FIELD = "retailmind_non_discountable"
CONTROLLED_FIELD = "retailmind_controlled_item"
SHORT_NAME_FIELD = "retailmind_short_name"
LOSS_EPSILON = 0.0001


def item_control_fields():
    return [
        LOCKED_FIELD,
        NON_DISCOUNTABLE_FIELD,
        CONTROLLED_FIELD,
        SHORT_NAME_FIELD,
    ]


def item_has_field(fieldname):
    try:
        return bool(frappe.get_meta("Item").has_field(fieldname))
    except Exception:
        return False


def installed_item_control_fields():
    return [field for field in item_control_fields() if item_has_field(field)]


def get_item_control_flags(item_codes):
    codes = sorted({str(code).strip() for code in item_codes or [] if code})
    if not codes:
        return {}

    fields = ["item_code", "item_name", *installed_item_control_fields()]
    rows = frappe.get_all(
        "Item",
        filters={"item_code": ["in", codes]},
        fields=fields,
        limit_page_length=len(codes),
    )
    return {row.get("item_code"): row for row in rows if row.get("item_code")}


def collect_item_sale_control_errors(items, is_return=False):
    if is_return:
        return []

    item_rows = list(items or [])
    flags_by_code = get_item_control_flags(
        [row.get("item_code") if hasattr(row, "get") else None for row in item_rows]
    )
    errors = []

    for row in item_rows:
        item_code = row.get("item_code") if hasattr(row, "get") else None
        if not item_code:
            continue

        flags = flags_by_code.get(item_code) or {}
        item_name = row.get("item_name") or flags.get("item_name") or item_code

        if flags.get(LOCKED_FIELD):
            errors.append(
                {
                    "item_code": item_code,
                    "item_name": item_name,
                    "policy": "block",
                    "reason": "locked_for_sale",
                    "message": _("Item {0} is locked for sale.").format(item_name),
                }
            )
            continue

        if flags.get(NON_DISCOUNTABLE_FIELD) and (
            abs(flt(row.get("discount_percentage"))) > 0.0001
            or abs(flt(row.get("discount_amount"))) > 0.0001
        ):
            errors.append(
                {
                    "item_code": item_code,
                    "item_name": item_name,
                    "policy": "block",
                    "reason": "non_discountable",
                    "message": _("Item {0} does not allow POS discounts.").format(item_name),
                }
            )

    return errors


def _resolve_buying_price_list(pos_profile=None):
    if pos_profile and frappe.get_meta("POS Profile").has_field("buying_price_list"):
        profile_buying = frappe.db.get_value("POS Profile", pos_profile, "buying_price_list")
        if profile_buying:
            return profile_buying
    return (
        frappe.db.get_single_value("Buying Settings", "buying_price_list")
        or frappe.db.get_value("Price List", {"buying": 1}, "name")
        or ("Standard Buying" if frappe.db.exists("Price List", "Standard Buying") else None)
    )


def _get_buying_prices(item_codes, pos_profile=None):
    codes = sorted({str(code).strip() for code in item_codes or [] if code})
    if not codes:
        return {}

    price_list = _resolve_buying_price_list(pos_profile)
    if not price_list:
        return {}

    rows = frappe.get_all(
        "Item Price",
        filters={
            "price_list": price_list,
            "item_code": ["in", codes],
            "buying": 1,
        },
        fields=["item_code", "price_list_rate", "uom", "modified"],
        order_by="modified desc",
        limit_page_length=len(codes) * 5,
    )
    prices = {}
    for row in rows:
        if row.get("item_code") not in prices and flt(row.get("price_list_rate")) > 0:
            prices[row.get("item_code")] = flt(row.get("price_list_rate"))
    return prices


def collect_below_buying_price_errors(items, is_return=False, pos_profile=None):
    if is_return:
        return []

    item_rows = list(items or [])
    buying_prices = _get_buying_prices(
        [row.get("item_code") if hasattr(row, "get") else None for row in item_rows],
        pos_profile=pos_profile,
    )
    errors = []

    for row in item_rows:
        item_code = row.get("item_code") if hasattr(row, "get") else None
        if not item_code:
            continue
        if row.get("posa_is_replace") or flt(row.get("qty")) < 0:
            continue

        floor = flt(row.get("trade_price") or row.get("buying_price") or row.get("buying_rate"))
        if floor <= 0:
            floor = buying_prices.get(item_code) or 0
        if floor <= 0:
            continue

        selling_rate = abs(flt(row.get("rate")))
        if selling_rate + LOSS_EPSILON >= floor:
            continue

        item_name = row.get("item_name") or item_code
        errors.append(
            {
                "item_code": item_code,
                "item_name": item_name,
                "policy": "block",
                "reason": "below_buying_price",
                "selling_rate": selling_rate,
                "buying_rate": floor,
                "message": _(
                    "Item {0} cannot be sold at {1}; it is below buying/trade price {2}."
                ).format(item_name, selling_rate, floor),
            }
        )

    return errors


def validate_invoice_item_sale_controls(invoice_doc):
    errors = collect_item_sale_control_errors(
        invoice_doc.get("items") or [],
        is_return=bool(invoice_doc.get("is_return")),
    )
    errors.extend(
        collect_below_buying_price_errors(
            invoice_doc.get("items") or [],
            is_return=bool(invoice_doc.get("is_return")),
            pos_profile=invoice_doc.get("pos_profile"),
        )
    )
    if errors:
        frappe.throw(errors[0].get("message"))
