import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { blankState, categories, upgradeState, type LedgerState } from "./ledger";
import { stateSchema } from "./state-schema";

let client: SupabaseClient | undefined;

export function authRedirectUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  return `${url.origin}${path}`;
}

/** Inject a client in domain tests; production code never calls this. */
export function setWorkspaceClientForTests(value: SupabaseClient | undefined) {
  client = value;
}

function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Ledger accounts are not configured yet. The example remains available.");
  return (client = createClient(url, key, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  }));
}

export const auth = {
  async getUser(): Promise<{ id: string } | null> {
    const db = supabase();
    const { data: session, error: sessionError } = await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session.session) return null;
    const { data, error } = await db.auth.getUser();
    if (error) throw error;
    return data.user ? { id: data.user.id } : null;
  },
  async signInWithOtp(email: string, redirectTo: string) {
    const { error } = await supabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
  },
  async verifyEmailCode(email: string, token: string) {
    const { data, error } = await supabase().auth.verifyOtp({ email, token, type: "email" });
    if (error) throw error;
    if (!data.session) throw new Error("The code did not create a session. Please request a new code.");
  },
  async signOut() {
    const { error } = await supabase().auth.signOut();
    if (error) throw error;
  },
  subscribe(listener: (event: "SIGNED_IN" | "SIGNED_OUT") => void) {
    const { data: { subscription } } = supabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") listener(event);
    });
    return () => subscription.unsubscribe();
  },
};

export function validateWorkspace(state: LedgerState) {
  if (JSON.stringify(state).length > 8_000_000) throw new Error("Your data is too large to save in one go.");
  const parsed = stateSchema.safeParse(state);
  if (!parsed.success) throw new Error("Please check your entries and try again.");
  const validCategories = new Set([...categories, ...(state.categoryDefs || []).map(c => c.id)]);
  const definitions = state.categoryDefs || [];
  const names = [...categories.map(c => c.toLowerCase()), ...definitions.map(c => c.name.toLowerCase())];
  if (new Set(definitions.map(c => c.id)).size !== definitions.length ||
    new Set(names).size !== names.length ||
    new Set((state.budgetMonths || []).map(m => m.month)).size !== (state.budgetMonths || []).length ||
    (state.budgetMonths || []).some(m => new Set(m.budgets.map(b => b.category)).size !== m.budgets.length)) {
    throw new Error("Your categories or monthly plans contain a duplicate. Refresh and try again.");
  }
  if ([...state.transactions, ...state.budgets, ...state.rules].some(item => !validCategories.has(item.category)) ||
    (state.budgetMonths || []).some(month => month.budgets.some(item => !validCategories.has(item.category)))) {
    throw new Error("A category is missing from your workspace. Refresh and try again.");
  }
  const transactionIds = new Set(state.transactions.map(t => t.id));
  const linkedIds = state.bills.flatMap(b => b.payments.map(p => p.transactionId));
  if (transactionIds.size !== state.transactions.length ||
    new Set(state.bills.map(b => b.id)).size !== state.bills.length ||
    new Set(state.budgets.map(b => b.category)).size !== state.budgets.length ||
    new Set(linkedIds).size !== linkedIds.length || linkedIds.some(id => !transactionIds.has(id))) {
    throw new Error("Some entries are linked twice or missing. Refresh your saved data and try again.");
  }
  return parsed.data;
}

export async function loadWorkspace(): Promise<{ state: LedgerState; revision: number }> {
  const user = await auth.getUser();
  if (!user) throw new Error("Please sign in to load your money.");
  const { data, error } = await supabase().from("ledger_workspaces")
    .select("state,revision")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Your money could not be loaded: ${error.message}`);
  return { state: data ? upgradeState(data.state as LedgerState) : blankState(), revision: data?.revision ?? 0 };
}

export async function saveWorkspace(state: LedgerState, revision: number): Promise<number> {
  const nextState = validateWorkspace(state);
  if (!await auth.getUser()) throw new Error("Please sign in before saving.");
  const { data, error } = await supabase().rpc("save_ledger_workspace", {
    expected_revision: revision,
    next_state: nextState,
  });
  if (error) {
    if (error.message.includes("revision_conflict")) throw new Error("Your data changed in another tab. Reload before saving again.");
    throw new Error(`Your changes could not be saved: ${error.message}`);
  }
  if (typeof data !== "number") throw new Error("Save response was incomplete. Reload before editing again.");
  return data;
}
