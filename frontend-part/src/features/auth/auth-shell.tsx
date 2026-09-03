import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "../landing/brand-mark";

interface AuthShellProps {
  title: string;
  titleKm: string;
  description: string;
  children: ReactNode;
}

export function AuthShell({
  title,
  titleKm,
  description,
  children,
}: AuthShellProps) {
  return (
    <main className="auth-page">
      <header className="auth-header">
        <BrandMark />
        <Link href="/search?university=rupp">Browse rentals</Link>
      </header>

      <div className="auth-layout">
        <section className="auth-context" aria-labelledby="auth-context-title">
          <p className="auth-context-label">FindMe account</p>
          <h1 id="auth-context-title" lang="km">
            {titleKm}
          </h1>
          <p>{description}</p>
          <dl className="auth-trust-list">
            <div>
              <dt>Private by default</dt>
              <dd>Your saved rooms and inquiries are not public.</dd>
            </div>
            <div>
              <dt>Built for students</dt>
              <dd>Rental search remains free for student accounts.</dd>
            </div>
          </dl>
        </section>

        <section className="auth-form-region" aria-labelledby="auth-form-title">
          <div className="auth-form-heading">
            <h2 id="auth-form-title">{title}</h2>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
