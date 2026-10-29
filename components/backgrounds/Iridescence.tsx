'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Iridescence (2026-10-28): a slow, flowing colour field drawn by a small WebGL shader — adapted from the "Iridescence"
 * background on reactbits.dev (MIT), written against raw WebGL so it needs no library. Cheap on purpose: it draws at
 * half resolution, at most 30 frames a second (20 in the Android app), only while on screen and the tab is visible; with
 * reduced motion it paints one still frame, redrawn when the band changes size. Without WebGL, or when the GPU takes the
 * context away, the canvas hides and the CSS gradient behind it shows.
 *
 * 2026-10-30: it used to paint a single still frame in the Android app and never again, so the band there showed
 * nothing moving, and after a resize or a lost GPU context nothing at all.
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
  const [epoch, setEpoch] = useState(0) // bumped when a lost WebGL context comes back, to set everything up again
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const gl = el.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: true })
    if (!gl) { el.style.visibility = 'hidden'; return }
    const shader = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s }
    const prog = gl.createProgram()!
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { el.style.visibility = 'hidden'; return }
    el.style.visibility = ''
    gl.useProgram(prog)
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uT = gl.getUniformLocation(prog, 't'), uR = gl.getUniformLocation(prog, 'r'), uC = gl.getUniformLocation(prog, 'c')
    gl.uniform3f(uC, color[0], color[1], color[2])
    const size = () => { const w = Math.max(1, Math.round(el.clientWidth / 2)), h = Math.max(1, Math.round(el.clientHeight / 2)); if (el.width !== w || el.height !== h) { el.width = w; el.height = h; gl.viewport(0, 0, w, h) } gl.uniform2f(uR, w, h) }
    const start = 9000 // a pleasant moment of the loop for the still frame
    let lost = false, shown = start
    const draw = (time: number) => { if (lost) return; shown = time; size(); gl.uniform1f(uT, time * 0.001 * speed); gl.drawArrays(gl.TRIANGLES, 0, 3) }
    const onLost = (event: Event) => { event.preventDefault(); lost = true; el.style.visibility = 'hidden' }
    const onRestored = () => setEpoch((n) => n + 1)
    el.addEventListener('webglcontextlost', onLost)
    el.addEventListener('webglcontextrestored', onRestored)
    const resize = new ResizeObserver(() => draw(shown))
    resize.observe(el)
    draw(start)
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const gap = document.documentElement.dataset.shell === 'android' ? 50 : 33
    let frame = 0, last = 0, visible = true
    const loop = (now: number) => { frame = requestAnimationFrame(loop); if (!visible || document.hidden || now - last < gap) return; last = now; draw(start + now) }
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
    if (!still) { io.observe(el); frame = requestAnimationFrame(loop) }
    return () => {
      cancelAnimationFrame(frame); io.disconnect(); resize.disconnect()
      el.removeEventListener('webglcontextlost', onLost); el.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [color[0], color[1], color[2], speed, epoch])
  return <canvas ref={canvas} className={className} aria-hidden="true" />
}
