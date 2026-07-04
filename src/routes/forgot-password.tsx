import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Reset link sent — check your email.");
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="surface-card w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-display text-4xl">Ledger</h1>
          <p className="text-sm text-muted-foreground">Reset your password</p>
        </div>

        {sent ? (
          <div className="space-y-4 text-center text-sm text-muted-foreground">
            <p>
              We sent a password reset link to <span className="text-foreground">{email}</span>.
            </p>
            <p>Click the link in the email to set a new password.</p>
          </div>
        ) : (
          <form onSubmit={sendLink} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <Link
          to="/auth"
          className="block text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
