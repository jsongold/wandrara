"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { createClient } from "../lib/supabase/client";

// ログイン状態は client で取る（トップをサーバーで動的にしないため）。next は今の URL
export function AccountButton({ next, className, style }: { next: string; className?: string; style?: CSSProperties }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session?.user));
    return () => data.subscription.unsubscribe();
  }, []);

  const href = signedIn ? "/account" : `/login?next=${encodeURIComponent(next)}`;
  return (
    <Link href={href} aria-label={signedIn ? "アカウント" : "ログイン"} data-testid="account-button" className={className} style={style}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="9" r="3.5" />
        <path d="M5 19c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" />
      </svg>
    </Link>
  );
}
