import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { RentalDetail } from "../../../features/rentals/rental-detail";
import { getRentalDetail } from "../../../features/rentals/rental-detail-api";
import {
  rentalCanonicalUrl,
  rentalMoney,
  rentalTitle,
  searchReturnHref,
} from "../../../features/rentals/rental-detail-model";
import { findInstitutionBySlug } from "../../../features/search/search-api";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const loadRental = cache(
  async (slug: string, institutionSlug: string | undefined) => {
    const validInstitution =
      institutionSlug &&
      institutionSlug.length <= 160 &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(institutionSlug);
    const institution = validInstitution
      ? await findInstitutionBySlug(
          institutionSlug,
          AbortSignal.timeout(10_000),
        )
      : null;
    return {
      rental: await getRentalDetail(slug, institution?.id),
      missingInstitution: Boolean(institutionSlug && !institution),
    };
  },
);

async function pageData(props: Props) {
  const [{ slug }, query] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const result = await loadRental(
    slug,
    typeof query.institution === "string" ? query.institution : undefined,
  );
  return { ...result, backHref: searchReturnHref(query.returnTo) };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { rental } = await pageData(props);
  if (!rental)
    return {
      title: "Rental unavailable",
      robots: { index: false, follow: false },
    };
  const title = rentalTitle(rental);
  const description =
    `${rentalMoney(rental.monthlyPrice, rental.currency)} per month in ${rental.location.city}. ${rental.descriptionEn ?? rental.descriptionKm ?? "View photos, amenities, availability, and rental details."}`
      .replace(/\s+/g, " ")
      .slice(0, 160);
  const canonical = rentalCanonicalUrl(rental.slug, process.env.SITE_URL);
  const images = rental.images[0]
    ? [
        {
          url: rental.images[0].publicUrl,
          alt:
            rental.images[0].altTextEn ?? rental.images[0].altTextKm ?? title,
        },
      ]
    : [];
  return {
    title,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      title: `${title} | FindMe`,
      description,
      type: "website",
      ...(canonical ? { url: canonical } : {}),
      images,
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      title: `${title} | FindMe`,
      description,
      images,
    },
  };
}

export default async function RentalPage(props: Props) {
  const { rental, backHref, missingInstitution } = await pageData(props);
  if (!rental) notFound();
  return (
    <RentalDetail
      rental={rental}
      backHref={backHref}
      missingInstitution={missingInstitution}
    />
  );
}
