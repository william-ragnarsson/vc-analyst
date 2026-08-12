"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/features/auth/AuthProvider";
import RecentAnalyses from "@/components/features/analyze/RecentAnalyses";

export default function AccountPage() {
  const { user, isIdentified, loading, configured, signIn, signOut } = useAuth();
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  if (!configured) return null;

  if (loading) {
    return <div className="mx-auto max-w-3xl px-6 pt-10 text-muted">Loading…</div>;
  }

  if (!isIdentified) {
    return (
      <div className="mx-auto max-w-3xl px-6 pt-10 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Account</h1>
        <p className="mt-2 text-muted">Sign in to see your profile and manage your data.</p>
        <button
          onClick={() => void signIn("google")}
          className="mt-6 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Continue with Google
        </button>
      </div>
    );
  }

  const email = user?.email ?? "";
  const name = (user?.user_metadata?.full_name as string | undefined) ?? email;
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete account.");
      }
      await signOut();
      router.push("/");
    } catch (e) {
      setDeleting(false);
      setDeleteError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 pt-10 pb-20">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Account</h1>

      <section className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white/55 px-5 py-4 backdrop-blur">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink/15 bg-ink/[0.06] text-lg font-semibold uppercase text-ink">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            (name || "?").charAt(0)
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{name || "Signed in"}</p>
          {email && name !== email && <p className="truncate text-sm text-muted">{email}</p>}
          <p className="mt-0.5 text-xs text-muted">
            Signed in with Google{memberSince ? ` · Member since ${memberSince}` : ""}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Your data
        </span>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/55 px-5 py-3.5 backdrop-blur">
          <p className="text-sm text-ink/80">
            Download everything stored about you — profile, analyses, and links to your decks.
          </p>
          <a
            href="/api/account/export"
            className="shrink-0 rounded-full border border-ink/15 px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-ink/[0.06]"
          >
            Export data
          </a>
        </div>
      </section>

      <RecentAnalyses />

      <section className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700/80">
          Danger zone
        </span>
        <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.04] px-5 py-4">
          {!confirmingDelete ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink/80">
                Permanently delete your account, every analysis, and every deck you&apos;ve uploaded.
              </p>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="shrink-0 rounded-full border border-red-600/30 px-4 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-600/10"
              >
                Delete account
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-red-800">
                This can&apos;t be undone. Everything you&apos;ve saved will be gone immediately.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="rounded-full bg-red-700 px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Yes, delete everything"}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="rounded-full px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
                >
                  Cancel
                </button>
              </div>
              {deleteError && <p className="text-sm text-red-700">{deleteError}</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
