-- Supports published inventory feed ordering after PostGIS eligibility filtering.
CREATE INDEX "listings_publication_feed_idx"
ON "listings" ("status", "published_at" DESC, "id");
