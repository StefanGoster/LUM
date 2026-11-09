"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * A restrained adaptation of ThreeUI's MIT-licensed Dot Matrix shader.
 * Source: MengTo/threeui, 68802d5428071ada5c20db8094b1649e6bb770ed,
 * src/shaders/dot-matrix/dotMatrixShaders.ts.
 * Copyright (c) 2026 Meng To. Full notice: THIRD_PARTY_NOTICES.md.
 *
 * LUM changes: native WebGL (no Three.js dependency), a quiet red/stone palette,
 * fixed default frame, bounded resolution, reduced-motion and visibility support,
 * ascending smoothstep edges, and a CSS fallback. This is interface decoration;
 * it is never baked into exported artwork.
 */

const vertexSource = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragmentSource = `
precision mediump float;
uniform float uTime;
uniform vec2 uResolution;
uniform float uOpacity;
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;
  vec2 grid = fract(uv * 28.0);
  vec2 id = floor(uv * 28.0);
  float dist = length(grid - vec2(0.5));
  float pulse = sin(uTime * 0.24 + id.x * 0.05 + id.y * 0.05) * 0.5 + 0.5;
  float radius = 0.08 + pulse * 0.11;
  float alpha = 1.0 - smoothstep(radius - 0.04, radius, dist);
  vec2 center = vec2(0.5 * aspect, 0.5);
  float depthFade = 1.0 - smoothstep(0.1, 1.2, length(uv - center));
  vec3 color = mix(vec3(0.48, 0.45, 0.40), vec3(0.78, 0.24, 0.19), pulse * 0.5);
  gl_FragColor = vec4(color, alpha * depthFade * uOpacity);
}
`;

export interface AtmosphereProps {
  className?: string;
  style?: CSSProperties;
  /** Static by default. Animation is also disabled for reduced-motion users. */
  animate?: boolean;
  /** Keep small for a work surface. Values are clamped to 0–1. */
  intensity?: number;
}

export function Atmosphere({ className = "", style, animate = false, intensity = 0.24 }: AtmosphereProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, powerPreference: "low-power" });
    if (!gl) return;

    const shaders: WebGLShader[] = [];
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    const release = () => {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      shaders.forEach((shader) => gl.deleteShader(shader));
    };
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Shader unavailable");
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error("Shader compilation failed");
      }
      program = gl.createProgram();
      if (!program) throw new Error("Shader program unavailable");
      shaders.forEach((shader) => gl.attachShader(program!, shader));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Shader link failed");
      gl.useProgram(program);
      buffer = gl.createBuffer();
      if (!buffer) throw new Error("Shader buffer unavailable");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    } catch {
      release();
      return; // CSS underneath remains usable on restricted graphics devices.
    }

    const time = gl.getUniformLocation(program, "uTime");
    const resolution = gl.getUniformLocation(program, "uResolution");
    const opacity = gl.getUniformLocation(program, "uOpacity");
    gl.uniform1f(opacity, Math.min(1, Math.max(0, intensity)));
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let visible = true;
    let lost = false;
    const canAnimate = () => animate && !motion.matches && visible && !document.hidden && !lost;
    const paint = (now = 0) => {
      frame = 0;
      if (lost) return;
      gl.uniform1f(time, canAnimate() ? now * 0.001 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (canAnimate()) frame = requestAnimationFrame(paint);
    };
    const refresh = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (canAnimate()) frame = requestAnimationFrame(paint);
      else paint();
    };
    const resize = () => {
      const bounds = host.getBoundingClientRect();
      // This texture needs no high-DPI framebuffer and never exceeds 900px.
      const scale = Math.min(1, 900 / Math.max(1, bounds.width, bounds.height));
      canvas.width = Math.max(1, Math.round(bounds.width * scale));
      canvas.height = Math.max(1, Math.round(bounds.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      refresh();
    };
    const onLost = () => { lost = true; canvas.style.opacity = "0"; if (frame) cancelAnimationFrame(frame); };
    const observer = new ResizeObserver(resize);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? true; refresh(); });
    observer.observe(host);
    intersection.observe(host);
    motion.addEventListener("change", refresh);
    document.addEventListener("visibilitychange", refresh);
    canvas.addEventListener("webglcontextlost", onLost);
    resize();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      motion.removeEventListener("change", refresh);
      document.removeEventListener("visibilitychange", refresh);
      canvas.removeEventListener("webglcontextlost", onLost);
      release();
    };
  }, [animate, intensity]);

  return (
    <div ref={hostRef} className={className} aria-hidden="true" style={{
      position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none",
      background: "radial-gradient(ellipse at 65% 30%, rgba(191,65,51,.055), transparent 65%)", ...style,
    }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}
