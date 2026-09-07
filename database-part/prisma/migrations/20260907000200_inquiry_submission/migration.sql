-- Legacy inquiries keep a null key. New API submissions use a durable UUID
-- unique within the sending student's account, including after Redis resets.
ALTER TABLE "inquiries" ADD COLUMN "client_request_id" UUID;
CREATE UNIQUE INDEX "inquiries_student_request_key"
ON "inquiries" ("student_id", "client_request_id");

-- Supports private sent-history pagination and the rolling submission limit.
CREATE INDEX "inquiries_student_created_id_idx"
ON "inquiries" ("student_id", "created_at" DESC, "id" DESC);
