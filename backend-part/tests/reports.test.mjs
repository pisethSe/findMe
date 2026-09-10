import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateReportDto } from "../dist/modules/reports/reports.dto.js";
import { ReportsService } from "../dist/modules/reports/reports.service.js";

test("reports validate reason, trim details and reject untrusted moderation fields", async () => {
  for (const reason of [
    "INACCURATE",
    "UNAVAILABLE",
    "SCAM_SUSPICIOUS",
    "DUPLICATE",
    "INAPPROPRIATE",
    "OTHER",
  ]) {
    const dto = plainToInstance(CreateReportDto, {
      reason,
      details: "  Khmer បន្ទប់  ",
    });
    assert.equal((await validate(dto)).length, 0);
    assert.equal(dto.details, "Khmer បន្ទប់");
  }
  for (const input of [
    { reason: "BAD" },
    { reason: "OTHER", details: null },
    { reason: "OTHER", details: "a".repeat(2001) },
    { reason: "OTHER", reporterId: "fake" },
  ])
    assert.ok(
      (
        await validate(plainToInstance(CreateReportDto, input), {
          whitelist: true,
          forbidNonWhitelisted: true,
        })
      ).length,
    );
});
test("report receipt never leaks reporter, details or internal moderation", async () => {
  const service = new ReportsService({
    create: async (...args) => {
      assert.deepEqual(args, ["account", "listing", { reason: "OTHER" }]);
      return {
        id: "receipt",
        reporterId: "secret",
        details: "private",
        resolutionNote: "internal",
      };
    },
  });
  assert.deepEqual(
    await service.create("account", "listing", { reason: "OTHER" }),
    { data: { id: "receipt", received: true } },
  );
});
