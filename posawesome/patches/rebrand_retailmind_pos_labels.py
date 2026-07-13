import frappe


CUSTOM_FIELD_UPDATES = {
    "POS Profile-posa_pos_awesome_settings": {"label": "RetailMind-POS Settings"},
    "POS Profile-pos_awesome_payments": {"label": "RetailMind-POS Payments"},
    "POS Profile-posa_use_pos_awesome_payments": {
        "label": "Use RetailMind-POS Payments"
    },
    "POS Profile-posa_pos_awesome_advance_settings": {
        "label": "RetailMind-POS Advanced Settings"
    },
    "POS Profile-posa_use_server_cache": {
        "description": "Use Redis cache on the server to speed up initial RetailMind-POS loads."
    },
    "POS Profile-posa_qz_printer_name": {
        "description": "QZ Tray printer name saved from RetailMind-POS setup."
    },
    "POS Profile-posa_language": {
        "description": "Language for the RetailMind-POS interface"
    },
    "POS Profile-posa_section_awesome_dashboard": {
        "label": "RetailMind Dashboard"
    },
    "POS Profile-posa_enable_awesome_dashboard": {
        "label": "Enable RetailMind Dashboard"
    },
    "POS Settings-posa_section_dashboard": {"label": "RetailMind Dashboard"},
    "POS Settings-posa_enable_awesome_dashboard_global": {
        "label": "Enable RetailMind Dashboard",
        "description": "Enable the RetailMind-POS dashboard globally.",
    },
}


def execute():
    changed_doctypes = set()
    for custom_field_name, updates in CUSTOM_FIELD_UPDATES.items():
        if not frappe.db.exists("Custom Field", custom_field_name):
            continue
        frappe.db.set_value(
            "Custom Field",
            custom_field_name,
            updates,
            update_modified=False,
        )
        changed_doctypes.add(custom_field_name.split("-", 1)[0])

    for doctype in changed_doctypes:
        frappe.clear_cache(doctype=doctype)
