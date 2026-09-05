import type { GoogleMapsBrowserConfigResult } from "../../config/google-maps";

export type Map3DFallbackReason =
  | "MAPS_UNAVAILABLE"
  | "REDUCED_MOTION"
  | "DATA_SAVER"
  | "SLOW_CONNECTION"
  | "LOW_POWER"
  | "WEBGL_UNAVAILABLE";

export type Map3DCapability =
  | { status: "checking" }
  | { status: "enabled" }
  | { status: "fallback"; reason: Map3DFallbackReason };

export interface Map3DCapabilitySignals {
  mapsStatus: GoogleMapsBrowserConfigResult["status"];
  reducedMotion: boolean;
  saveData: boolean;
  effectiveType?: string;
  deviceMemoryGb?: number;
  hardwareConcurrency?: number;
  hardwareWebGL2: boolean;
}

const SLOW_CONNECTION_TYPES = new Set(["slow-2g", "2g", "3g"]);

export function resolveMap3DCapability(
  signals: Map3DCapabilitySignals,
): Map3DCapability {
  if (signals.mapsStatus !== "READY") {
    return { status: "fallback", reason: "MAPS_UNAVAILABLE" };
  }
  if (signals.reducedMotion) {
    return { status: "fallback", reason: "REDUCED_MOTION" };
  }
  if (signals.saveData) {
    return { status: "fallback", reason: "DATA_SAVER" };
  }
  if (
    signals.effectiveType &&
    SLOW_CONNECTION_TYPES.has(signals.effectiveType)
  ) {
    return { status: "fallback", reason: "SLOW_CONNECTION" };
  }
  if (
    (signals.deviceMemoryGb !== undefined && signals.deviceMemoryGb <= 2) ||
    (signals.hardwareConcurrency !== undefined &&
      signals.hardwareConcurrency <= 2)
  ) {
    return { status: "fallback", reason: "LOW_POWER" };
  }
  if (!signals.hardwareWebGL2) {
    return { status: "fallback", reason: "WEBGL_UNAVAILABLE" };
  }
  return { status: "enabled" };
}

export function map3DFallbackLabel(reason: Map3DFallbackReason): string {
  switch (reason) {
    case "REDUCED_MOTION":
      return "2D · reduced motion";
    case "DATA_SAVER":
      return "2D · data saver";
    case "SLOW_CONNECTION":
      return "2D · slower connection";
    case "LOW_POWER":
      return "2D · lighter mode";
    case "WEBGL_UNAVAILABLE":
      return "2D · device fallback";
    case "MAPS_UNAVAILABLE":
      return "2D preview";
  }
}

export function map3DFallbackMessage(reason: Map3DFallbackReason): string {
  switch (reason) {
    case "REDUCED_MOTION":
      return "Your reduced-motion preference is active, so the stable 2D preview is shown.";
    case "DATA_SAVER":
      return "Data saver is active, so the lighter 2D preview is shown.";
    case "SLOW_CONNECTION":
      return "The lighter 2D preview is shown for this connection.";
    case "LOW_POWER":
      return "The lighter 2D preview is shown for this device.";
    case "WEBGL_UNAVAILABLE":
      return "3D rendering is unavailable on this device. The 2D map remains usable.";
    case "MAPS_UNAVAILABLE":
      return "The 2D preview remains available without Google Maps.";
  }
}
