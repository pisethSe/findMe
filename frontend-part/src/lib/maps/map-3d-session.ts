export const MAP_3D_LOAD_TIMEOUT_MS = 15_000;

interface Map3DSessionElement extends EventTarget {
  stopCameraAnimation(): void;
  remove(): void;
}

/** Owns the entire library-load/render deadline and one map's lifetime. */
export function createMap3DSession(callbacks: {
  onReady: () => void;
  onUnavailable: () => void;
}) {
  const events = new AbortController();
  let active = true;
  let ready = false;
  let map: Map3DSessionElement | null = null;
  const timeout = setTimeout(fail, MAP_3D_LOAD_TIMEOUT_MS);

  function dispose() {
    active = false;
    clearTimeout(timeout);
    events.abort();
    const previousMap = map;
    map = null;
    if (previousMap) {
      try {
        previousMap.stopCameraAnimation();
      } finally {
        previousMap.remove();
      }
    }
  }

  function fail() {
    if (!active) return;
    active = false;
    // Let the owner capture focus before removing the failed map.
    try {
      callbacks.onUnavailable();
    } finally {
      dispose();
    }
  }

  return {
    signal: events.signal,
    isActive: () => active,
    fail,
    dispose,
    attach(element: Map3DSessionElement) {
      if (!active) {
        element.remove();
        return;
      }
      map = element;
      for (const name of [
        "gmp-error",
        "gmp-map-id-error",
        "webglcontextlost",
      ]) {
        element.addEventListener(name, fail, { signal: events.signal });
      }
      element.addEventListener(
        "gmp-steadychange",
        (event) => {
          if (
            !active ||
            ready ||
            !("isSteady" in event) ||
            event.isSteady !== true
          ) {
            return;
          }
          ready = true;
          clearTimeout(timeout);
          try {
            callbacks.onReady();
          } catch {
            fail();
          }
        },
        { signal: events.signal },
      );
    },
  };
}
