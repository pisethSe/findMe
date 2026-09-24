-- Google sign-in maps an account to the stable Google subject claim instead of
-- to an email address that can change. Password sign-in stays available for the
-- same account, so this column is optional and unique only when present.
ALTER TABLE "users" ADD COLUMN "google_subject" VARCHAR(255);
CREATE UNIQUE INDEX "users_google_subject_key" ON "users"("google_subject");
