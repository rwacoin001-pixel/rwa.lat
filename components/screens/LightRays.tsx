'use client'

/**
 * Light rays from the top edge (2026-11-02; the user picked the React Bits background studio as a reference, we chose its
 * "Light Rays" look and wrote it small). Raw WebGL 1, one fragment shader, no library.
 * Light by design: rendered at half resolution with the DPR capped at 1, at most 30 frames a second, paused when the tab is
 * hidden or the canvas is off screen. The container paints a static CSS glow first; the canvas fades in on its first frame.
 * No WebGL, a lost context or reduced motion → the static glow stays (reduced motion draws one still frame).
 */
import { useEffect, useRef, type CSSProperties } from 'react'
import s from './light-rays.module.css'

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
const FRAG = `precision mediump float;
uniform vec2 r;uniform float t;uniform vec3 c;uniform float k;
float ray(vec2 o,vec2 q,float a,float b,float v){vec2 d=q-o;float ca=dot(normalize(d),vec2(0.,1.));
float s=clamp(.45+.15*sin(ca*a+t*v)+.3+.2*cos(-ca*b+t*v),0.,1.);
float f=clamp((r.y*1.05-length(d))/(r.y*1.05),0.,1.);return s*f*f*smoothstep(.62,1.,ca);}
void main(){vec2 q=vec2(gl_FragCoord.x,r.y-gl_FragCoord.y);vec2 o=vec2(r.x*.5,-r.y*.18);
float v=(ray(o,q,36.2214,21.11349,.9)*.55+ray(o,q,22.3991,18.0234,.6)*.45)*k;
gl_FragColor=vec4(c*v,v);}`

export function LightRays({ color = [0.74, 0.96, 0.9], intensity = 0.9, className, style }: {
  color?: [number, number, number]; intensity?: number; className?: string; style?: CSSProperties
}) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const tint = color.join(',')
  useEffect(() => {
    const el = canvas.current, host = box.current
    if (!el || !host) return
    const gl = el.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })
    if (!gl || gl.isContextLost()) return
    const shader = (type: number, src: string) => { const sh = gl.createShader(type)!; gl.shaderSource(sh, src); gl.compileShader(sh); return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null }
    const vs = shader(gl.VERTEX_SHADER, VERT), fs = shader(gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't'), uC = gl.getUniformLocation(prog, 'c'), uK = gl.getUniformLocation(prog, 'k')
    const rgb = tint.split(',').map(Number)
    gl.uniform3f(uC, rgb[0], rgb[1], rgb[2]); gl.uniform1f(uK, intensity)

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0, last = 0, visible = true, shown = false
    const start = performance.now()
    const size = () => {
      const scale = 0.5 * Math.min(1, window.devicePixelRatio || 1)
      const w = Math.max(1, Math.round(host.clientWidth * scale)), h = Math.max(1, Math.round(host.clientHeight * scale))
      if (el.width !== w || el.height !== h) { el.width = w; el.height = h; gl.viewport(0, 0, w, h) }
      gl.uniform2f(uR, w, h)
    }
    const draw = (now: number) => {
      gl.uniform1f(uT, still ? 4 : (now - start) / 1000)
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!shown) { shown = true; el.dataset.ready = '' }
    }
    const loop = (now: number) => {
      frame = 0
      if (!visible || document.hidden) return
      if (now - last >= 33) { last = now; draw(now) }
      frame = requestAnimationFrame(loop)
    }
    const resume = () => { if (!frame && !still && visible && !document.hidden) frame = requestAnimationFrame(loop) }
    size()
    // First frame right away (also covers browsers that hold animation frames back), then the throttled loop.
    draw(performance.now())
    if (!still) resume()
    const ro = new ResizeObserver(() => { size(); if (still) draw(performance.now()) })
    ro.observe(host)
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; resume() })
    io.observe(host)
    const onVis = () => resume()
    document.addEventListener('visibilitychange', onVis)
    const onLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); frame = 0; delete el.dataset.ready }
    el.addEventListener('webglcontextlost', onLost)
    return () => {
      cancelAnimationFrame(frame); ro.disconnect(); io.disconnect()
      document.removeEventListener('visibilitychange', onVis); el.removeEventListener('webglcontextlost', onLost)
      // Free our objects but keep the context: a re-run (theme change, React strict mode) reuses the same canvas.
      gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs); gl.deleteBuffer(buffer)
    }
  }, [tint, intensity])
  return <div ref={box} className={`${s.rays}${className ? ` ${className}` : ''}`} style={{ '--ray': `rgb(${color.map(v => Math.round(v * 255)).join(' ')})`, ...style } as CSSProperties} aria-hidden="true">
    <canvas ref={canvas} className={s.canvas} />
  </div>
}
