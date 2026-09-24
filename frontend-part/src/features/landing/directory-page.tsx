"use client";
import Link from "next/link";
import { SiteHeader } from "./site-header";
import { UniversityDirectory } from "./landing-controls";
import { useSitePreferences } from "../preferences/site-preferences";
import { translate as t } from "./landing-icons";
import styles from "./rentme.module.css";

export function DirectoryPage() {
  const { locale, theme } = useSitePreferences();
  return (
    <div className={styles.page} data-theme={theme} lang={locale}>
      <SiteHeader />
      <main className={styles.directoryPage}>
        <Link className={styles.textButton} href="/">
          {t(locale, "Back to home", "ត្រឡប់ទៅទំព័រដើម")}
        </Link>
        <h1>
          {t(locale, "Find your university.", "ស្វែងរកសាកលវិទ្យាល័យរបស់អ្នក។")}
        </h1>
        <p>
          {t(
            locale,
            "Your next chapter starts with your campus. Explore universities across Cambodia, then find rooms near active campuses in Phnom Penh.",
            "ជំហានបន្ទាប់ចាប់ផ្ដើមពីសាលារបស់អ្នក។ មើលសាកលវិទ្យាល័យទូទាំងកម្ពុជា និងស្វែងរកបន្ទប់ជិតសាលានៅភ្នំពេញ។",
          )}
        </p>
        <UniversityDirectory locale={locale} standalone />
        <Link className={styles.primaryButton} href="/search">
          {t(locale, "Explore available rooms", "មើលបន្ទប់ទំនេរ")}
        </Link>
      </main>
    </div>
  );
}
