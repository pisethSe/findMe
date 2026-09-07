"use client";

import type { PublicListingDetailDto } from "@findme/contracts";
import Image from "next/image";
import { useState } from "react";

export function RentalGallery({
  images,
  title,
}: {
  images: PublicListingDetailDto["images"];
  title: string;
}) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const current = images[selected];
  return (
    <section className="rental-gallery" aria-label="Rental photos">
      <div className="rental-gallery-photo">
        {current && !failed.has(current.id) ? (
          <Image
            key={current.id}
            src={current.publicUrl}
            alt={
              current.altTextEn ??
              current.altTextKm ??
              `${title}, photo ${selected + 1}`
            }
            fill
            sizes="(max-width: 800px) 100vw, 760px"
            onError={() =>
              setFailed((previous) => new Set([...previous, current.id]))
            }
          />
        ) : (
          <div className="rental-photo-recovery">
            <p role="status">
              {current
                ? `This photo could not load. Retry it${images.length > 1 ? " or choose another photo" : ""}.`
                : "No photos available for this rental."}
            </p>
            {current ? (
              <button
                type="button"
                onClick={() =>
                  setFailed((previous) => {
                    const next = new Set(previous);
                    next.delete(current.id);
                    return next;
                  })
                }
              >
                Retry photo
              </button>
            ) : null}
          </div>
        )}
      </div>
      {images.length > 0 ? (
        <div className="rental-gallery-controls">
          <p aria-live="polite">
            Photo {selected + 1} of {images.length}
          </p>
          {images.length > 1 ? (
            <div role="group" aria-label="Choose a rental photo">
              <button
                type="button"
                disabled={selected === 0}
                onClick={() => setSelected((value) => value - 1)}
              >
                Previous photo
              </button>
              <button
                type="button"
                disabled={selected === images.length - 1}
                onClick={() => setSelected((value) => value + 1)}
              >
                Next photo
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
