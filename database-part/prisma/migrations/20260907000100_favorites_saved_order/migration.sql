-- Stable, student-scoped pagination of saved rentals.
CREATE INDEX "favorites_student_id_created_at_listing_id_idx"
ON "favorites" ("student_id", "created_at" DESC, "listing_id");
