"use client";

import { Localized } from "../preferences/translated-text";
import type { ReactNode } from "react";
import { SiteHeader } from "../landing/site-header";
import { useSitePreferences } from "../preferences/site-preferences";
import { translate as t } from "../landing/landing-icons";
import styles from "../landing/rentme.module.css";
import { T } from "../preferences/translated-text";

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
  const { locale, theme } = useSitePreferences();
  return (
    <Localized>
      <div className={styles.page} data-theme={theme} lang={locale}>
        <SiteHeader />
        <main className="auth-page">
          <div className="auth-layout">
            <section
              className="auth-context"
              aria-labelledby="auth-context-title"
            >
              <h1 id="auth-context-title">
                {t(
                  locale,
                  "A place near campus. A little more time for you.",
                  "កន្លែងនៅជិតសាលា។ ពេលវេលាច្រើនជាងមុនសម្រាប់អ្នក។",
                )}
              </h1>
              <p>
                <T>{description}</T>
              </p>
              <dl className="auth-trust-list">
                <div>
                  <dt>
                    {t(
                      locale,
                      "Your search, saved",
                      "រក្សាទុកការស្វែងរករបស់អ្នក",
                    )}
                  </dt>
                  <dd>
                    {t(
                      locale,
                      "Keep your favourite rooms together and contact landlords when you’re ready.",
                      "រក្សាទុកបន្ទប់ដែលអ្នកពេញចិត្ត ហើយទាក់ទងម្ចាស់ផ្ទះពេលអ្នករួចរាល់។",
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t(locale, "Private by default", "រក្សាភាពឯកជន")}</dt>
                  <dd>
                    {t(
                      locale,
                      "Your saved rooms and inquiries are not public.",
                      "បន្ទប់ដែលអ្នករក្សាទុក និងសំណួររបស់អ្នកមិនត្រូវបានបង្ហាញជាសាធារណៈទេ។",
                    )}
                  </dd>
                </div>
              </dl>
            </section>
            <section
              className="auth-form-region"
              aria-labelledby="auth-form-title"
            >
              <div className="auth-form-heading">
                <h2 id="auth-form-title">
                  {t(locale, title, titleKm.replace("FindMe", "rentMe"))}
                </h2>
              </div>
              {children}
            </section>
          </div>
        </main>
      </div>
    </Localized>
  );
}
