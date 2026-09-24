"use client";

import { Localized } from "../preferences/translated-text";
import Link from "next/link";
import styles from "./admin-safety.module.css";
export function AdminNavigation() {
  return (
    <Localized>
      <nav className={styles.navigation} aria-label="Administration">
        <Link href="/admin">Pending rentals</Link>
        <Link href="/admin/listings">All rentals</Link>
        <Link href="/admin/reports">Reports</Link>
        <Link href="/admin/users">Users</Link>
        <Link href="/admin/institutions">Institutions</Link>
        <Link href="/admin/amenities">Amenities</Link>
      </nav>
    </Localized>
  );
}
