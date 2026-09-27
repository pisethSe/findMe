import Script from "next/script";

/**
 * Marker attributes that browser extensions stamp onto the DOM before React
 * hydrates. `bis_skin_checked` and `bis_register` come from Bitdefender-class
 * web protection, `__processed_<uuid>__` from privacy and wallet add-ons, and
 * the remaining names are long-standing offenders (Grammarly, ColorZilla,
 * LanguageTool).
 */
const EXTENSION_MARKER_ATTRIBUTES = [
  "bis_skin_checked",
  "bis_register",
  "cz-shortcut-listen",
  "data-gr-ext-installed",
  "data-new-gr-c-s-check-loaded",
  "data-lt-installed",
] as const;

const EXTENSION_MARKER_PATTERN = "^__processed_[0-9a-fA-F-]{36}__$";

/**
 * React hydrates by comparing the markup the browser received with the tree it
 * renders on the client. Attributes added by an extension are absent from that
 * tree, React cannot remove them, and it reports a mismatch that no product
 * code caused. Clearing those markers while the document is still parsed keeps
 * the comparison clean.
 *
 * The guard runs before any Next.js code, clears markers as elements and
 * attributes appear, and disconnects shortly after the page finishes loading,
 * so it never races React's own DOM writes. It only removes attributes that no
 * product code reads, so it cannot delete application state.
 */
function buildGuardSource(): string {
  return `(function () {
  var names = ${JSON.stringify(EXTENSION_MARKER_ATTRIBUTES)};
  var pattern = new RegExp(${JSON.stringify(EXTENSION_MARKER_PATTERN)});
  var root = document.documentElement;
  if (!root || typeof MutationObserver !== "function") return;

  function isMarker(name) {
    return names.indexOf(name) !== -1 || pattern.test(name);
  }

  function clear(element) {
    if (!element || element.nodeType !== 1 || !element.attributes) return;
    for (var index = element.attributes.length - 1; index >= 0; index -= 1) {
      var name = element.attributes[index].name;
      if (isMarker(name)) element.removeAttribute(name);
    }
  }

  function sweep(node) {
    if (!node || node.nodeType !== 1) return;
    clear(node);
    var descendants = node.querySelectorAll("*");
    for (var index = 0; index < descendants.length; index += 1) {
      clear(descendants[index]);
    }
  }

  sweep(root);

  var observer = new MutationObserver(function (records) {
    for (var index = 0; index < records.length; index += 1) {
      var record = records[index];
      if (record.type === "attributes") {
        clear(record.target);
        continue;
      }
      for (var added = 0; added < record.addedNodes.length; added += 1) {
        sweep(record.addedNodes[added]);
      }
    }
  });

  observer.observe(root, { subtree: true, childList: true, attributes: true });

  function release() {
    sweep(root);
    observer.disconnect();
  }

  document.addEventListener("DOMContentLoaded", function () { sweep(root); }, { once: true });
  if (document.readyState === "complete") {
    window.setTimeout(release, 0);
  } else {
    window.addEventListener("load", function () { window.setTimeout(release, 1500); }, { once: true });
  }
})();`;
}

const GUARD_SOURCE = buildGuardSource();

/**
 * Development-only safeguard against extension-caused React hydration reports.
 *
 * React reports attribute-only hydration mismatches in its development build
 * only: the "This won't be patched up" message ships in
 * `react-dom-client.development.js` and is absent from the production bundle.
 * Skipping the guard in production therefore changes nothing for real
 * visitors, and leaves their extensions untouched.
 */
export function ExtensionHydrationGuard() {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <Script id="extension-hydration-guard" strategy="beforeInteractive">
      {GUARD_SOURCE}
    </Script>
  );
}
