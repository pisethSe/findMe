import assert from "node:assert/strict";
import test from "node:test";

import { CAMPUS_SEARCH_PHRASES } from "../src/features/search/campus-running-phrases.ts";
import { translateMessage } from "../src/features/preferences/messages.ts";

test("running campus examples carry both languages in every locale", () => {
  assert.ok(CAMPUS_SEARCH_PHRASES.length > 1);
  for (const phrase of CAMPUS_SEARCH_PHRASES) {
    assert.ok(phrase.km.trim().length > 0);
    assert.ok(phrase.en.trim().length > 0);
    assert.notEqual(phrase.km, phrase.en);
    // The field renders a Khmer line and an English line at the same time, so
    // the shared translation layer must never rewrite either line.
    assert.equal(translateMessage(phrase.km, "km"), phrase.km);
    assert.equal(translateMessage(phrase.km, "en"), phrase.km);
    assert.equal(translateMessage(phrase.en, "km"), phrase.en);
    assert.equal(translateMessage(phrase.en, "en"), phrase.en);
  }
});
