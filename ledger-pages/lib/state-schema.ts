import { z } from "zod";
const category = z.string().min(1).max(100);
const reviewReason = z.enum(["category", "possible_duplicate", "refund"]);
export const stateSchema = z.object({
  version: z.literal(2).optional(),
  categoryDefs: z.array(z.object({ id: z.string().uuid(), name: z.string().min(1).max(60), custom: z.boolean().optional() })).max(100).optional(),
  budgetMonths: z.array(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), budgets: z.array(z.object({ category, limit: z.number().finite().min(0).max(1e9) })).max(100), income: z.number().finite().min(0).max(1e9).optional(), savings: z.number().finite().min(0).max(1e9).optional() })).max(240).optional(),
  csvMappings: z.array(z.object({ key: z.string().max(500), header: z.boolean(), dateCol: z.number().int().min(0).max(100), descCol: z.number().int().min(0).max(100), amountCol: z.number().int().min(0).max(100), debitCol: z.number().int().min(0).max(100), creditCol: z.number().int().min(0).max(100), order: z.enum(["DMY","MDY"]), amountMode: z.string().max(20) })).max(50).optional(),
  runway: z.object({ mode: z.enum(["manual","estimate"]), availableNow: z.number().finite().min(0).max(1e9).optional(), recordedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), nextPaymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), estimateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).nullable().optional(),
  name: z.string().max(80),
  income: z.number().finite().min(0).max(1e9),
  savings: z.number().finite().min(0).max(1e9),
  setup: z.boolean(),
  transactions: z
    .array(
      z.object({
        id: z.string().max(100),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        merchant: z.string().min(1).max(300),
        amount: z.number().finite().min(-1e9).max(1e9),
        category,
        review: z.boolean(),
        reviewReasons: z.array(reviewReason).max(3).optional(),
        source: z.string().max(200),
      }),
    )
    .max(50000),
  budgets: z
    .array(z.object({ category, limit: z.number().finite().min(0).max(1e9) }))
    .max(30),
  bills: z
    .array(
      z.object({
        id: z.string().max(100),
        name: z.string().min(1).max(200),
        amount: z.number().finite().positive().max(1e9),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        recurrence: z.enum(["monthly", "weekly", "termly", "yearly", "once"]),
        payments: z
          .array(z.object({ date: z.string(), transactionId: z.string(), dueDate: z.string().optional() }))
          .max(1000),
      }),
    )
    .max(200),
  rules: z
    .array(
      z.object({
        id: z.string(),
        merchant: z.string().min(1).max(200),
        category,
        direction: z.number().int().min(-1).max(1).optional(),
      }),
    )
    .max(500),
  imports: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().max(200),
        date: z.string(),
        count: z.number().int().min(0),
        duplicates: z.number().int().min(0),
      }),
    )
    .max(2000),
});
