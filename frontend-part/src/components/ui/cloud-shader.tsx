"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import styles from "./cloud-shader.module.css";

/**
 * Animated cloud shader adapted from Aceternity UI "cloud-shader"
 * (https://ui.aceternity.com/components/cloud-shader, author Manu Arora),
 * ported to this product's CSS-module setup (no Tailwind on this frontend).
 *
 * Product additions on top of the original:
 * - `transparent` renders only the clouds with alpha so a photograph behind
 *   the canvas stays visible (used by the landing hero backdrop).
 * - `scale` shrinks or grows every cloud while keeping its layer band.
 * - Clouds lift into the upper sky band in transparent mode, and the drift
 *   freezes to a static frame for reduced-motion users.
 */
export type CloudShaderProps = {
  className?: string;
  children?: ReactNode;
  /** Animation speed multiplier. 1 = default drift. */
  speed?: number;
  /** Number of clouds (1-6). */
  count?: number;
  /** Cloud size multiplier. 1 = authored size, smaller values shrink clouds. */
  scale?: number;
  /** Render only clouds with alpha so the backdrop behind the canvas shows. */
  transparent?: boolean;
  /** Cloud tint color (hex or rgb string). */
  cloudColor?: string;
  /** Sky color at the top (hex or rgb string). */
  skyTopColor?: string;
  /** Sky color at the bottom (hex or rgb string). */
  skyBottomColor?: string;
};

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Original cloud shader for Aceternity UI.
// Each cloud is an asymmetric envelope (dome top, flat base) filled with
// domain-warped billow noise. A second density sample above the pixel
// approximates self-shadowing. Clouds drift horizontally and wrap around.
const FRAG = `
precision highp float;

varying vec2 v_uv;

uniform vec2 u_res;
uniform float u_time;
uniform float u_count;
uniform float u_scale;
uniform float u_transparent;
uniform vec3 u_cloud;
uniform vec3 u_skyTop;
uniform vec3 u_skyBottom;

const mat2 R = mat2(0.80, 0.60, -0.60, 0.80);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(41.31, 289.17))) * 26737.367);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * vnoise(p);
    p = R * p * 2.03 + 19.19;
    amp *= 0.5;
  }
  return sum;
}

// billow noise: sharp puffy ridges, like cauliflower cloud tops
float billow(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * (1.0 - abs(2.0 * vnoise(p) - 1.0));
    p = R * p * 2.11 + 13.37;
    amp *= 0.5;
  }
  return sum;
}

// raw density for one cloud at point p
float cloudDensity(vec2 p, vec2 c, vec2 r, float seed, float t) {
  vec2 q = p - c;

  // envelope: dome above the center, flat base below
  float ry = q.y > 0.0 ? r.y : r.y * 0.42;
  float env = 1.0 - length(vec2(q.x / r.x, q.y / ry));
  if (env < -0.35) return 0.0;

  // domain-warped billow detail, moves with the cloud, evolves slowly
  vec2 dp = q * (2.4 / r.x) + seed;
  dp += 0.6 * vec2(
    fbm(dp * 1.4 + t * 0.04),
    fbm(dp * 1.4 + 7.7 - t * 0.03)
  );
  float detail = billow(dp * 1.6);

  return env + (detail - 0.62) * 0.62;
}

// shades one cloud and composites it over the accumulated straight-alpha color
vec4 shadeCloud(vec4 acc, vec3 sky, vec2 p, vec2 c, vec2 r, float seed, float t, float dist) {
  float d = cloudDensity(p, c, r, seed, t);
  if (d < 0.02) return acc;

  // sample density toward the sun (straight up) for self-shadowing
  float dUp = cloudDensity(p + vec2(0.0, r.y * 0.55), c, r, seed, t);
  float occl = clamp((dUp - d) * 1.1 + d * 0.55, 0.0, 1.0);

  vec3 lit = u_cloud * 1.04;
  vec3 shadow = mix(u_cloud * 0.60, sky, 0.38);
  vec3 cloudCol = mix(lit, shadow, occl * 0.85);

  float alpha = smoothstep(0.02, 0.38, d);

  // silver lining on thin edges
  float rim = smoothstep(0.02, 0.14, d) * (1.0 - smoothstep(0.14, 0.40, d));
  cloudCol += rim * 0.10;

  // atmospheric perspective: far clouds fade into the sky
  cloudCol = mix(cloudCol, sky, dist * 0.35);
  alpha *= mix(1.0, 0.8, dist);

  // source-over compositing keeps the backdrop visible in transparent mode
  float outA = alpha + acc.a * (1.0 - alpha);
  vec3 outRgb = (cloudCol * alpha + acc.rgb * acc.a * (1.0 - alpha)) / max(outA, 0.00001);
  return vec4(outRgb, outA);
}

// one drifting cloud: horizontal wrap + gentle vertical bob
vec4 cloudPass(vec4 acc, vec3 sky, vec2 p, float aspect, float t,
               float spd, float phase, float y, vec2 r, float seed, float dist) {
  vec2 rs = r * u_scale;
  float cx = mix(-rs.x - 0.25, aspect + rs.x + 0.25, fract(t * spd + phase));
  // overlay mode lifts the layer bands into the open sky of the photograph
  float cy = u_transparent > 0.5 ? mix(0.42, 0.98, y) : y;
  cy += sin(t * 0.05 + phase * 6.2831) * 0.012;
  return shadeCloud(acc, sky, p, vec2(cx, cy), rs, seed, t, dist);
}

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(v_uv.x * aspect, v_uv.y);
  float t = u_time;

  vec3 sky = mix(u_skyBottom, u_skyTop, v_uv.y);
  vec4 acc = vec4(0.0);

  if (u_transparent < 0.5) {
    acc = vec4(sky, 1.0);

    // faint haze band near the horizon
    acc.rgb = mix(acc.rgb, u_skyBottom * 1.06, smoothstep(0.35, 0.0, v_uv.y) * 0.5);

    // soft sun glow, upper area
    vec2 sunPos = vec2(aspect * 0.78, 0.92);
    float sunDist = length(p - sunPos);
    acc.rgb += vec3(1.0, 0.95, 0.82) * exp(-sunDist * sunDist * 5.0) * 0.28;

    // thin cirrus streaks, stretched horizontally, high in the sky
    float cirrusBand = smoothstep(0.55, 0.8, v_uv.y) * (1.0 - smoothstep(0.9, 1.0, v_uv.y));
    if (cirrusBand > 0.01) {
      float streak = fbm(vec2(p.x * 1.6 - t * 0.006, p.y * 12.0));
      float wisp = smoothstep(0.52, 0.78, streak) * cirrusBand;
      acc.rgb = mix(acc.rgb, u_cloud * 0.98, wisp * 0.35);
    }
  }

  // far layer: small, high, slow
  if (u_count > 5.5) {
    acc = cloudPass(acc, sky, p, aspect, t, 0.006, 0.10, 0.84, vec2(0.20, 0.10), 43.7, 1.0);
  }
  if (u_count > 4.5) {
    acc = cloudPass(acc, sky, p, aspect, t, 0.008, 0.62, 0.73, vec2(0.24, 0.12), 71.3, 0.85);
  }

  // middle layer
  if (u_count > 3.5) {
    acc = cloudPass(acc, sky, p, aspect, t, 0.011, 0.33, 0.60, vec2(0.34, 0.16), 17.3, 0.55);
  }
  if (u_count > 2.5) {
    acc = cloudPass(acc, sky, p, aspect, t, 0.013, 0.80, 0.47, vec2(0.30, 0.15), 29.9, 0.45);
  }

  // near layer: big, low, fast
  if (u_count > 1.5) {
    acc = cloudPass(acc, sky, p, aspect, t, 0.016, 0.05, 0.35, vec2(0.46, 0.20), 91.1, 0.15);
  }
  acc = cloudPass(acc, sky, p, aspect, t, 0.020, 0.48, 0.20, vec2(0.56, 0.24), 57.2, 0.0);

  gl_FragColor = acc;
}
`;

function parseHex(color: string): [number, number, number] {
  const value = color.trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((ch) => ch + ch)
            .join("")
        : hex;
    const packed = Number.parseInt(full.slice(0, 6), 16);
    if (Number.isFinite(packed)) {
      return [
        ((packed >> 16) & 255) / 255,
        ((packed >> 8) & 255) / 255,
        (packed & 255) / 255,
      ];
    }
  }
  const rgb = value.match(/[\d.]+/g);
  if (rgb && rgb.length >= 3) {
    const channels = [Number(rgb[0]), Number(rgb[1]), Number(rgb[2])];
    if (channels.every((channel) => Number.isFinite(channel))) {
      const [r = 0.95, g = 0.95, b = 0.95] = channels;
      return [r / 255, g / 255, b / 255];
    }
  }
  return [0.95, 0.95, 0.95];
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function CloudShader({
  className,
  children,
  speed = 1,
  count = 6,
  scale = 1,
  transparent = false,
  cloudColor = "#fbf8f2",
  skyTopColor = "#3876ba",
  skyBottomColor = "#8cbfe8",
}: CloudShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef({
    speed,
    count,
    scale,
    transparent,
    cloudColor,
    skyTopColor,
    skyBottomColor,
  });

  paramsRef.current = {
    speed,
    count,
    scale,
    transparent,
    cloudColor,
    skyTopColor,
    skyBottomColor,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.bindAttribLocation(program, 0, "a_pos");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const loc = {
      res: gl.getUniformLocation(program, "u_res"),
      time: gl.getUniformLocation(program, "u_time"),
      count: gl.getUniformLocation(program, "u_count"),
      scale: gl.getUniformLocation(program, "u_scale"),
      transparent: gl.getUniformLocation(program, "u_transparent"),
      cloud: gl.getUniformLocation(program, "u_cloud"),
      skyTop: gl.getUniformLocation(program, "u_skyTop"),
      skyBottom: gl.getUniformLocation(program, "u_skyBottom"),
    };

    let frame = 0;
    let running = true;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const w = Math.max(1, Math.floor(width * dpr));
      const h = Math.max(1, Math.floor(height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(loc.res, w, h);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const start = performance.now();
    const draw = (now: number) => {
      if (!running) return;
      const p = paramsRef.current;
      const elapsed = reduceMotion ? 0 : ((now - start) / 1000) * p.speed;
      const cloud = parseHex(p.cloudColor);
      const skyTop = parseHex(p.skyTopColor);
      const skyBottom = parseHex(p.skyBottomColor);

      gl.uniform1f(loc.time, elapsed);
      gl.uniform1f(loc.count, Math.min(6, Math.max(1, p.count)));
      gl.uniform1f(loc.scale, Math.min(2.5, Math.max(0.2, p.scale)));
      gl.uniform1f(loc.transparent, p.transparent ? 1 : 0);
      gl.uniform3f(loc.cloud, cloud[0], cloud[1], cloud[2]);
      gl.uniform3f(loc.skyTop, skyTop[0], skyTop[1], skyTop[2]);
      gl.uniform3f(loc.skyBottom, skyBottom[0], skyBottom[1], skyBottom[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    };
  }, []);

  return (
    <div className={cn(styles.root, className)}>
      <canvas ref={canvasRef} className={styles.canvas} />
      {children ? <div className={styles.content}>{children}</div> : null}
    </div>
  );
}
