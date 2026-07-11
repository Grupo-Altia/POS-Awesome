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


class TestItemQuickEditPosRow(unittest.TestCase):
    def test_build_pos_item_row_uses_retail_rate_without_catalog_search(self):
        row = item_quick_edit._build_pos_item_row(
            {
                "name": "ITEM-001",
                "item_code": "ITEM-001",
                "item_name": "Test Item",
                "stock_uom": "Nos",
                "retail_price": 10,
            }
        )

        self.assertEqual(row["item_code"], "ITEM-001")
        self.assertEqual(row["uom"], "Nos")
        self.assertEqual(row["rate"], 10)
        self.assertEqual(row["price_list_rate"], 10)


if __name__ == "__main__":
    unittest.main()
