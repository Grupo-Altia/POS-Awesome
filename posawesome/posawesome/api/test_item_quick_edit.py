import unittest
from types import SimpleNamespace
from unittest.mock import patch

from posawesome.posawesome.api import item_quick_edit


class TestItemQuickEditSupplierMapping(unittest.TestCase):
    def test_primary_supplier_prefers_item_supplier(self):
        fake_frappe = SimpleNamespace(
            db=SimpleNamespace(
                get_value=lambda *args, **kwargs: "ITEM SUPPLIER",
                exists=lambda *args, **kwargs: True,
            ),
            get_all=lambda *args, **kwargs: [{"supplier": "BRAND SUPPLIER"}],
        )

        with patch.object(item_quick_edit, "frappe", fake_frappe):
            self.assertEqual(
                item_quick_edit._get_primary_supplier("ITEM-001", "BRAND-001"),
                "ITEM SUPPLIER",
            )

    def test_primary_supplier_falls_back_to_brand_mapping(self):
        def get_value(doctype, *args, **kwargs):
            if doctype == "Item Supplier":
                return None
            return None

        fake_frappe = SimpleNamespace(
            db=SimpleNamespace(get_value=get_value, exists=lambda *args, **kwargs: True),
            get_all=lambda *args, **kwargs: [{"supplier": "BRAND SUPPLIER"}],
        )

        with patch.object(item_quick_edit, "frappe", fake_frappe):
            self.assertEqual(
                item_quick_edit._get_primary_supplier("ITEM-001", "BRAND-001"),
                "BRAND SUPPLIER",
            )


if __name__ == "__main__":
    unittest.main()
