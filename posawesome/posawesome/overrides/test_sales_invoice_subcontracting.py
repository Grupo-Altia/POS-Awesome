from types import SimpleNamespace
from unittest import TestCase

from posawesome import hooks
from posawesome.posawesome.overrides.sales_invoice_subcontracting import (
    SalesInvoiceSubcontractingGuardMixin,
)


class _ERPNextInvoice:
    def is_subcontracted(self):
        self.erpnext_calls += 1
        if self.has_subcontracted:
            self.update_stock = 0
        return self.has_subcontracted


class _Invoice(SalesInvoiceSubcontractingGuardMixin, _ERPNextInvoice):
    def __init__(self, items=None, has_subcontracted=False):
        self.items = items or []
        self.has_subcontracted = has_subcontracted
        self.update_stock = 1
        self.erpnext_calls = 0


class TestSalesInvoiceSubcontractingGuard(TestCase):
    def test_guard_is_registered_for_both_invoice_controllers(self):
        extension = (
            "posawesome.posawesome.overrides.sales_invoice_subcontracting."
            "SalesInvoiceSubcontractingGuardMixin"
        )

        self.assertIn(extension, hooks.extend_doctype_class["Sales Invoice"])
        self.assertIn(extension, hooks.extend_doctype_class["POS Invoice"])

    def test_skips_erpnext_lookup_when_no_sales_order_is_linked(self):
        invoice = _Invoice(
            items=[
                SimpleNamespace(sales_order=None),
                SimpleNamespace(sales_order=""),
            ]
        )

        self.assertFalse(invoice.is_subcontracted())
        self.assertEqual(invoice.erpnext_calls, 0)
        self.assertEqual(invoice.update_stock, 1)

    def test_delegates_when_a_sales_order_is_linked(self):
        invoice = _Invoice(items=[SimpleNamespace(sales_order="SO-0001")])

        self.assertFalse(invoice.is_subcontracted())
        self.assertEqual(invoice.erpnext_calls, 1)

    def test_preserves_erpnext_handling_for_known_subcontracting(self):
        invoice = _Invoice(has_subcontracted=True)

        self.assertTrue(invoice.is_subcontracted())
        self.assertEqual(invoice.erpnext_calls, 1)
        self.assertEqual(invoice.update_stock, 0)
