"use client";

import { useEffect, useState } from "react";

import type { GoogleMapsBrowserConfigResult } from "../../config/google-maps";
import {
  type Map3DCapability,
  resolveMap3DCapability,
} from "./map-3d-capability";

interface BrowserConnection extends EventTarget {
  effectiveType?: string;
  saveData?: boolean;
}

interface CapacityAwareNavigator extends Navigator {
  connection?: BrowserConnection;
  deviceMemory?: number;
}

let hardwareWebGL2Support: boolean | undefined;

export function useMap3DCapability(
  mapsStatus: GoogleMapsBrowserConfigResult["status"],
): Map3DCapability {
  const [capability, setCapability] = useState<Map3DCapability>({
    status: "checking",
  });

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dataQuery = window.matchMedia("(prefers-reduced-data: reduce)");
    const browserNavigator = navigator as CapacityAwareNavigator;
    const connection = browserNavigator.connection;

    const evaluate = () => {
      const signals = {
        mapsStatus,
        reducedMotion: motionQuery.matches,
        saveData: Boolean(connection?.saveData || dataQuery.matches),
        ...(connection?.effectiveType
          ? { effectiveType: connection.effectiveType }
          : {}),
        ...(browserNavigator.deviceMemory !== undefined
          ? { deviceMemoryGb: browserNavigator.deviceMemory }
          : {}),
        ...(navigator.hardwareConcurrency > 0
          ? { hardwareConcurrency: navigator.hardwareConcurrency }
          : {}),
      };
      const preliminary = resolveMap3DCapability({
        ...signals,
        hardwareWebGL2: true,
      });
      setCapability(
        preliminary.status === "fallback"
          ? preliminary
          : resolveMap3DCapability({
              ...signals,
              hardwareWebGL2: supportsHardwareWebGL2(),
            }),
      );
    };

    evaluate();
    motionQuery.addEventListener("change", evaluate);
    dataQuery.addEventListener("change", evaluate);
    connection?.addEventListener("change", evaluate);
    return () => {
      motionQuery.removeEventListener("change", evaluate);
      dataQuery.removeEventListener("change", evaluate);
      connection?.removeEventListener("change", evaluate);
    };
  }, [mapsStatus]);

  return capability;
}

function supportsHardwareWebGL2(): boolean {
  if (hardwareWebGL2Support !== undefined) return hardwareWebGL2Support;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", {
      failIfMajorPerformanceCaveat: true,
    });
    hardwareWebGL2Support = context !== null;
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    hardwareWebGL2Support = false;
  }
  return hardwareWebGL2Support;
}
