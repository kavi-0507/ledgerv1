# Ledger: a simpler student money journey

The redesign starts with the useful question: “Am I okay this month?” The overview shows money left after spending, savings, and unpaid bills, then offers the next small action.

## What the original project does

The linked repository is a React and TypeScript app using TanStack routing and queries, Supabase authentication and tables, Tailwind, Lucide, and Recharts. Its source includes transactions, budgets, insights, a standalone review queue, CSV imports, merchant matching, and bill/payment linking. The public website opens on account creation; its signed-in screens were inspected through the source rather than another person's account.

The README mentions a separate Python API, but this checkout contains neither that backend nor the referenced API.md or openapi.json. The implemented routes use Supabase directly. This rebuild has its own private storage and does not migrate or modify the original Supabase data or GitHub repository.

## First visit

1. Explore a clearly labelled example month without making any decisions.
2. Choose **Use my own money**. Sign-in is handled by the hosting platform.
3. Import a bank CSV or add a transaction. The spending picture appears without budget setup.
4. Choose a monthly category plan later. Suggestions use up to three completed months with enough transactions, or a clearly labelled starter example when there is too little history.
5. Optionally plan until the next payment by entering money available now or using a visibly caveated estimate from imported cash flow.

Setup can be skipped, and imports do not require categories or merchant rules to be configured first. Example changes are temporary; personal entries are stored against the signed-in account. Monthly category limits can be edited without changing saved earlier months.

## Import and review

| Stage | What the student sees | What Ledger does |
| --- | --- | --- |
| Choose a file | Bank CSV, drag and drop, sample download | Reads the CSV locally; the original file is not uploaded or changed |
| Check details | Matched columns, date order, and first entries | Handles headers or no headers, quoted fields, comma/semicolon delimiters, signed or separate debit/credit amounts; remembers a confirmed mapping for the same CSV format |
| Preview | New entries, duplicates skipped, uncertain categories | Rejects impossible dates; checks duplicates within the file and against saved entries |
| Add | One confirmation | Saves accepted entries and import history together |
| Quick check | Uncertain merchants grouped together | One choice categorises every unresolved transaction in the group and can remember the merchant for future imports; possible duplicates and refunds have separate checks |

Unreadable rows are not silently discarded: the student must explicitly choose to skip them. Repeated entries with identical date, description, and amount are skipped; genuinely separate identical payments can be added manually. Similar payments are kept and flagged for a check.

The review destination is a **To check** filter inside Transactions. Confirmed transactions are never changed by group review. “Use this for future payments” saves a direction-aware merchant rule. Exact duplicates are skipped; possible duplicates require a keep/remove decision. Refunds stay visibly separate from ordinary unknown categories.

## A normal week

Open Overview, see spending and the optional payment runway, check uncertain merchant groups, and look at upcoming bills. Insights keep detailed categories even if no budget exists for a category. The chart and insights use the same transaction calculations as the overview.

The monthly planning estimate uses expected monthly income when entered, otherwise imported income so far, less spending, the greater of savings made and the month's savings goal, and unpaid bills due in that month. Transfers and savings are excluded from expense spending. It is a planning estimate, not a connected bank balance. The optional runway divides manual money available now or imported net cash flow across weeks until the next payment, after upcoming unpaid bills and savings still to set aside. Rough mode warns that opening balances or other accounts may be missing.

## Rent and bills

- **Add a bill** creates a reminder only.
- **Record payment** first offers matching imported spending entries. Linking one adds no transaction.
- **Add a new payment** creates exactly one spending entry when the payment has not been imported.
- Payment history records the linked entry. Removing an imported entry also removes its payment link.
- A paid recurring reminder can be moved to its next due date from bill details. Month-end dates are clamped to the last valid day.

Ledger records payment history; it does not transfer money. Recurring reminders advance when the student chooses **Move reminder to the next due date**. There are no email or push notifications in this version.

## Scope choices

Five main destinations: Overview, Transactions, Budget, Rent & bills, and Insights. Imports are an action available wherever needed; review is a transaction filter; merchant shortcuts and custom categories live in Settings. Earlier monthly plan amounts are saved automatically. Budget scores and manual snapshot/carry-forward controls are omitted.

This version uses GBP, 15 starter categories including the previous combined Rent & bills category, custom categories, and CSV/manual entry. Existing users of this Site keep their transactions, bills, links, rules, imports and budgets through an in-place workspace upgrade. The original Lovable/Supabase project's accounts and records are separate and are not migrated.

## Verification

TypeScript, lint, production build, domain checks, and local browser workflows are checked. Domain checks cover workspace upgrades, merchant grouping, rule precedence, CSV format recognition, budget history and suggestions, runway calculations, bill linking, and the existing CSV/parser cases. Browser checks cover importing, repeated CSV mapping, grouped review, optional budget setup, category creation/renaming, runway forms, and mobile overflow.
