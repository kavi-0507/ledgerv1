# Rent & Bills Deadlines Page

## Overview
Add a dedicated `/rent-bills` page where the user creates housing/utility payment deadlines first, then ticks them off when paid. It is completely separate from transactions — it does not feed budgets, charts, or the activity feed.

## Database schema
Create one new table: `public.rent_bills`.

Fields:
- `id` uuid primary key
- `user_id` uuid not null (references auth.users)
- `title` text not null (e.g., "Rent", "Electricity", "Water")
- `amount` numeric not null
- `due_date` date not null
- `recurrence` text not null default 'monthly' — allowed values: `one-off`, `weekly`, `monthly`, `termly`, `yearly`
- `status` text not null default 'pending' — allowed values: `pending`, `paid`
- `paid_at` timestamp with time zone
- `notes` text
- `series_id` uuid nullable — self-reference to the first occurrence of a recurring bill, used to group history and generate the next deadline
- `created_at` / `updated_at` timestamps

RLS: authenticated users can only manage rows where `user_id = auth.uid()`. Include GRANTs and the standard `update_updated_at_column` trigger.

Logic for auto-recurrence:
- When a pending bill is marked as paid, set `status = 'paid'` and `paid_at = now()`.
- If `recurrence != 'one-off'` and no later pending occurrence exists for the same `series_id`, insert a new `rent_bills` row with the due date advanced by the recurrence period.
- If the paid row has no `series_id`, use its own `id` as the new row's `series_id`.

## Route & navigation
- Create `src/routes/rent-bills.tsx` mapped to `/rent-bills`.
- Add a "Rent & Bills" item to the AppShell navigation (sidebar on desktop, bottom bar on mobile) between "Budgets" and "Insights".

## Page features
1. **Header**: title "Rent & Bills", subtitle "Deadlines and payment history, separate from your spending feed."
2. **Add deadline button**: opens a dialog to create a new bill.
3. **Dialog fields**:
   - Title (required)
   - Amount (required)
   - Due date (required)
   - Recurrence (one-off / weekly / monthly / termly / yearly)
   - Notes (optional)
4. **Upcoming deadlines list** (pending only, sorted by due_date ascending):
   - Each row shows title, amount, due date, days-until-due label, and a "Mark paid" checkbox/tick.
   - Overdue items get a warning tone.
5. **History section** (paid rows, sorted by paid_at descending):
   - Shows title, amount, due date, paid date.
   - Collapsible or in a separate tab.
6. **Row actions**:
   - Edit title, amount, due date, recurrence, notes for a pending bill.
   - Delete a pending bill or a paid history entry.
7. **Empty state** when no deadlines exist yet.

## UI / components
Reuse existing design-system primitives:
- `AppShell`, `PageHeader`, `EmptyState`, `StatusPill`, `Button`, `Input`, `Label`, `Select`, `Dialog`, `AlertDialog`.
No new design tokens needed.

## Out of scope
- No integration with transactions, budgets, insights, or recommendations.
- No spending summaries or totals (per user request).
- No notifications or reminders beyond this page.

## Files to create / modify
- `supabase/migration` — create `rent_bills` table with RLS, grants, trigger.
- `src/lib/supabase.ts` — add `DbRentBill` type.
- `src/lib/db.ts` — add `useRentBills` hook.
- `src/routes/rent-bills.tsx` — new page.
- `src/components/ds/AppShell.tsx` — add navigation link.
