# POSAwesome UX Enhancements

Date: 2026-07-10

This file is the durable working record for POSAwesome UX changes, decisions, and follow-up ideas. Use this file for future POSAwesome UX progress notes.

## Invoice Items Keyboard Control

Goal:

- Keep the existing `Tab` behavior that returns focus to item search.
- Add keyboard-only control for the invoice items table.
- Let the operator enter the table from item search with `Alt/Option+ArrowRight`.
- Show a solid focus bounding box over the active row or cell.
- Support row-selection mode first, then cell-selection mode.
- Use arrow keys to move across editable cells and between rows.
- Use `Enter` to activate/edit the selected cell.

Implemented:

- `Alt/Option+ArrowRight` enters the invoice items table on the latest cart row.
- First focus state selects the whole row.
- `ArrowRight` enters cell mode for that row.
- Arrow keys move across navigable cells and between rows.
- `Enter` activates the focused quantity, UOM, discount, rate, offer, expand, or delete control.
- Read-only cells such as item name, price-list rate, and amount are skipped.

Verification:

- `yarn vitest run tests/cartFieldFocus.spec.ts tests/invoiceShortcuts.spec.ts tests/keyboardNavigation.spec.ts`
- `yarn lint`
- `yarn build`

Commits:

- `d6401f129 Add invoice item keyboard grid navigation`

## Quantity Input UX

Decision:

- Replace the quantity minus/value/plus counter in the invoice items table with a normal numeric input.
- Keep the existing quantity update logic so totals, stock checks, pricing, taxes, offline sync, and submission behavior remain unchanged.

Implemented:

- Quantity now renders as a direct visible numeric input.
- The keyboard grid focus selector points to the quantity input shell.

Verification:

- `yarn vitest run tests/cartFieldFocus.spec.ts tests/invoiceShortcuts.spec.ts tests/keyboardNavigation.spec.ts`
- `yarn lint`
- `yarn build`

Commits:

- `87fe8be42 Use direct quantity input in invoice table`

## Item Past Sales By Invoice

Finding:

- POSAwesome already has aggregated item/product sales data in the supervisor dashboard.
- It does not currently have a dedicated drill-down view that shows all past sales of a selected item with invoice numbers.

Data source:

- Current RetailMind POS mode uses `Sales Invoice` and `Sales Invoice Item`.
- If POS Invoice mode is enabled, item history should also consider `POS Invoice` and `POS Invoice Item`.

Decision:

- Replace the invoice item inline expanded row with a modal opened by item-row click or row-mode `Enter`.
- Modal tab 1 shows company-wide submitted non-return sales for that item across both `Sales Invoice` and `POS Invoice`.
- Modal tab 2 shows the same item details fields that currently appear in the inline expanded row.
- Exclude returns/credit notes from the sales history.
- Add pagination and filters for invoice/customer search, date range, and doctype.

Progress:

- Backend read-only API implemented in `posawesome.posawesome.api.items.get_item_sales_history`.
- API aggregates duplicate item rows per invoice, excludes returns/credit notes, supports both `Sales Invoice` and `POS Invoice`, and paginates results.
- Invoice item rows now open an item history/details modal on row click, history icon click, or row-mode `Enter`.
- Modal sales-history tab supports invoice/customer search, date filters, doctype filter, pagination, invoice viewing, `Esc` close, left/right tab switching, up/down row navigation, and `Enter` to view the selected invoice.
- Modal details tab reuses the existing item details form instead of the old inline expanded row.
- Plain arrow keys now enter the invoice-item keyboard grid without requiring `Alt/Option+ArrowRight`: `ArrowDown` starts at the first row, `ArrowUp` starts at the last row, `ArrowRight` starts at the first navigable cell, and `ArrowLeft` starts at the last navigable cell. Active editors and overlays keep their native arrow behavior.
- The item history modal now has its own default keyboard bounding box. Arrow keys move the box across tabs, filters, sales rows, pagination, and actions; `Enter` focuses/activates the boxed target; `Esc` exits field editing or closes the modal.

Verification:

- `yarn type-check`
- `yarn vitest run tests/cartFieldFocus.spec.ts tests/invoiceShortcuts.spec.ts tests/keyboardNavigation.spec.ts`
- `yarn build`
- `PYTHONPATH=/Users/mac/frappe-bench/apps/frappe:/Users/mac/frappe-bench/apps/erpnext:/Users/mac/frappe-bench/apps/posawesome /Users/mac/anaconda3/bin/conda run -n frappe python -m unittest posawesome.posawesome.api.test_items_numeric_code.TestItemSalesHistory`
- `bench --site retailmind.local run-tests --app posawesome --module posawesome.posawesome.api.test_items_numeric_code` is currently blocked by existing local ERPNext Fiscal Year fixture overlap before POSAwesome tests run.

## Sales Invoice vs POS Invoice

Current default before test switch:

- RetailMind POSAwesome was generating `Sales Invoice` documents with `is_pos = 1`.
- Local database check showed `Sales Invoice: 10` and `POS Invoice: 0`.
- POS Profile field `create_pos_invoice_instead_of_sales_invoice` was `0` for all local POS profiles.

Practical meaning:

- `Sales Invoice` mode creates the accounting invoice directly at sale time.
- `POS Invoice` mode creates POS-specific documents first, then POS closing can consolidate them into `Sales Invoice` records.

Recommendation captured during discussion:

- Keep `Sales Invoice` mode for normal RetailMind operation unless ERPNext-style POS Invoice consolidation is specifically needed.
- `Sales Invoice` mode does not require closing for accounting consolidation, but closing is still useful for cashier/day-end reconciliation.

## POS Closing And Consolidation

Finding:

- This POSAwesome fork includes POS opening and POS closing flows.
- Relevant doctypes include `POS Opening Shift`, `POS Closing Shift`, and `POS Invoice Submission Ledger`.
- The POS UI includes a closing dialog.

Closing behavior:

- In `Sales Invoice` mode, closing creates/submits a `POS Closing Shift`, links invoices, reconciles payments/cash, submits printed draft invoices, and can clean draft invoices. No invoice consolidation is needed because sales are already `Sales Invoice` records.
- In `POS Invoice` mode, closing also calls ERPNext POS invoice consolidation so POS invoices are consolidated into `Sales Invoice` records.

Local status before test switch:

- `POS Closing Shift` records: `0`
- `POS Opening Shift` records: `3`

## Supervisor Behavior

Finding:

- POSAwesome supervisor is a normal Frappe `User`, not an accounting account.
- Supervisor status is determined by the `POS Awesome Supervisor` role, with legacy support for the old `posa_is_pos_supervisor` user field.

Local supervisor:

- User: `aqib@ai.ai`
- Full name: `Aqib Hameeed`
- Role: `POS Awesome Supervisor`
- Assigned POS Profile: `POS Awesome - MedPlus`

Invoice management behavior:

- Supervisors can use the POS Profile selector in Invoice Management.
- The selector includes `All`.
- Selecting `All` removes the `pos_profile` filter and uses company scope.
- Non-supervisor users remain scoped to their current POS Profile.

## 2026-07-10 Local POS Invoice Test Switch

Request:

- Enable POS Invoice mode locally so the POS closing/consolidation flow can be tested.

Action:

- Set `create_pos_invoice_instead_of_sales_invoice = 1` for local POS Profiles:
  - `POS Awesome - MedPlus`
  - `POS Awesome - MedPlus Cashier`
  - `POS Terminal 1`
- Cleared Frappe cache for `retailmind.local`.

Expected result:

- New POS sales should now be created as `POS Invoice`.
- Existing `Sales Invoice` records remain unchanged.
- Closing the active shift should create a `POS Closing Shift` and run POS Invoice consolidation into `Sales Invoice` records.

Rollback command:

```sql
update `tabPOS Profile`
set create_pos_invoice_instead_of_sales_invoice = 0
where name in ('POS Awesome - MedPlus', 'POS Awesome - MedPlus Cashier', 'POS Terminal 1');
```

## 2026-07-10 Invoice Items Direct Keyboard Editing

Issue:

- The invoice items grid required `Enter` to activate a cell before typing.
- After entering a value, focus could leave the invoice table and return to item search.
- Quantity keyboard focus could land on the visual shell instead of the actual input.
- The focused quantity cell showed both the outer grid bounding box and the inner text-field outline.

Decision:

- When the grid bounding box enters an editable cell, that cell should become ready for typing immediately.
- `Enter` after typing should commit the current value and move to the next editable entry in the same row.
- `ArrowRight` and `ArrowLeft` should commit the active field and move the bounding box across columns.
- `ArrowUp` and `ArrowDown` should commit the active field and move to the same column on the adjacent row.
- The active input should blur before movement so the caret does not stay behind and interfere with grid navigation.

Implementation notes:

- Grid key handling now runs in capture phase so arrow and enter navigation are handled before inner inputs consume those keys.
- Quantity grid focus now targets the real numeric input, not only the outer quantity shell.
- Editable grid cells auto-activate on focus: quantity, UOM, discount %, discount amount, and rate.
- Non-edit cells such as offer, delete, and expand still require activation.
- Quantity inner text-field outline is suppressed while the grid cell bounding box is active to avoid double-box UI.

Verification:

- `yarn vitest run tests/cartFieldFocus.spec.ts tests/invoiceShortcuts.spec.ts tests/keyboardNavigation.spec.ts`
- `yarn build`
- `yarn lint`

Follow-up:

- Quantity edit mode now starts with an empty input so operators can type the replacement quantity immediately.
- If the operator leaves quantity blank and moves away, the previous cart quantity is restored instead of being overwritten.

## 2026-07-10 Item Quick Edit Modal

Request:

- Add a POS item-maintenance modal based on the legacy pharmacy item screen.
- Open it from POS with `F12` on Windows/non-Mac terminals and `Option+7` on macOS.
- Make pricing and item-control changes enforceable in the system.

Implemented:

- Added backend migration `posawesome.patches.add_item_quick_edit_fields`.
- Added custom fields:
  - `POS Profile.posa_allow_item_quick_edit`
  - `Item.retailmind_short_name`
  - `Item.retailmind_controlled_item`
  - `Item.retailmind_non_discountable`
  - `Item.retailmind_locked_for_sale`
- Added backend API module `posawesome.posawesome.api.item_quick_edit`:
  - `get_item_quick_edit`
  - `save_item_quick_edit`
- Added backend sale-control validation module:
  - POS-only locked items are blocked by cart/invoice validation.
  - Non-discountable items reject line discounts server-side.
  - Controlled items are warning/logging flags only for v1.
- Added frontend modal `ItemQuickEditDialog.vue`.
- Wired `F12` and macOS `Option+7` shortcuts through the existing invoice shortcut handler.
- Wired saved item rows back into the POS item catalog and active cart rows.
- Added immediate client-side blocking for locked items and disabled discount editing for non-discountable rows.
- Expanded invoice item keyboard control:
  - Plain arrow keys outside text-editing inputs now enter the invoice items grid and show the bounding box.
  - Arrow keys pressed inside the invoice items table also auto-activate row/cell navigation when the grid is inactive.
  - Text inputs outside the cart keep normal arrow-key caret/search behavior.

Design note:

- A visual design preview was generated with imagegen at `/Users/mac/.codex/generated_images/019f4b80-6ba5-7692-acdc-4329484ef431`.
- The unlabeled `15` field from the legacy screenshot is intentionally not implemented until its old-POS source column is confirmed.

Verification:

- `node -e "JSON.parse(require('fs').readFileSync('posawesome/fixtures/custom_field.json','utf8'))"`
- `/Users/mac/anaconda3/bin/conda run -n frappe python -m unittest posawesome.posawesome.api.test_item_sale_controls`
- `/Users/mac/anaconda3/bin/conda run -n frappe python -m unittest posawesome.posawesome.api.invoice_processing.test_creation`
- `PYTHONPATH=/Users/mac/frappe-bench/apps/frappe:/Users/mac/frappe-bench/apps/erpnext:/Users/mac/frappe-bench/apps/posawesome /Users/mac/anaconda3/bin/conda run -n frappe python -c "import posawesome.posawesome.api.item_quick_edit; import posawesome.posawesome.api.item_sale_controls; print('quick edit imports ok')"`
- `/Users/mac/anaconda3/bin/conda run -n frappe bench --site retailmind.local migrate`
- `/Users/mac/anaconda3/bin/conda run -n frappe bench --site retailmind.local execute posawesome.posawesome.api.item_quick_edit.get_item_quick_edit --kwargs "{'item_code':'CH062','pos_profile':'POS Awesome - MedPlus'}"`
- `yarn test:unit tests/invoiceShortcuts.spec.ts`
- `yarn type-check`
- `yarn lint`
- `yarn build`
- `/Users/mac/anaconda3/bin/conda run -n frappe bench build --app posawesome`

Notes:

- Retail price updates also synchronize the active selling item price, `Retail Selling` and `Standard Selling` when those price lists exist, and `Item.standard_rate`.
- Trade price updates synchronize the buying item price only.
- Item quick edit save is available to privileged item/stock/system managers, or to POS supervisors only when the active POS Profile has `posa_allow_item_quick_edit` enabled.
