"use client";

import { Localized } from "../preferences/translated-text";
import type { InstitutionDto } from "@findme/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  AuthApiError,
  getOnboardingState,
  isAuthenticationSessionError,
  selectRole,
} from "../auth/auth-api";

import { InstitutionPicker } from "../search/institution-picker";
import { studentDestination } from "../auth/student-return-path";

type SelectableRole = "STUDENT" | "LANDLORD";

/**
 * Campus search presets. These mirror the public search radius bounds so the
 * saved default always produces a URL the search page accepts.
 */
const CAMPUS_RADIUS_OPTIONS = [
  { value: "1000", label: "1 km" },
  { value: "2000", label: "2 km" },
  { value: "3000", label: "3 km" },
  { value: "5000", label: "5 km" },
  { value: "10000", label: "10 km" },
  { value: "20000", label: "20 km" },
] as const;

const DEFAULT_CAMPUS_RADIUS_METERS = 5_000;

export function RoleOnboardingForm() {
  const router = useRouter();
  const [role, setRole] = useState<SelectableRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [campus, setCampus] = useState<InstitutionDto | null>(null);
  const [campusValid, setCampusValid] = useState(false);
  const [campusRadius, setCampusRadius] = useState(
    String(DEFAULT_CAMPUS_RADIUS_METERS),
  );

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
          // A returning student is routed straight to their saved campus.
          router.replace(
            studentDestination(
              state,
              new URLSearchParams(window.location.search).get("next"),
            ),
          );
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

    // The campus is what makes the first search useful for a student moving
    // from another province, so it is required before the account is created.
    if (role === "STUDENT" && !campusValid) {
      setError("សូមជ្រើសរើសសាលវិទ្យា ឬសាកលវិទ្យាល័យរបស់អ្នក ដើម្បីបន្ត។");
      return;
    }

    setPending(true);
    const formData = new FormData(event.currentTarget);

    try {
      const state = await selectRole({
        role,
        ...(role === "STUDENT"
          ? {
              displayName: String(formData.get("displayName") ?? ""),
              ...(campus ? { institutionId: campus.id } : {}),
              preferredRadiusMeters: Number(campusRadius),
            }
          : {}),
      });
      router.replace(
        studentDestination(
          state,
          new URLSearchParams(window.location.search).get("next"),
        ),
      );
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
      <Localized>
        <div className="onboarding-loading" aria-busy="true" aria-live="polite">
          <p lang="km">កំពុងពិនិត្យគណនីរបស់អ្នក…</p>
          <div className="skeleton onboarding-choice-skeleton" />
          <div className="skeleton onboarding-choice-skeleton" />
        </div>
      </Localized>
    );
  }

  if (error && !ready) {
    return (
      <Localized>
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
      </Localized>
    );
  }

  return (
    <Localized>
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
          <div className="onboarding-campus-fields">
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

            <div className="form-field onboarding-campus-field">
              <InstitutionPicker
                id="student-campus"
                label="សាលវិទ្យា ឬ សាកលវិទ្យាល័យរបស់អ្នក"
                locale="km"
                selectedInstitution={campus}
                onSelect={setCampus}
                onSelectionValidityChange={setCampusValid}
                disabled={pending}
              />
              <p className="field-help" lang="km">
                យើងនឹងបង្ហាញបន្ទប់ជួលនៅជិតសាលវិទ្យានេះជាលក់ដំបូង។
                អ្នកអាចប្តូរសាលវិទ្យានៅពេលក្រោយ។
              </p>
            </div>

            <div className="form-field onboarding-campus-field">
              <label htmlFor="student-campus-radius" lang="km">
                ចម្ងាយស្វែងរកដែលត្រូវបាន
              </label>
              <select
                id="student-campus-radius"
                name="preferredRadiusMeters"
                value={campusRadius}
                disabled={pending}
                onChange={(event) => setCampusRadius(event.target.value)}
              >
                {CAMPUS_RADIUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="field-help" lang="km">
                អ្នកអាចប្តូរចម្ងាយនៅលើទំព័រស្វែងរកបាននៅពេលក្រោយ។
              </p>
            </div>
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

        <button
          className="auth-submit"
          type="submit"
          disabled={pending || !role || (role === "STUDENT" && !campusValid)}
        >
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
    </Localized>
  );
}
