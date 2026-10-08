"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/features/auth/AuthProvider";
import AuthCard, { AuthCardLogo } from "@/components/features/auth/AuthCard";
import {
  FormMessage,
  SECONDARY_BUTTON,
  Spinner,
  SubmitButton,
  TEXT_BUTTON,
  type FormNotice,
} from "@/components/features/auth/AuthFormParts";
import SignInCard from "@/components/features/auth/SignInCard";
import { decideAuthorization, loadAuthorization, type AuthorizationRequest } from "./actions";

/**
 * What a connected app gets to do — the tools `lib/mcp/server.ts` offers, and
 * all its token allows (supabase/migrations/0002_oauth_clients.sql).
 */
const ABILITIES = [
  "Analyze pitch decks you share with it, as you",
  "Read and update the analyses saved to your account",
];

/**
 * Where Supabase's OAuth server sends people when Claude (or any MCP client)
 * asks to connect to SevenFold: log in if need be, then approve or deny.
 */
export default function ConsentScreen({ authorizationId }: { authorizationId: string | null }) {
  const { isIdentified, loading, configured } = useAuth();

  if (!configured) return null;

  if (loading) {
    return <div className="mx-auto max-w-3xl px-6 pt-10 text-muted">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-sm px-4 pt-10 pb-20">
      {!authorizationId ? (
        <Problem message="This page needs a connection request. Start from Claude: add SevenFold as a connector, then connect." />
      ) : isIdentified ? (
        <ConsentCard authorizationId={authorizationId} />
      ) : (
        <SignInCard
          title="Log in to connect Claude"
          description="Claude will run analyses and read your reports as you, so it needs your SevenFold account. You'll confirm the connection next."
        />
      )}
    </div>
  );
}

function ConsentCard({ authorizationId }: { authorizationId: string }) {
  const [request, setRequest] = useState<AuthorizationRequest | null>(null);
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [message, setMessage] = useState<FormNotice | undefined>();
  // Supabase answers the lookup once per request, so a second one — Strict
  // Mode's double effect, say — would turn a good link into a dead one.
  const looked = useRef(false);

  useEffect(() => {
    if (looked.current) return;
    looked.current = true;
    void loadAuthorization(authorizationId).then((result) => {
      // Approved before: no need to ask again.
      if (result.kind === "redirect") window.location.assign(result.url);
      setRequest(result);
    });
  }, [authorizationId]);

  async function decide(approve: boolean) {
    if (busy) return;
    setBusy(approve ? "approve" : "deny");
    setMessage(undefined);
    const result = await decideAuthorization(authorizationId, approve);
    if (result.kind === "redirect") {
      // Stays busy: the browser is on its way back to the app.
      window.location.assign(result.url);
      return;
    }
    setBusy(null);
    setMessage({ tone: "error", text: result.message });
  }

  if (!request || request.kind === "redirect") {
    return (
      <AuthCard>
        <AuthCardLogo />
        <div role="status" className="mt-5 flex items-center gap-3 text-sm text-muted">
          <Spinner />
          {request ? "Taking you back…" : "Checking the connection request…"}
        </div>
      </AuthCard>
    );
  }

  if (request.kind === "error") return <Problem message={request.message} />;

  return (
    <AuthCard>
      <AuthCardLogo />
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">
        Connect {request.clientName} to SevenFold?
      </h1>
      <p className="mt-1.5 break-words text-sm leading-relaxed text-muted">
        It will act as <strong className="font-medium text-ink">{request.email}</strong> and be able to:
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-ink/85">
        {ABILITIES.map((ability) => (
          <li key={ability} className="flex gap-2">
            <span aria-hidden className="text-accent">
              ✓
            </span>
            {ability}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-ink/85">It can&apos;t delete anything or open the decks you uploaded here.</p>
      <p className="mt-4 break-words text-xs leading-relaxed text-muted">
        Approving sends you back to <strong className="font-medium text-ink">{request.redirectHost}</strong>. Only
        continue if that&apos;s where you started.
      </p>

      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void decide(true);
        }}
        className="mt-5 space-y-2.5"
      >
        <SubmitButton pending={busy === "approve"} pendingLabel="Connecting…">
          Approve
        </SubmitButton>
        <button
          type="button"
          onClick={() => void decide(false)}
          disabled={busy !== null}
          className={SECONDARY_BUTTON}
        >
          {busy === "deny" && <Spinner />}
          {busy === "deny" ? "Cancelling…" : "Deny"}
        </button>
      </form>

      {message && (
        <div className="mt-3">
          <FormMessage notice={message} />
        </div>
      )}
    </AuthCard>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <AuthCard>
      <AuthCardLogo />
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">Couldn&apos;t connect</h1>
      <p className="mt-1.5 break-words text-sm leading-relaxed text-muted">{message}</p>
      <p className="mt-5 text-center text-sm">
        <Link href="/" className={TEXT_BUTTON}>
          Go to SevenFold
        </Link>
      </p>
    </AuthCard>
  );
}
