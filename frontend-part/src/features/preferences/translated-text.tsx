"use client";

import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { useSitePreferences } from "./site-preferences";
import { translateMessage } from "./messages";

/** Translate UI copy only. URLs, IDs, form values and user data stay untouched. */
export function Localized({ children }: { children: ReactNode }) {
  const { locale } = useSitePreferences();
  function translateNode(node: ReactNode): ReactNode {
    if (typeof node === "string") return translateMessage(node, locale);
    if (!isValidElement<Record<string, unknown>>(node)) return node;
    const next: Record<string, unknown> = {};
    for (const name of [
      "aria-label",
      "aria-description",
      "placeholder",
      "title",
    ]) {
      if (typeof node.props[name] === "string")
        next[name] = translateMessage(node.props[name], locale);
    }
    if (node.props.children !== undefined)
      next.children = Array.isArray(node.props.children)
        ? Children.map(node.props.children as ReactNode, translateNode)
        : translateNode(node.props.children as ReactNode);
    if (
      node.props.lang &&
      (node.type === "main" ||
        (typeof node.props.children === "string" &&
          next.children !== node.props.children))
    )
      next.lang = locale;
    return cloneElement(node, next);
  }
  return <>{Children.map(children, translateNode)}</>;
}

export function T({ children }: { children: string }) {
  const { locale } = useSitePreferences();
  return <>{translateMessage(children, locale)}</>;
}
