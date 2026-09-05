import assert from "node:assert/strict";
import test from "node:test";

import {
  createMap3DSession,
  MAP_3D_LOAD_TIMEOUT_MS,
} from "../src/lib/maps/map-3d-session.ts";

class MapStub extends EventTarget {
  stopped = false;
  removed = false;

  stopCameraAnimation() {
    this.stopped = true;
  }

  remove() {
    this.removed = true;
  }

  steady(isSteady: boolean) {
    this.dispatchEvent(
      Object.assign(new Event("gmp-steadychange"), { isSteady }),
    );
  }
}

test("3D waits for a true steady event and reveals only once", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let reveals = 0;
  let failures = 0;
  const session = createMap3DSession({
    onReady: () => reveals++,
    onUnavailable: () => failures++,
  });
  const map = new MapStub();
  session.attach(map);
  map.steady(false);
  assert.equal(reveals, 0);
  map.steady(true);
  map.steady(false);
  map.steady(true);
  context.mock.timers.tick(MAP_3D_LOAD_TIMEOUT_MS);
  assert.equal(reveals, 1);
  assert.equal(failures, 0);
  session.dispose();
});

test("the 3D deadline covers stalled library loading and rejects late maps", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let failures = 0;
  const session = createMap3DSession({
    onReady: () => assert.fail("A timed-out scene must not reveal"),
    onUnavailable: () => failures++,
  });
  context.mock.timers.tick(MAP_3D_LOAD_TIMEOUT_MS);
  assert.equal(failures, 1);
  assert.equal(session.isActive(), false);
  const lateMap = new MapStub();
  session.attach(lateMap);
  lateMap.steady(true);
  assert.equal(lateMap.removed, true);
  assert.equal(session.signal.aborted, true);
});

test("3D provider and GPU failures clean up even after the first render", () => {
  for (const event of ["gmp-error", "gmp-map-id-error", "webglcontextlost"]) {
    let failures = 0;
    const map = new MapStub();
    const session = createMap3DSession({
      onReady: () => {},
      onUnavailable: () => {
        assert.equal(
          map.removed,
          false,
          "Focus can be captured before removal",
        );
        failures++;
      },
    });
    session.attach(map);
    map.steady(true);
    map.dispatchEvent(new Event(event));
    map.dispatchEvent(new Event(event));
    assert.equal(failures, 1);
    assert.equal(map.stopped, true);
    assert.equal(map.removed, true);
  }
});

test("leaving 3D cancels loading, listeners, motion, and failure callbacks", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const session = createMap3DSession({
    onReady: () => assert.fail("Unmounted scene must not reveal"),
    onUnavailable: () => assert.fail("Unmounting is not an error"),
  });
  const map = new MapStub();
  session.attach(map);
  session.dispose();
  map.steady(true);
  map.dispatchEvent(new Event("gmp-error"));
  context.mock.timers.tick(MAP_3D_LOAD_TIMEOUT_MS);
  assert.equal(map.stopped, true);
  assert.equal(map.removed, true);
});

test("a marker setup failure returns to fallback instead of leaving loading stuck", () => {
  let failures = 0;
  const session = createMap3DSession({
    onReady: () => {
      throw new Error("Marker unavailable");
    },
    onUnavailable: () => failures++,
  });
  const map = new MapStub();
  session.attach(map);
  map.steady(true);
  assert.equal(failures, 1);
  assert.equal(map.removed, true);
});
