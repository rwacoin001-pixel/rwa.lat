'use client'

import { useEffect, useRef } from 'react'

/**
 * Iridescence (2026-10-28): a slow, flowing colour field drawn by a small WebGL shader — adapted from the "Iridescence"
 * background on reactbits.dev (MIT), written against raw WebGL so it needs no library. Cheap on purpose: it draws at
 * half resolution, at most 30 frames a second, only while on screen and the tab is visible; with reduced motion, in the
 * Android app, or without WebGL it paints one still frame (or leaves the CSS fallback behind it).
 */
const VERT = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}'
const FRAG = `precision mediump float;
uniform float t;uniform vec2 r;uniform vec3 c;varying vec2 v;
void main(){
  float m=min(r.x,r.y);
  vec2 uv=(v*2.-1.)*r/m;
  float d=-t*.5,a=0.;
  for(float i=0.;i<8.;++i){a+=cos(i-d-a*uv.x);d+=sin(uv.y*i+a);}
  d+=t*.5;
  vec3 col=vec3(cos(uv*vec2(d,a))*.6+.4,cos(a+d)*.5+.5);
  col=cos(col*cos(vec3(d,a,2.5))*.5+.5)*c;
  gl_FragColor=vec4(col,1.);
}`

export function Iridescence({ color = [1, 1, 1], speed = 0.35, className }: { color?: [number, number, number]; speed?: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const gl = el.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!gl) return
    const shader = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s }
    const prog = gl.createProgram()!
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uT = gl.getUniformLocation(prog, 't'), uR = gl.getUniformLocation(prog, 'r'), uC = gl.getUniformLocation(prog, 'c')
    gl.uniform3f(uC, color[0], color[1], color[2])
    const size = () => { const w = Math.max(1, Math.round(el.clientWidth / 2)), h = Math.max(1, Math.round(el.clientHeight / 2)); if (el.width !== w || el.height !== h) { el.width = w; el.height = h; gl.viewport(0, 0, w, h) } gl.uniform2f(uR, w, h) }
    const draw = (time: number) => { size(); gl.uniform1f(uT, time * 0.001 * speed); gl.drawArrays(gl.TRIANGLES, 0, 3) }
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.shell === 'android'
    const start = 9000 // a pleasant moment of the loop for the still frame
    if (still) { draw(start); return }
    let frame = 0, last = 0, visible = true
    const loop = (now: number) => { frame = requestAnimationFrame(loop); if (!visible || document.hidden || now - last < 33) return; last = now; draw(start + now) }
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
    io.observe(el)
    frame = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(frame); io.disconnect() }
  }, [color[0], color[1], color[2], speed])
  return <canvas ref={canvas} className={className} aria-hidden="true" />
}
