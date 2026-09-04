"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  AuthApiError,
  getOnboardingState,
  isAuthenticationSessionError,
  selectRole,
} from "../auth/auth-api";

type SelectableRole = "STUDENT" | "LANDLORD";

export function RoleOnboardingForm() {
  const router = useRouter();
  const [role, setRole] = useState<SelectableRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setReady(false);
    setError(null);

    getOnboardingState()
      .then((state) => {
        if (!active) return;
        if (
          state.stage !== "ROLE_SELECTION" &&
          state.stage !== "STUDENT_PROFILE"
        ) {
          router.replace(state.nextPath);
          return;
        }
        if (state.stage === "STUDENT_PROFILE") setRole("STUDENT");
        setReady(true);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (isAuthenticationSessionError(caught)) {
          router.replace("/login");
          return;
        }
        setError("មិនអាចពិនិត្យគណនីរបស់អ្នកបានទេ។ សូមព្យាយាមម្តងទៀត។");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadAttempt, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role) {
      setError("សូមជ្រើសរើសសិស្ស/និស្សិត ឬម្ចាស់ផ្ទះជួល ដើម្បីបន្ត។");
      return;
    }

    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);

    try {
      const state = await selectRole({
        role,
        ...(role === "STUDENT"
          ? { displayName: String(formData.get("displayName") ?? "") }
          : {}),
      });
      router.replace(state.nextPath);
    } catch (caught) {
      setError(
        caught instanceof AuthApiError
          ? caught.message
          : "សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត ហើយព្យាយាមម្តងទៀត។",
      );
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <div className="onboarding-loading" aria-busy="true" aria-live="polite">
        <p lang="km">កំពុងពិនិត្យគណនីរបស់អ្នក…</p>
        <div className="skeleton onboarding-choice-skeleton" />
        <div className="skeleton onboarding-choice-skeleton" />
      </div>
    );
  }

  if (error && !ready) {
    return (
      <div className="onboarding-error" role="alert">
        <h3 lang="km">មិនអាចពិនិត្យគណនីបានទេ</h3>
        <p>{error}</p>
        <button
          type="button"
          onClick={() => setLoadAttempt((value) => value + 1)}
        >
          ព្យាយាមម្តងទៀត
        </button>
      </div>
    );
  }

  return (
    <form className="auth-form onboarding-form" onSubmit={handleSubmit}>
      <fieldset className="role-options" disabled={pending}>
        <legend lang="km">សូមជ្រើសរើសតួនាទីមួយ</legend>
        <label className="role-option" data-selected={role === "STUDENT"}>
          <input
            type="radio"
            name="role"
            value="STUDENT"
            checked={role === "STUDENT"}
            onChange={() => setRole("STUDENT")}
          />
          <span>
            <strong lang="km">សិស្ស/និស្សិត</strong>
            <small lang="km">
              ស្វែងរកបន្ទប់នៅជិតសាលា ឬសាកលវិទ្យាល័យ ប្រៀបធៀប
              និងរក្សាទុកបន្ទប់ដែលអ្នកពេញចិត្ត។
            </small>
          </span>
        </label>
        <label className="role-option" data-selected={role === "LANDLORD"}>
          <input
            type="radio"
            name="role"
            value="LANDLORD"
            checked={role === "LANDLORD"}
            onChange={() => setRole("LANDLORD")}
          />
          <span>
            <strong lang="km">ម្ចាស់ផ្ទះជួល</strong>
            <small lang="km">
              ដាក់បន្ទប់ជួល កែប្រែព័ត៌មាន និងគ្រប់គ្រងបន្ទប់ទំនេរសម្រាប់សិស្ស
              និងនិស្សិត។
            </small>
          </span>
        </label>
      </fieldset>

      {role === "STUDENT" ? (
        <div className="form-field onboarding-profile-field">
          <label htmlFor="student-display-name" lang="km">
            ឈ្មោះដែលអ្នកចង់បង្ហាញ
          </label>
          <input
            id="student-display-name"
            name="displayName"
            type="text"
            autoComplete="name"
            minLength={2}
            maxLength={120}
            required
          />
          <p className="field-help" lang="km">
            ឈ្មោះនេះប្រើសម្រាប់គណនីឯកជនរបស់អ្នក
            ហើយមិនបង្ហាញជាមួយបន្ទប់ដែលអ្នកបានរក្សាទុកទេ។
          </p>
        </div>
      ) : null}

      {role === "LANDLORD" ? (
        <p className="trial-note" lang="km">
          ការសាកល្បងឥតគិតថ្លៃរយៈពេល 7 ថ្ងៃរបស់អ្នក
          ចាប់ផ្តើមតែបន្ទាប់ពីអ្នកបំពេញព័ត៌មានម្ចាស់ផ្ទះជួលនៅជំហានបន្ទាប់។
          មិនត្រូវការកាតបង់ប្រាក់ទេ។
        </p>
      ) : null}

      {error ? (
        <p className="form-message is-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="auth-submit" type="submit" disabled={pending || !role}>
        {pending
          ? "កំពុងរក្សាទុកជម្រើស…"
          : role === "LANDLORD"
            ? "បន្តជាម្ចាស់ផ្ទះជួល"
            : role === "STUDENT"
              ? "បន្តជាសិស្ស/និស្សិត"
              : "ជ្រើសរើសតួនាទីដើម្បីបន្ត"}
      </button>
      <p className="role-commitment" lang="km">
        ជម្រើសនេះកំណត់សិទ្ធិគណនីរបស់អ្នក
        ហើយមិនអាចប្តូរដោយខ្លួនឯងបន្ទាប់ពីបញ្ចប់បានទេ។
      </p>
    </form>
  );
}
