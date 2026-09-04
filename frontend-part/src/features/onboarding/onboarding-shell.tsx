import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "../landing/brand-mark";

interface OnboardingShellProps {
  currentStep: 1 | 2;
  title: string;
  titleLang?: "en" | "km";
  titleKm: string;
  description: string;
  children: ReactNode;
}

export function OnboardingShell({
  currentStep,
  title,
  titleLang = "en",
  titleKm,
  description,
  children,
}: OnboardingShellProps) {
  return (
    <main className="auth-page onboarding-page">
      <header className="auth-header">
        <BrandMark />
        <Link href="/search">Browse rentals</Link>
      </header>

      <div className="auth-layout onboarding-layout">
        <section
          className="auth-context onboarding-context"
          aria-labelledby="onboarding-context-title"
        >
          <p className="auth-context-label">Account setup</p>
          <h1 id="onboarding-context-title" lang="km">
            {titleKm}
          </h1>
          <p>{description}</p>

          <ol
            className="onboarding-progress"
            aria-label="Account setup progress"
          >
            <li data-state={currentStep === 1 ? "current" : "complete"}>
              <span aria-hidden="true">1</span>
              <div>
                <strong>Choose your role</strong>
                <small>Student or landlord</small>
              </div>
            </li>
            <li data-state={currentStep === 2 ? "current" : "upcoming"}>
              <span aria-hidden="true">2</span>
              <div>
                <strong>Confirm your setup</strong>
                <small>Profile and access</small>
              </div>
            </li>
          </ol>
        </section>

        <section
          className="auth-form-region"
          aria-labelledby="onboarding-title"
        >
          <div className="auth-form-heading onboarding-form-heading">
            <p>Step {currentStep} of 2</p>
            <h2 id="onboarding-title" lang={titleLang}>
              {title}
            </h2>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
