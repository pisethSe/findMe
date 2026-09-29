"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "./brand-mark";
import { LandingIcon, translate as t } from "./landing-icons";
import { useSitePreferences } from "../preferences/site-preferences";
import {
  getCurrentUser,
  peekAccount,
  signOut,
  type AuthUser,
} from "../auth/auth-api";
import styles from "./rentme.module.css";

export function SiteHeader() {
  const { locale, theme, setLocale, setTheme } = useSitePreferences();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuButton = useRef<HTMLButtonElement>(null);
  const locationDropdown = useRef<HTMLDetailsElement>(null);
  const profileDropdown = useRef<HTMLDetailsElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [account, setAccount] = useState<AuthUser | null>(() => peekAccount());
  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((user) => {
        if (active) setAccount(user);
      })
      .catch(() => {
        if (active) setAccount(null);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    function close(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (!headerRef.current?.contains(event.target)) setMobileMenuOpen(false);
      if (
        locationDropdown.current &&
        !locationDropdown.current.contains(event.target)
      )
        locationDropdown.current.open = false;
      if (
        profileDropdown.current &&
        !profileDropdown.current.contains(event.target)
      )
        profileDropdown.current.open = false;
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  function openDirectory() {
    setMobileMenuOpen(false);
    if (locationDropdown.current) locationDropdown.current.open = false;
    router.push("/universities");
  }
  async function handleSignOut() {
    if (profileDropdown.current) profileDropdown.current.open = false;
    setMobileMenuOpen(false);
    await signOut();
    setAccount(null);
    router.replace("/");
  }
  return (
    <header
      ref={headerRef}
      className={`${styles.header} ${styles.sharedHeader}`}
    >
      <BrandMark />
      <nav
        className={styles.navigation}
        id="landing-navigation"
        data-open={mobileMenuOpen}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setMobileMenuOpen(false);
            mobileMenuButton.current?.focus();
          }
        }}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a"))
            setMobileMenuOpen(false);
        }}
        aria-label={t(locale, "Main navigation", "ម៉ឺនុយមេ")}
      >
        <details
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") event.currentTarget.open = true;
          }}
          onPointerLeave={(event) => {
            if (
              event.pointerType === "mouse" &&
              !event.currentTarget.contains(document.activeElement)
            )
              event.currentTarget.open = false;
          }}
          className={styles.locationDropdown}
          ref={locationDropdown}
          onKeyDown={(event) => {
            if (event.key === "Escape" && locationDropdown.current) {
              locationDropdown.current.open = false;
              locationDropdown.current.querySelector("summary")?.focus();
            }
          }}
        >
          <summary>
            <LandingIcon name="pin" />
            {t(locale, "Location", "ទីតាំង")}
            <LandingIcon name="chevron" />
          </summary>
          <div className={styles.locationMenu}>
            <span>{t(locale, "START EXPLORING", "ចាប់ផ្ដើមស្វែងរក")}</span>
            <a
              href="/#find-room"
              onClick={() => {
                if (locationDropdown.current)
                  locationDropdown.current.open = false;
              }}
            >
              <strong>{t(locale, "Phnom Penh", "ភ្នំពេញ")}</strong>
              <small>
                {t(locale, "Rooms near your campus", "បន្ទប់នៅជិតសាលារបស់អ្នក")}
              </small>
            </a>
            <button type="button" onClick={openDirectory}>
              {t(
                locale,
                "All Cambodian universities",
                "សាកលវិទ្យាល័យទាំងអស់នៅកម្ពុជា",
              )}
              <LandingIcon name="arrow" />
            </button>
          </div>
        </details>
        <a className={styles.navCard} href="/#about">
          {t(locale, "About us", "អំពីយើង")}
        </a>
        <a className={styles.navCard} href="/#contact">
          {t(locale, "Contact", "ទំនាក់ទំនង")}
        </a>
        {account ? null : (
          <Link className={styles.mobileSignup} href="/register">
            {t(locale, "Sign up", "ចុះឈ្មោះ")}
          </Link>
        )}
      </nav>
      <div className={styles.headerActions}>
        <button
          className={styles.language}
          type="button"
          onClick={() => setLocale(locale === "en" ? "km" : "en")}
          aria-label={locale === "en" ? "Switch to Khmer" : "Switch to English"}
        >
          <LandingIcon name="globe" />
          <span>{locale === "en" ? "ខ្មែរ" : "EN"}</span>
        </button>
        <button
          className={styles.iconButton}
          type="button"
          aria-label={t(
            locale,
            theme === "light" ? "Switch to dark mode" : "Switch to light mode",
            theme === "light" ? "ប្ដូរទៅពណ៌ងងឹត" : "ប្ដូរទៅពណ៌ភ្លឺ",
          )}
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          <LandingIcon name={theme === "light" ? "moon" : "sun"} />
        </button>
        {account ? (
          <details
            className={styles.profileDropdown}
            ref={profileDropdown}
            onKeyDown={(event) => {
              if (event.key === "Escape" && profileDropdown.current) {
                profileDropdown.current.open = false;
                profileDropdown.current.querySelector("summary")?.focus();
              }
            }}
          >
            <summary
              className={styles.profileTrigger}
              data-testid="profile-trigger"
              aria-label={account.email ?? t(locale, "Account", "គណនី")}
            >
              <LandingIcon name="user" />
            </summary>
            <div
              className={styles.profileMenu}
              data-testid="profile-menu"
              onClick={(event) => {
                if (
                  event.target instanceof Element &&
                  event.target.closest("a") &&
                  profileDropdown.current
                )
                  profileDropdown.current.open = false;
              }}
            >
              <div className={styles.profileMenuHead}>
                <strong>{account.email ?? t(locale, "Account", "គណនី")}</strong>
                <small>
                  {account.role === "LANDLORD"
                    ? t(locale, "Landlord account", "គណនីម្ចាស់ផ្ទះជួល")
                    : account.role === "ADMIN"
                      ? t(locale, "Administrator account", "គណនីអ្នកគ្រប់គ្រង")
                      : t(locale, "Student account", "គណនីនិស្សិត")}
                </small>
              </div>
              {account.role === "LANDLORD" ? (
                <>
                  <Link href="/landlord">
                    {t(locale, "Dashboard", "ផ្ទាំងគ្រប់គ្រង")}
                  </Link>
                  <Link href="/landlord/listings">
                    {t(locale, "My listings", "បន្ទប់របស់ខ្ញុំ")}
                  </Link>
                  <Link href="/landlord/inquiries">
                    {t(locale, "Messages", "សារសួរ")}
                  </Link>
                </>
              ) : account.role === "ADMIN" ? (
                <Link href="/admin">
                  {t(locale, "Admin panel", "ផ្ទាំងអ្នកគ្រប់គ្រង")}
                </Link>
              ) : (
                <>
                  <Link href="/favorites">
                    {t(locale, "Saved rentals", "បន្ទប់ដែលរក្សាទុក")}
                  </Link>
                  <Link href="/inquiries">
                    {t(locale, "My inquiries", "សំណួររបស់ខ្ញុំ")}
                  </Link>
                </>
              )}
              <button type="button" onClick={() => void handleSignOut()}>
                {t(locale, "Sign out", "ចាក់ចេញ")}
              </button>
            </div>
          </details>
        ) : (
          <>
            <Link className={styles.signIn} href="/login">
              {t(locale, "Sign in", "ចូលគណនី")}
            </Link>
            <Link className={styles.signup} href="/register">
              {t(locale, "Sign up", "ចុះឈ្មោះ")}
            </Link>
          </>
        )}
        <button
          className={styles.menuButton}
          type="button"
          ref={mobileMenuButton}
          aria-label={t(locale, "Toggle navigation", "បើកឬបិទម៉ឺនុយ")}
          aria-expanded={mobileMenuOpen}
          aria-controls="landing-navigation"
          onClick={() => setMobileMenuOpen((value) => !value)}
        >
          <LandingIcon name={mobileMenuOpen ? "close" : "menu"} />
        </button>
      </div>
    </header>
  );
}
