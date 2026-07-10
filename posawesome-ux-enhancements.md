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

Potential UX enhancement:

- Add an item sales history drawer/table from item search or product dashboard.
- Show invoice number, date/time, customer, POS profile, qty, rate, discount, and amount.
- For supervisors, support company/profile scope. For cashiers, keep profile/permission scope.

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
