import Link from "next/link";

import { BrandMark } from "../features/landing/brand-mark";
import { PhraseLoop } from "../features/landing/phrase-loop";
import { RentalMapPreview } from "../features/landing/rental-map-preview";
import { InstitutionStartForm } from "../features/search/institution-start-form";

export default function HomePage() {
  return (
    <main>
      <header className="site-header">
        <BrandMark />
        <nav aria-label="Main navigation">
          <Link href="#how-it-works">How it works</Link>
          <Link href="/login">Sign in</Link>
          <Link
            className="nav-action"
            href="/search?institution=royal-university-of-phnom-penh"
          >
            Browse rentals
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="hero-context">Rooms near Phnom Penh universities</p>
          <h1 lang="km">ស្វែងរកបន្ទប់ជួលដែលអ្នកពេញចិត្ត​ និងនៅជិតអ្នកបំផុត.</h1>
          <p className="hero-summary" lang="en">
            Choose your university, compare monthly rent and distance, then
            contact the landlord when a room fits.
          </p>
          <PhraseLoop />

          <InstitutionStartForm />
          <p className="demo-note">
            Search active Phnom Penh institutions by Khmer or English name.
          </p>
        </div>

        <RentalMapPreview />
      </section>

      <section className="how-it-works" id="how-it-works">
        <div>
          <h2>Start with where you study.</h2>
          <p>
            FindMe keeps the search practical: pick an institution, set your
            budget, and compare rooms close enough for daily travel.
          </p>
        </div>
        <ol>
          <li>
            <span>1</span>
            <div>
              <strong>Choose a university</strong>
              <p>Use your campus as the center of the search.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Compare useful details</strong>
              <p>See monthly price, distance, amenities, and freshness.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Ask before you travel</strong>
              <p>Save a room or send an inquiry once the listing is live.</p>
            </div>
          </li>
        </ol>
      </section>

      <footer>
        <BrandMark />
        <p>Student rental discovery for Phnom Penh.</p>
      </footer>
    </main>
  );
}
