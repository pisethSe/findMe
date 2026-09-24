# Registered ThreeUI Ribbon Field source

Fetched from https://threeui.com/source-code/ribbon-field.json on 2026-09-17.
Requested bundle revision: `fa86582fc870`.

The files below are preserved byte-for-byte. Do not format, refactor, or replace them with approximations.

| Registered file                                      | SHA-256                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `src/shaders/ribbon-field/RibbonFieldBackground.tsx` | `fab02cb57c44c7307afd29cd03d01141372ad90163632b9a6a77910a245a5996` |
| `src/shaders/ribbon-field/ribbonFieldShaders.ts`     | `ab578acab44bbff7f3cf67f1c82b3e2e1d03689de3fcbdc23681e8b5a0a3536c` |
| `src/shaders/threeui.css`                            | `efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf` |

`src/index.tsx` is a project-owned compatibility export. The registered bundle names its component `RibbonFieldBackground`; the wrapper exposes the requested `PredictiveArcCanvas` API with `variant="ribbon-field"`. This is a private local workspace package, not an independently downloaded or published npm release.

The registered component uses React and raw WebGL. The broader ThreeUI runtime description mentions Canvas 2D and Three.js r128, but these three registered files do not import Three.js or need a Three.js dependency.

The shared stylesheet references `./fonts/fragment-mono.woff2`. This asset was fetched from https://threeui.com/fonts/fragment-mono.woff2 and stored at the unchanged relative path. Ribbon Field itself does not use that font; the site's Khmer typography remains Kantumruy Pro.

The landing wrapper controls mounting for reduced motion, pause, and document visibility. Shader code, uniforms, timing, pointer smoothing, and authored styles stay intact. Following the user's white-background revision, the effect is used in dark mode only. A missing WebGL context or shader failure leaves the page usable with its stable plain background.

`frontend-part/tests/threeui-source.test.ts` verifies all three registered hashes. Prettier ignores only the registered shader directory to preserve the source bytes.
