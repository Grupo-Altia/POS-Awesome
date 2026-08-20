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
        invoice.doctype = "Sales Invoice"
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

    def test_v16_before_save_preserves_tender_base_and_posts_exact_change(self):
        class Row(dict):
            __getattr__ = dict.get
            __setattr__ = dict.__setitem__

        class V16SalesInvoice:
            def before_save(self):
                for payment in self.payments:
                    payment.base_amount = round(
                        payment.amount * self.conversion_rate,
                        2,
                    )
                self.base_paid_amount = sum(
                    payment.base_amount for payment in self.payments
                )

        class Invoice(MultiCurrencyPOSPaymentsMixin, V16SalesInvoice):
            def get(self, fieldname, default=None):
                return getattr(self, fieldname, default)

            def precision(self, _fieldname):
                return 2

            def get_gl_dict(self, values, _currency, item=None):
                return values

            def make_gle_for_change_amount(self, _gl_entries):
                raise AssertionError("separate change GL must stay disabled")

        invoice = Invoice()
        invoice.is_pos = 1
        invoice.doctype = "Sales Invoice"
        invoice.is_return = 0
        invoice.return_against = None
        invoice.update_outstanding_for_self = 0
        invoice.name = "ACC-SINV-TEST-0001"
        invoice.customer = "CUST-0001"
        invoice.debit_to = "Debtors - FC"
        invoice.cost_center = "Main - FC"
        invoice.company_currency = "PKR"
        invoice.party_account_currency = "PKR"
        invoice.conversion_rate = 285
        invoice.rounded_total = 0.42
        invoice.grand_total = 0.42
        invoice.base_rounded_total = 119.7
        invoice.base_grand_total = 119.7
        invoice.account_for_change_amount = "Cash - FC"
        invoice.change_amount = 0.01
        invoice.base_change_amount = 2.85
        invoice.payments = [
            Row(
                mode_of_payment="Cash",
                type="Cash",
                account="Cash - FC",
                amount=0.11,
                base_amount=31.35,
                posa_payment_currency="PKR",
                posa_original_amount=30,
                posa_company_exchange_rate=1,
                posa_account_amount=30,
            ),
            Row(
                mode_of_payment="Online Transfer",
                type="Cash",
                account="Bank - FC",
                amount=0.32,
                base_amount=91.2,
                posa_payment_currency="USD",
                posa_original_amount=0.32,
                posa_company_exchange_rate=285,
                posa_account_amount=91.2,
            ),
        ]

        accounts_settings_meta = MagicMock()
        accounts_settings_meta.has_field.return_value = None
        fake_frappe = ModuleType("frappe")
        fake_frappe.get_meta = MagicMock(return_value=accounts_settings_meta)
        fake_frappe.db = MagicMock()
        fake_utils = ModuleType("frappe.utils")
        fake_utils.cint = lambda value: int(value or 0)
        fake_utils.flt = lambda value, precision=None: round(
            float(value or 0),
            precision if precision is not None else 6,
        )
        fake_erpnext = ModuleType("erpnext")
        fake_accounts = ModuleType("erpnext.accounts")
        fake_accounts_utils = ModuleType("erpnext.accounts.utils")
        fake_accounts_utils.get_account_currency = lambda _account: "PKR"

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
            invoice.before_save()
            gl_entries = []
            invoice.make_pos_gl_entries(gl_entries)

        self.assertEqual(invoice.payments[0].base_amount, 30)
        self.assertEqual(invoice.base_paid_amount, 121.2)
        self.assertEqual(invoice.base_change_amount, 1.5)
        self.assertEqual(len(gl_entries), 4)
        self.assertAlmostEqual(sum(row.get("credit", 0) for row in gl_entries), 119.7)
        cash_entry = next(row for row in gl_entries if row.get("account") == "Cash - FC")
        self.assertEqual(cash_entry["debit"], 28.5)
        self.assertEqual(cash_entry["debit_in_account_currency"], 28.5)
        self.assertAlmostEqual(cash_entry["debit_in_transaction_currency"], 0.1)
