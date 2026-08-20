"""Accounting hooks for POS invoice rows carrying an original tender currency."""

class MultiCurrencyPOSPaymentsMixin:
    def set_paid_amount(self):
        from frappe.utils import flt

        paid_amount = 0.0
        base_paid_amount = 0.0
        for payment in self.payments:
            if (
                payment.get("posa_payment_currency")
                and payment.get("posa_original_amount") not in (None, "")
                and flt(payment.get("posa_company_exchange_rate")) > 0
            ):
                payment.base_amount = flt(
                    payment.get("posa_original_amount")
                    * payment.get("posa_company_exchange_rate"),
                    self.precision("base_paid_amount"),
                )
            else:
                payment.base_amount = flt(
                    payment.amount * self.conversion_rate,
                    self.precision("base_paid_amount"),
                )
            paid_amount += payment.amount
            base_paid_amount += payment.base_amount

        self.paid_amount = paid_amount
        self.base_paid_amount = base_paid_amount

    def make_pos_gl_entries(self, gl_entries):
        import frappe
        from frappe.utils import cint, flt
        from erpnext.accounts.utils import get_account_currency

        if not cint(self.is_pos):
            return

        skip_change_gl_entries = not cint(
            frappe.db.get_single_value("Accounts Settings", "post_change_gl_entries")
        )
        for payment_mode in self.payments:
            if skip_change_gl_entries and payment_mode.account == self.account_for_change_amount:
                payment_mode.base_amount -= flt(self.change_amount)

            against_voucher = self.name
            if self.is_return and self.return_against and not self.update_outstanding_for_self:
                against_voucher = self.return_against

            if not payment_mode.base_amount:
                continue

            gl_entries.append(
                self.get_gl_dict(
                    {
                        "account": self.debit_to,
                        "party_type": "Customer",
                        "party": self.customer,
                        "against": payment_mode.account,
                        "credit": payment_mode.base_amount,
                        "credit_in_account_currency": payment_mode.base_amount
                        if self.party_account_currency == self.company_currency
                        else payment_mode.amount,
                        "credit_in_transaction_currency": payment_mode.amount,
                        "against_voucher": against_voucher,
                        "against_voucher_type": self.doctype,
                        "cost_center": self.cost_center,
                    },
                    self.party_account_currency,
                    item=self,
                )
            )

            account_currency = get_account_currency(payment_mode.account)
            account_amount = payment_mode.get("posa_account_amount")
            if not account_amount:
                account_amount = (
                    payment_mode.base_amount
                    if account_currency == self.company_currency
                    else payment_mode.amount
                )
            gl_entries.append(
                self.get_gl_dict(
                    {
                        "account": payment_mode.account,
                        "against": self.customer,
                        "debit": payment_mode.base_amount,
                        "debit_in_account_currency": account_amount,
                        "debit_in_transaction_currency": payment_mode.amount,
                        "cost_center": self.cost_center,
                    },
                    account_currency,
                    item=self,
                )
            )

        if not skip_change_gl_entries:
            self.make_gle_for_change_amount(gl_entries)
