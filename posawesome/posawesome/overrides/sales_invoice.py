"""Custom Sales Invoice controller for ERPNext compatibility fixes."""

from erpnext.accounts.doctype.sales_invoice.sales_invoice import (
    SalesInvoice as ERPNextSalesInvoice,
)

from posawesome.posawesome.overrides.sales_invoice_subcontracting import (
    SalesInvoiceSubcontractingGuardMixin,
)


class CustomSalesInvoice(SalesInvoiceSubcontractingGuardMixin, ERPNextSalesInvoice):
    """Apply POS Awesome's compatibility guards to Sales Invoice."""
