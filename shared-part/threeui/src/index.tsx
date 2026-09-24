"use client";

import {
  RibbonFieldBackground,
  type RibbonFieldBackgroundProps,
} from "./shaders/ribbon-field/RibbonFieldBackground";

export type PredictiveArcCanvasProps = RibbonFieldBackgroundProps & {
  variant: "ribbon-field";
};

// The registered source exports RibbonFieldBackground. This compatibility
// entry point preserves the configured ThreeUI component API without editing it.
export function PredictiveArcCanvas({
  variant,
  ...props
}: PredictiveArcCanvasProps) {
  if (variant !== "ribbon-field") return null;
  return <RibbonFieldBackground {...props} />;
}
