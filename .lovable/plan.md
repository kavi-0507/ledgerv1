## Do you have to set a budget every month?

No. Your budgets on the Budgets page are "live" — they automatically apply to the current month and every future month until you change them. Insights only freezes a snapshot for months that have already passed, so you keep one budget list and it rolls forward on its own.

That means the useful direction to copy is the opposite of what I first drafted: **pull an old month's budgets into this month** (carry forward), not push this month's budgets backwards.

## The bug first

Every date helper in `src/lib/insightsMonths.ts` builds dates with `new Date("2026-06-01")`. Date-only strings parse as UTC midnight, so in any timezone west of UTC that instant is still the previous month locally. That is why:

- Picking June shows May (every pick is off by one).
- July 2026 (the current month) never appears in the dropdown — the upper bound gets shifted back into June before the month list is built.

Fix: parse `YYYY-MM-DD` as local time everywhere (`monthStart`, `monthEnd`, `shiftMonth`, `monthLabel`, `monthShortLabel`, `enumerateMonths`, and the trend/filter comparisons in `insights.tsx`). Build dates from the string parts, no timezone math.

## Carry-forward feature

Two entry points, same underlying action:

1. **From Insights (any past month you're viewing)**  
   New "Carry these budgets forward…" button next to the month picker. Opens a dialog listing future months (up to and including the current calendar month). Pick which months to overwrite with this month's budget list. The current calendar month is offered but flagged: choosing it replaces your live budgets on the Budgets page.

2. **From the Budgets page**  
   New "Carry forward from another month…" action in the page header. Lets you pick any past month that has a snapshot, previews the budget list from that month, and on confirm replaces your live budgets with that list.

Both flows share one behaviour:
- Copies the whole budget list (names, linked categories, amounts, periods, kinds) atomically.
- Confirms before overwriting anything (either an existing snapshot or your live budgets).
- Never touches months earlier than the source month, and never silently changes months you didn't tick.

## Technical details

Files changed:

- `src/lib/insightsMonths.ts`
  - New `parseLocalDate(iso)` helper that reads `YYYY-MM-DD` into a local `Date`.
  - Rewrite `monthStart`, `monthEnd`, `shiftMonth`, `monthLabel`, `monthShortLabel`, `enumerateMonths` to use it.
  - `useAvailableMonths`: local parsing for min/max/today so July 2026 is included.
  - `applySnapshotToMonths(userId, groups, targetMonths)`: batch upsert into `budget_group_snapshots`, invalidate `["budget_snapshots"]` and `["insights_available_months"]`.
  - `replaceLiveBudgets(userId, groups)`: delete current rows in `budget_groups` for the user and insert the source list; used when carrying an old snapshot into the live budget list.

- `src/routes/insights.tsx`
  - Remove ad-hoc `new Date(iso)` math in `filterTx`, `canPrev`/`canNext`, and anywhere else it compares month strings.
  - Add "Carry these budgets forward…" button next to the month picker (hidden when there's no snapshot to copy).
  - New `CarryForwardDialog`: source = the currently-selected month's resolved snapshot; targets = months from the source month to the current calendar month (exclusive of the source); checkboxes with quick "All future months" / "Clear" toggles; warns which targets already have a snapshot; flags the current-calendar target as "also updates your live budgets". Confirm calls `applySnapshotToMonths` for the past-month targets and `replaceLiveBudgets` for the current-month target.

- `src/routes/budgets.tsx`
  - Add "Carry forward from another month…" action in the page header.
  - Dialog lists months that have a snapshot, shows a read-only preview of that snapshot's budgets, and on confirm calls `replaceLiveBudgets` and invalidates the budget groups query.

Reuses existing shadcn `Dialog`, `Checkbox`, `Button`, `Select` components. No schema changes — everything reuses `budget_groups` and `budget_group_snapshots`.

Out of scope: per-budget carry-forward (only whole-month copy for now), and any change to the Home page.