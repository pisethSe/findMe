import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("registered Ribbon Field source remains byte-for-byte identical to the supplied revision", async () => {
  const expected = {
    "ribbon-field/RibbonFieldBackground.tsx":
      "fab02cb57c44c7307afd29cd03d01141372ad90163632b9a6a77910a245a5996",
    "ribbon-field/ribbonFieldShaders.ts":
      "ab578acab44bbff7f3cf67f1c82b3e2e1d03689de3fcbdc23681e8b5a0a3536c",
    "threeui.css":
      "efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf",
  };
  for (const [file, hash] of Object.entries(expected)) {
    const bytes = await readFile(
      new URL(`../../shared-part/threeui/src/shaders/${file}`, import.meta.url),
    );
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hash, file);
  }
});
