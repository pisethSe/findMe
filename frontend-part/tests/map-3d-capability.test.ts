import assert from "node:assert/strict";
import test from "node:test";

import {
  map3DFallbackLabel,
  resolveMap3DCapability,
} from "../src/lib/maps/map-3d-capability.ts";
import {
  map3DSceneRange,
  SEARCH_3D_MARKER_BUDGET,
} from "../src/lib/maps/map-3d-scene.ts";

const capableSignals = {
  mapsStatus: "READY" as const,
  reducedMotion: false,
  saveData: false,
  effectiveType: "4g",
  deviceMemoryGb: 8,
  hardwareConcurrency: 8,
  hardwareWebGL2: true,
};

test("enables 3D only when the configured browser is capable", () => {
  assert.deepEqual(resolveMap3DCapability(capableSignals), {
    status: "enabled",
  });
  assert.deepEqual(
    resolveMap3DCapability({ ...capableSignals, mapsStatus: "DISABLED" }),
    { status: "fallback", reason: "MAPS_UNAVAILABLE" },
  );
  assert.deepEqual(
    resolveMap3DCapability({ ...capableSignals, hardwareWebGL2: false }),
    { status: "fallback", reason: "WEBGL_UNAVAILABLE" },
  );
});

test("honors motion, connection, and low-power fallback signals", () => {
  assert.deepEqual(
    resolveMap3DCapability({ ...capableSignals, reducedMotion: true }),
    { status: "fallback", reason: "REDUCED_MOTION" },
  );
  assert.deepEqual(
    resolveMap3DCapability({ ...capableSignals, saveData: true }),
    { status: "fallback", reason: "DATA_SAVER" },
  );
  assert.deepEqual(
    resolveMap3DCapability({ ...capableSignals, effectiveType: "2g" }),
    { status: "fallback", reason: "SLOW_CONNECTION" },
  );
  assert.deepEqual(
    resolveMap3DCapability({ ...capableSignals, deviceMemoryGb: 2 }),
    { status: "fallback", reason: "LOW_POWER" },
  );
  assert.deepEqual(
    resolveMap3DCapability({ ...capableSignals, hardwareConcurrency: 2 }),
    { status: "fallback", reason: "LOW_POWER" },
  );
  assert.deepEqual(
    resolveMap3DCapability({ ...capableSignals, effectiveType: "3g" }),
    { status: "fallback", reason: "SLOW_CONNECTION" },
  );
  assert.equal(map3DFallbackLabel("REDUCED_MOTION"), "2D · reduced motion");
});

test("fits nearby rentals and an empty institution view without an extreme close-up", () => {
  const origin = { latitude: 11.5682, longitude: 104.8907 };
  const points = [
    { latitude: 11.5706, longitude: 104.8903 },
    { latitude: 11.579, longitude: 104.896 },
  ];
  assert.ok(map3DSceneRange(origin, points) >= 1_350);
  assert.equal(map3DSceneRange(origin, []), 1_350);
  assert.equal(SEARCH_3D_MARKER_BUDGET, 24);
});

test("3D frames distant results across the full supported radius on portrait phones", () => {
  const origin = { latitude: 11.5682, longitude: 104.8907 };
  const distantResults = [{ latitude: 11.7382, longitude: 104.8907 }];
  const desktopRange = map3DSceneRange(origin, distantResults, 1.5);
  const portraitRange = map3DSceneRange(origin, distantResults, 0.5);
  assert.ok(desktopRange > 20_000, "A 7.5km cap would crop this valid result");
  assert.ok(
    portraitRange > desktopRange,
    "Portrait needs a wider camera range",
  );
  assert.ok(Number.isFinite(map3DSceneRange(origin, distantResults, 0)));
});
