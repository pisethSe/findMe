-- Supports the ownership-scoped recent-inquiry feed without sorting all
-- inquiries for a landlord after filtering.
CREATE INDEX "inquiries_landlord_created_id_idx"
ON "inquiries" ("landlord_id", "created_at" DESC, "id" DESC);
