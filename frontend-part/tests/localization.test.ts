import assert from "node:assert/strict";
import test from "node:test";
import { translateMessage } from "../src/features/preferences/messages.ts";

test("Khmer UI messages retain dynamic distances, names and non-UI values", () => {
  assert.equal(translateMessage("Sign in", "km"), "ចូលគណនី");
  assert.equal(translateMessage("  Email address ", "km"), " អាសយដ្ឋានអ៊ីមែល ");
  assert.equal(translateMessage("Within 5 km", "km"), "ក្នុងរង្វង់ 5 គម");
  assert.equal(translateMessage("0.8 km from RUPP", "km"), "0.8 គម ពី RUPP");
  assert.equal(
    translateMessage("student@example.com", "km"),
    "student@example.com",
  );
  assert.equal(translateMessage("$125.00", "km"), "$125.00");
  assert.equal(translateMessage("Sign in", "en"), "Sign in");
});
