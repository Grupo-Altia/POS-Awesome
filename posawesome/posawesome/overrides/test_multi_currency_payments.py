import sys
from types import ModuleType
from unittest import TestCase
from unittest.mock import MagicMock, patch

from posawesome.posawesome.overrides.multi_currency_payments import (
    MultiCurrencyPOSPaymentsMixin,
)


class TestMultiCurrencyPOSPaymentsMixin(TestCase):
    def test_missing_post_change_setting_uses_legacy_behavior(self):
        invoice = MagicMock()
        invoice.is_pos = 1
        invoice.payments = []

        accounts_settings_meta = MagicMock()
        accounts_settings_meta.has_field.return_value = None

        fake_frappe = ModuleType("frappe")
        fake_frappe.get_meta = MagicMock(return_value=accounts_settings_meta)
        fake_frappe.db = MagicMock()
        fake_utils = ModuleType("frappe.utils")
        fake_utils.cint = lambda value: int(value or 0)
        fake_utils.flt = lambda value, *args: float(value or 0)
        fake_erpnext = ModuleType("erpnext")
        fake_accounts = ModuleType("erpnext.accounts")
        fake_accounts_utils = ModuleType("erpnext.accounts.utils")
        fake_accounts_utils.get_account_currency = MagicMock()

        with patch.dict(
            sys.modules,
            {
                "frappe": fake_frappe,
                "frappe.utils": fake_utils,
                "erpnext": fake_erpnext,
                "erpnext.accounts": fake_accounts,
                "erpnext.accounts.utils": fake_accounts_utils,
            },
        ):
            MultiCurrencyPOSPaymentsMixin.make_pos_gl_entries(invoice, [])

        fake_frappe.db.get_single_value.assert_not_called()
        invoice.make_gle_for_change_amount.assert_not_called()
