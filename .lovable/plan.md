## Goal
Add multi-select and totals to the Transactions page.

## Changes (all in `src/routes/transactions.tsx`)

### 1. Selection state
- Add `selected: Set<string>` state in `TransactionsPage`.
- Add a "Select" toggle button in the filter bar. When active:
  - Show a checkbox on the left of each `TxRow`.
  - Show a sticky action bar above the list.
- Clicking a row while in select mode toggles selection instead of opening the edit dialog.
- Reset selection when filters/page change or select mode is turned off.

### 2. Action bar (shown above rows when select mode is on)
Layout: `[✓ N selected] [Select all on page] [Clear]  ——  [Mark reviewed] [Flag for review] [Delete]`
- **Mark reviewed**: bulk update `needs_review = false` for selected IDs.
- **Flag for review**: bulk update `needs_review = true`.
- **Delete**: confirm via `AlertDialog`, then bulk delete.
- All actions use `supabase.from("transactions").update/delete().in("id", ids)`, then invalidate `["transactions"]` and `["home_month_tx"]`, and clear selection.
- Disabled when `selected.size === 0`.

### 3. Totals summary (always visible, above rows)
A compact row inside the list card header showing:
- **When selection is empty**: totals for the *currently filtered result set* — `Expenses`, `Income`, `Net`, and count. Uses `q.data.items` for the current page; label it "This page" so it's honest about pagination. If a category filter is active, prefix with the category name ("Groceries · This page").
- **When selection is non-empty**: totals recompute from selected rows only — `N selected · Expenses X · Income Y · Net Z`.

Values formatted with `formatMoney`; income green, expense default, net colored by sign.

### 4. Small UX details
- Header "Select" button toggles label to "Done" while active.
- `Checkbox` uses existing `@/components/ui/checkbox`.
- Row click behavior: if `selectMode` → toggle; else → open edit dialog (current behavior).
- Keep everything else on the page unchanged.

## Out of scope
- No changes to schema, queries, or other pages.
- No "select across pages" — selection is scoped to loaded items; changing pages clears selection.
