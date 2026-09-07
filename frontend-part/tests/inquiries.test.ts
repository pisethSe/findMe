import assert from "node:assert/strict";
import test from "node:test";
import {
  allowedInquiryStatuses,
  inquiryMessageError,
  inquiryStatusLabel,
} from "../src/features/inquiries/inquiry-model.ts";
import {
  isInquiryPage,
  isLandlordInquiry,
  isStudentInquiry,
} from "../src/features/inquiries/inquiries-api.ts";
import {
  safeStudentReturnPath,
  studentPostAuthPath,
} from "../src/features/auth/student-return-path.ts";

const row = {
  id: "770cb2d4-b6ea-4a08-818b-611b93414e8d",
  message: "បន្ទប់ទំនេរទេ? <script>text</script>",
  status: "NEW",
  createdAt: "2026-09-07T00:00:00Z",
  updatedAt: "2026-09-07T00:00:00Z",
  listing: {
    id: "4f981334-aed1-4f56-bc64-35c51c563906",
    slug: "room-near-school",
    titleEn: "Room near school",
    titleKm: null,
  },
};

test("inquiry validation preserves Khmer and text while rejecting malformed private responses", () => {
  assert.equal(isStudentInquiry(row), true);
  assert.equal(isStudentInquiry({ ...row, listing: null }), true);
  for (const change of [
    { id: "bad" },
    { message: "" },
    { status: "SENT" },
    { createdAt: "bad" },
    { listing: { ...row.listing, slug: "../admin" } },
  ])
    assert.equal(isStudentInquiry({ ...row, ...change }), false);
  const landlord = {
    ...row,
    student: { displayName: "Dara" },
    listing: { ...row.listing, propertyName: "RUPP Rooms" },
  };
  assert.equal(isLandlordInquiry(landlord), true);
  assert.equal(
    isLandlordInquiry({
      ...landlord,
      student: { email: "private@example.test" },
    }),
    false,
  );
  const page = {
    data: [row],
    meta: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
  };
  assert.equal(isInquiryPage(page, isStudentInquiry), true);
  assert.equal(isInquiryPage({ ...page, data: [] }, isStudentInquiry), false);
  assert.equal(
    isInquiryPage(
      { ...page, meta: { ...page.meta, totalPages: 3 } },
      isStudentInquiry,
    ),
    false,
  );
});

test("inquiry form limits and status actions express the server workflow", () => {
  assert.ok(inquiryMessageError(" \n\t"));
  assert.equal(inquiryMessageError("ក".repeat(2000)), null);
  assert.ok(inquiryMessageError("ក".repeat(2001)));
  assert.deepEqual(allowedInquiryStatuses("NEW"), [
    "READ",
    "RESPONDED",
    "CLOSED",
  ]);
  assert.deepEqual(allowedInquiryStatuses("READ"), ["RESPONDED", "CLOSED"]);
  assert.deepEqual(allowedInquiryStatuses("RESPONDED"), ["CLOSED"]);
  assert.deepEqual(allowedInquiryStatuses("CLOSED"), []);
  assert.equal(inquiryStatusLabel("RESPONDED"), "Marked replied");
  assert.equal(safeStudentReturnPath("/inquiries"), "/inquiries");
  assert.equal(studentPostAuthPath("/search", "/inquiries"), "/inquiries");
  assert.equal(studentPostAuthPath("/landlord", "/inquiries"), "/landlord");
});
