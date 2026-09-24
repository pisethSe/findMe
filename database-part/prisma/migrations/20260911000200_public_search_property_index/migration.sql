-- Spatial search starts with properties inside the institution radius/viewport.
-- Keep the existing full property_id index for ownership and non-public paths;
-- this smaller index avoids revisiting private or unavailable offers per pin.
CREATE INDEX "listings_public_search_property_idx"
ON "listings" ("property_id")
WHERE "status" = 'published'
  AND "deleted_at" IS NULL
  AND "available_units" > 0
  AND "published_at" IS NOT NULL
  AND "availability_confirmed_at" IS NOT NULL;
