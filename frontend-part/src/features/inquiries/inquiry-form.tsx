"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AuthApiError,
  getOnboardingState,
  isAuthenticationSessionError,
  refreshSession,
} from "../auth/auth-api";
import { createInquiry } from "./inquiries-api";
import { INQUIRY_MESSAGE_MAX, inquiryMessageError } from "./inquiry-model";
import styles from "./inquiry-form.module.css";

type Access =
  "loading" | "student" | "guest" | "onboarding" | "forbidden" | "error";

export function InquiryForm({
  listingId,
  slug,
}: {
  listingId: string;
  slug: string;
}) {
  const [access, setAccess] = useState<Access>("loading");
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const request = useRef<{ message: string; clientRequestId: string } | null>(
    null,
  );
  const accountId = useRef<string | null>(null);
  const sending = useRef(false);
  const generation = useRef(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const returnQuery = new URLSearchParams({
    next: `/rentals/${encodeURIComponent(slug)}`,
  });

  useEffect(() => {
    let active = true;
    const checkAccount = async () => {
      if (sending.current) return;
      const current = ++generation.current;
      setAccess("loading");
      try {
        const session = await refreshSession();
        const state = await getOnboardingState();
        if (!active || current !== generation.current) return;
        if (accountId.current !== session.user.id) {
          setMessage("");
          setSent(false);
          setError(null);
          setFieldError(null);
          request.current = null;
        }
        accountId.current = session.user.id;
        setAccess(
          state.role && state.role !== "STUDENT"
            ? "forbidden"
            : state.stage !== "COMPLETE"
              ? "onboarding"
              : "student",
        );
      } catch (caught) {
        if (!active || current !== generation.current) return;
        if (isAuthenticationSessionError(caught)) {
          setMessage("");
          setSent(false);
          accountId.current = null;
          request.current = null;
          setAccess("guest");
        } else setAccess("error");
      }
    };
    void checkAccount();
    const visible = () => {
      if (document.visibilityState === "visible") void checkAccount();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", visible);
    return () => {
      active = false;
      generation.current += 1;
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", visible);
    };
  }, [attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || access !== "student" || unavailable) return;
    const validation = inquiryMessageError(message);
    setFieldError(validation);
    if (validation) {
      textarea.current?.focus();
      return;
    }
    const normalized = message.trim();
    if (request.current?.message !== normalized)
      request.current = {
        message: normalized,
        clientRequestId: crypto.randomUUID(),
      };
    const input = request.current;
    sending.current = true;
    setPending(true);
    setError(null);
    const current = generation.current;
    try {
      await createInquiry(listingId, input);
      if (current !== generation.current) return;
      setSent(true);
      setMessage("");
      request.current = null;
    } catch (caught) {
      if (current !== generation.current) return;
      if (isAuthenticationSessionError(caught)) {
        setAccess("guest");
        setMessage("");
        request.current = null;
      } else if (
        caught instanceof AuthApiError &&
        caught.code === "LISTING_NOT_FOUND"
      ) {
        setUnavailable(true);
        setError(
          "This rental is no longer available for inquiries. Browse current rentals.",
        );
      } else if (
        caught instanceof AuthApiError &&
        ["ROLE_FORBIDDEN", "STUDENT_ONBOARDING_REQUIRED"].includes(caught.code)
      ) {
        setMessage("");
        request.current = null;
        setAttempt((value) => value + 1);
      } else if (
        caught instanceof AuthApiError &&
        caught.code === "INQUIRY_RATE_LIMITED"
      )
        setError(
          "You’ve reached the inquiry limit. Wait at least one minute between messages about the same rental, and send no more than 10 inquiries per hour. Your message is still here.",
        );
      else if (
        caught instanceof AuthApiError &&
        caught.code === "INQUIRY_REQUEST_CONFLICT"
      )
        setError(
          "This request was already used. Check your sent inquiries before sending another message.",
        );
      else
        setError(
          "We couldn’t confirm your inquiry was sent. Your message is still here. Try sending again, or check your sent inquiries first.",
        );
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  return (
    <section
      id="rental-inquiry"
      className={styles.section}
      aria-labelledby="inquiry-title"
    >
      <h2 id="inquiry-title">Send an inquiry</h2>
      <p>Ask about availability, utility costs, or arranging a visit.</p>
      {access === "loading" ? (
        <p role="status">Checking your account…</p>
      ) : access === "guest" ? (
        <p>
          <Link href={`/login?${returnQuery}`}>Sign in to send an inquiry</Link>
        </p>
      ) : access === "onboarding" ? (
        <p>
          <Link href={`/onboarding/role?${returnQuery}`}>
            Complete your student profile to send an inquiry
          </Link>
        </p>
      ) : access === "forbidden" ? (
        <p>Only student accounts can send rental inquiries.</p>
      ) : access === "error" ? (
        <div role="alert">
          <p>Your account could not be checked.</p>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry account check
          </button>
        </div>
      ) : sent ? (
        <div className={styles.success} role="status">
          <h3>Your inquiry was sent.</h3>
          <p>The landlord can read it in their FindMe inbox.</p>
          <Link href="/inquiries">View sent inquiries</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate aria-busy={pending}>
          <label htmlFor="inquiry-message">Your message</label>
          <textarea
            id="inquiry-message"
            ref={textarea}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setFieldError(null);
            }}
            rows={6}
            required
            maxLength={INQUIRY_MESSAGE_MAX}
            disabled={pending || unavailable}
            aria-invalid={Boolean(fieldError)}
            aria-describedby={`inquiry-help inquiry-count${fieldError ? " inquiry-field-error" : ""}`}
          />
          <p id="inquiry-help" className={styles.help}>
            Only this landlord can read your message. Include a phone number or
            Telegram username if you want a reply. Your account email and phone
            are not shared automatically.
          </p>
          <p id="inquiry-count" className={styles.count}>
            {Array.from(message).length.toLocaleString("en-US")} / 2,000
            characters
          </p>
          {fieldError ? (
            <p id="inquiry-field-error" role="alert" className={styles.error}>
              {fieldError}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className={styles.submit}
            disabled={pending || unavailable}
          >
            {pending
              ? "Sending…"
              : unavailable
                ? "Rental unavailable"
                : "Send inquiry"}
          </button>
          <Link href="/inquiries">View sent inquiries</Link>
        </form>
      )}
    </section>
  );
}
