'use client'
/**
 * The first-run guide's live 3D layer (palette A preview), built on the open-source pmndrs stack
 * (@react-three/fiber + drei): a studio of large Lightformer softboxes, PBR materials, soft contact shadows.
 *   0 a jelly blob (transmission, SSS-like attenuation) that breathes, and squashes while pressed
 *   1 a carousel of tactile objects — jelly tower, ceramic discs, frosted-plastic knot, mirror-chrome sphere
 *   2 a frosted-glass slab with three lit bars behind it (the DOM wipe layer sits on top)
 *   3 two liquid-chrome drops joined by a bridge that stretches and snaps (marching cubes)
 * Motion is damped springs plus seamless sine loops: squash, rebound, settle — never linear.
 * Gestures write into a plain mutable store (createSceneStore); the scene reads it every frame.
 */
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Float, Lightformer, MarchingCube, MarchingCubes, MeshTransmissionMaterial, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'

export type SceneTheme = 'light' | 'dark'
type Spring = { value: number; velocity: number }
export type SceneStore = {
  page: number
  press: Spring & { target: number }
  spin: Spring & { target: number; held: boolean }
  pops: Spring[]
  pull: { x: Spring; y: Spring; held: boolean; tx: number; ty: number }
  pointer: { x: number; y: number }
}
export type SceneApi = {
  setPress: (amount: number) => void
  spinBy: (radians: number) => void
  release: () => void
  focus: () => number
  pick: (index: number) => void
  pull: (x: number, y: number) => void
  letGo: () => void
  point: (x: number, y: number) => void
}

const ITEMS = 4
const STEP = (Math.PI * 2) / ITEMS
const s = (): Spring => ({ value: 0, velocity: 0 })
/** Damped spring toward a target. */
const settle = (sp: Spring, target: number, dt: number, stiffness = 120, damping = 14) => {
  sp.velocity += ((target - sp.value) * stiffness - sp.velocity * damping) * dt
  sp.value += sp.velocity * dt
}

export function createSceneStore(): { store: SceneStore; api: SceneApi } {
  const store: SceneStore = {
    page: 0,
    press: { ...s(), target: 0 },
    spin: { ...s(), target: 0, held: false },
    pops: Array.from({ length: ITEMS }, s),
    pull: { x: { value: .66, velocity: 0 }, y: { value: .5, velocity: 0 }, held: false, tx: .66, ty: .5 },
    pointer: { x: 0, y: 0 },
  }
  const api: SceneApi = {
    setPress: amount => { store.press.target = amount },
    spinBy: radians => { store.spin.held = true; store.spin.value += radians; store.spin.velocity = radians * 40; store.spin.target = store.spin.value },
    release: () => {
      store.spin.held = false
      store.spin.target = Math.round((store.spin.value + store.spin.velocity * .1) / STEP) * STEP
    },
    focus: () => ((Math.round(store.spin.target / STEP) % ITEMS) + ITEMS) % ITEMS,
    pick: index => {
      const current = Math.round(store.spin.target / STEP)
      const delta = ((index - current) % ITEMS + ITEMS) % ITEMS
      store.spin.target = (current + (delta > ITEMS / 2 ? delta - ITEMS : delta)) * STEP
      store.pops[index].velocity = 7
    },
    pull: (x, y) => { store.pull.held = true; store.pull.tx = Math.min(.9, Math.max(.24, x)); store.pull.ty = Math.min(.85, Math.max(.15, y)) },
    letGo: () => { store.pull.held = false },
    point: (x, y) => { store.pointer.x = x; store.pointer.y = y },
  }
  return { store, api }
}

// ── palette (project: cool white + brand green; Morandi-soft supporting tones) ──
const C = {
  green: '#19c7aa', sage: '#a9d9cc', jelly: '#d8f1ea', cream: '#f3f1ec', mist: '#cfd4db', silver: '#eef2f6',
}

/** A page's sculpture: springs in with an overshoot, out with a squash. */
function Presence({ index, store, children }: { index: number; store: SceneStore; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const sp = useRef<Spring>({ value: index === 0 ? 1 : 0, velocity: 0 })
  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    settle(sp.current, store.page === index ? 1 : 0, Math.min(dt, .033), 90, 11)
    const v = Math.max(0, sp.current.value)
    g.visible = v > .003
    g.scale.set(v * (1 + (1 - v) * .25), v, v * (1 + (1 - v) * .25))
  })
  return <group ref={group}>{children}</group>
}

function Studio({ dark }: { dark: boolean }) {
  // Large softboxes, a strip and a faint green ring: clean highlights, gentle gradients in every reflection.
  return <Environment resolution={256} frames={1} key={dark ? 'd' : 'l'}>
    <color attach="background" args={[dark ? '#0d0f13' : '#e8ebef']} />
    <Lightformer form="rect" intensity={dark ? 1.4 : 2.4} position={[-4, 4, 5]} scale={[7, 5, 1]} target={[0, 0, 0]} />
    <Lightformer form="rect" intensity={dark ? .8 : 1.2} position={[5, 1, 3]} scale={[2, 7, 1]} target={[0, 0, 0]} />
    <Lightformer form="rect" intensity={dark ? .5 : 1} position={[0, 7, -1]} rotation-x={Math.PI / 2} scale={[12, 3, 1]} />
    <Lightformer form="ring" color={C.green} intensity={dark ? 2.2 : .7} position={[0, -2, -5]} scale={5} />
  </Environment>
}

function Rig({ store }: { store: SceneStore }) {
  const { camera, size } = useThree()
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 3)
    // Portrait stages are narrow: back the camera off until about 5.4 units fit across.
    const cam = camera as THREE.PerspectiveCamera
    const halfTan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const distance = Math.max(7.5, 2.35 / (halfTan * (size.width / Math.max(1, size.height))))
    camera.position.z += (distance - camera.position.z) * k
    camera.position.x += (store.pointer.x * .5 - camera.position.x) * k
    camera.position.y += (-store.pointer.y * .35 + .25 - camera.position.y) * k
    camera.lookAt(0, .15, 0)
  })
  return null
}

const jellyProps = (tint: string, attenuation: string) => ({
  transmissionSampler: true, samples: 4, resolution: 256, thickness: 1.1, roughness: .18, ior: 1.32,
  chromaticAberration: .05, anisotropy: .15, distortion: .25, distortionScale: .4, temporalDistortion: .08,
  color: tint, attenuationColor: attenuation, attenuationDistance: 1.6, clearcoat: 1, clearcoatRoughness: .15,
})

/** A soft elliptical floor shadow (radial-gradient texture): clean on every GPU, breathes with the sculpture. */
function SoftShadow({ store, dark }: { store: SceneStore; dark: boolean }) {
  const mesh = useRef<THREE.Mesh>(null)
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.45, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(canvas)
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  useFrame(({ clock }) => {
    const m = mesh.current
    if (!m) return
    const wide = store.page === 1 ? 2.6 : store.page === 3 ? 2.2 : 1.5
    const breathe = 1 + Math.sin(clock.elapsedTime * .9) * .04 + Math.max(0, store.press.value) * .25
    m.scale.x += (wide * breathe - m.scale.x) * .08
    m.scale.y += (wide * .32 * breathe - m.scale.y) * .08
  })
  return <mesh ref={mesh} position={[0, -1.35, 0]} rotation-x={-Math.PI / 2} scale={[1.5, .5, 1]}>
    <planeGeometry args={[2, 2]} />
    <meshBasicMaterial map={texture} transparent opacity={dark ? .55 : .16} depthWrite={false} color={dark ? '#000000' : '#3a4250'} />
  </mesh>
}

// 0 · the blob
function Blob({ store, dark }: { store: SceneStore; dark: boolean }) {
  const mesh = useRef<THREE.Mesh>(null)
  const core = useRef<THREE.Mesh>(null)
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1.05, 28), [])
  const base = useMemo(() => Float32Array.from(geometry.attributes.position.array as Float32Array), [geometry])
  const noise = useMemo(() => new ImprovedNoise(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, .033), t = clock.elapsedTime
    settle(store.press, store.press.target, dt, 170, 8)
    const p = store.press.value
    const pos = geometry.attributes.position as THREE.BufferAttribute
    const amp = .13 + Math.sin(t * 1.1) * .025 + Math.max(0, p) * .06
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2]
      const n = noise.noise(x * .9 + t * .32, y * .9 + t * .27, z * .9 + t * .21)
      const k = 1 + n * amp / 1.15 * 2.2
      pos.setXYZ(i, x * k, y * k, z * k)
    }
    pos.needsUpdate = true
    geometry.computeVertexNormals()
    const m = mesh.current, c = core.current
    if (!m || !c) return
    m.scale.set(1 + p * .24, 1 - p * .34, 1 + p * .24)
    m.rotation.y += dt * .22
    m.rotation.x = Math.sin(t * .45) * .18
    c.scale.setScalar(.38 * (1 + p * .8 + Math.sin(t * 2) * .05))
    ;(c.material as THREE.MeshStandardMaterial).emissiveIntensity = (dark ? 2.4 : 1.4) + p * 3
  })
  return <group position={[0, .35, 0]}>
    <mesh ref={core}><sphereGeometry args={[1, 32, 16]} /><meshStandardMaterial color={C.green} emissive={C.green} emissiveIntensity={1.4} roughness={.4} toneMapped={false} /></mesh>
    <mesh ref={mesh} geometry={geometry}><MeshTransmissionMaterial {...jellyProps(dark ? '#e3efec' : '#f2f8f6', C.sage)} /></mesh>
  </group>
}

// 1 · carousel of material-swapped objects
function Squish({ index, store, children }: { index: number; store: SceneStore; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, .033), g = group.current
    if (!g) return
    const pop = store.pops[index]
    settle(pop, 0, dt, 150, 7)
    const k = Math.min(.18, Math.abs(store.spin.velocity) * .012) * Math.sin(clock.elapsedTime * 9 + index) + pop.value * .09
    g.scale.set(1 + k * .6, 1 - k, 1 + k * .6)
    g.position.y = pop.value * .5
    ;(g.parent as THREE.Object3D).rotation.y = store.spin.value
  })
  return <group ref={group}>{children}</group>
}

function Carousel({ store }: { store: SceneStore }) {
  const ring = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    const dt = Math.min(delta, .033)
    if (!store.spin.held) settle(store.spin, store.spin.target, dt, 70, 11)
    if (ring.current) ring.current.rotation.y = -store.spin.value
  })
  const R = 2.25
  const at = (i: number): [number, number, number] => [Math.sin(i * STEP) * R, 0, Math.cos(i * STEP) * R]
  return <group position={[0, .35, -1.2]} rotation-x={.1}>
    <group ref={ring}>
      <group position={at(0)}><Squish index={0} store={store}><Float speed={1.4} rotationIntensity={.4} floatIntensity={.5}>
        <RoundedBox args={[.95, 1.75, .95]} radius={.32} smoothness={8}><MeshTransmissionMaterial {...jellyProps(C.jelly, C.green)} attenuationDistance={.9} /></RoundedBox>
      </Float></Squish></group>
      <group position={at(1)}><Squish index={1} store={store}><Float speed={1.2} rotationIntensity={.5} floatIntensity={.5}>
        <group rotation={[.35, 0, .12]}>{[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[0, -.44 + i * .22, 0]} rotation-y={i * .18}>
          <cylinderGeometry args={[.8, .8, .16, 72]} />
          <meshPhysicalMaterial color={i % 2 ? C.mist : C.cream} roughness={.48} clearcoat={.5} clearcoatRoughness={.35} />
        </mesh>)}</group>
      </Float></Squish></group>
      <group position={at(2)}><Squish index={2} store={store}><Float speed={1.6} rotationIntensity={.9} floatIntensity={.5}>
        <mesh><torusKnotGeometry args={[.52, .2, 220, 36]} /><meshPhysicalMaterial color={C.mist} roughness={.62} clearcoat={.25} clearcoatRoughness={.6} sheen={.6} sheenColor="#ffffff" /></mesh>
      </Float></Squish></group>
      <group position={at(3)}><Squish index={3} store={store}><Float speed={1.3} rotationIntensity={.3} floatIntensity={.6}>
        <mesh><sphereGeometry args={[.78, 96, 48]} /><meshStandardMaterial color={C.silver} metalness={1} roughness={.05} /></mesh>
      </Float></Squish></group>
    </group>
  </group>
}

// 2 · three lit bars floating behind the DOM frost (the frost tiles are the glass)
function Bars({ dark }: { dark: boolean }) {
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = group.current, t = clock.elapsedTime
    if (!g) return
    g.position.y = .2 + Math.sin(t * .8) * .06
    g.rotation.y = Math.sin(t * .5) * .35
    g.children.forEach((bar, i) => { bar.position.x = Math.sin(t * 1.1 + i * 1.7) * .12 })
  })
  return <group ref={group}>
    {[0, 1, 2].map(i => <mesh key={i} position={[0, .75 - i * .75, 0]} rotation-z={Math.PI / 2}>
      <capsuleGeometry args={[.13, 1.9 - i * .4, 12, 32]} />
      <meshPhysicalMaterial color={i === 0 ? C.green : C.sage} emissive={i === 0 ? C.green : C.sage} emissiveIntensity={dark ? 1.6 : .9} roughness={.35} clearcoat={1} toneMapped={false} />
    </mesh>)}
  </group>
}

// 3 · liquid-chrome bond: two drops and a bridge of beads that merge while close, stretch, then snap home
function Bond({ store }: { store: SceneStore }) {
  const free = useRef<THREE.Group>(null)
  const bridge = useRef<(THREE.Group | null)[]>([])
  useFrame((_, delta) => {
    const dt = Math.min(delta, .033), p = store.pull
    const tx = p.held ? p.tx : .66, ty = p.held ? p.ty : .5
    settle(p.x, tx, dt, p.held ? 260 : 120, p.held ? 26 : 7)
    settle(p.y, ty, dt, p.held ? 260 : 120, p.held ? 26 : 7)
    // Stage space (0..1) → the field's local space (about -.8..+.8).
    const ax = -.34, ay = 0, bx = (p.x.value - .5) * 1.6, by = -(p.y.value - .5) * 1.4
    free.current?.position.set(bx, by, 0)
    const dist = Math.hypot(bx - ax, by - ay)
    const linked = dist < 1.05
    bridge.current.forEach((m, i) => {
      if (!m) return
      const t = (i + 1) / 8
      const tt = linked ? t : t < .5 ? 0 : 1
      m.position.set(ax + (bx - ax) * tt, ay + (by - ay) * tt - Math.sin(t * Math.PI) * .06 * (linked ? 1 : 0), 0)
    })
  })
  return <group position={[0, .2, 0]}>
    <MarchingCubes resolution={44} maxPolyCount={30000} enableUvs={false} enableColors={false} scale={2.6}>
      <meshPhysicalMaterial color={C.silver} metalness={1} roughness={.07} clearcoat={1} clearcoatRoughness={.05} />
      <MarchingCube strength={.7} subtract={10} position={[-.34, 0, 0]} />
      <MarchingCube ref={free} strength={.62} subtract={10} position={[.3, 0, 0]} />
      {[0, 1, 2, 3, 4, 5, 6].map(i => <MarchingCube key={i} ref={el => { bridge.current[i] = el }} strength={.3} subtract={10} position={[0, 0, 0]} />)}
    </MarchingCubes>
  </group>
}

export default function OnboardingCanvas({ store, page, theme, onReady }: { store: SceneStore; page: number; theme: SceneTheme; onReady: () => void }) {
  store.page = page
  const dark = theme === 'dark'
  // The page colour is the scene background, so jelly and glass refract the real backdrop instead of grey.
  return <Canvas dpr={[1, 1.5]} camera={{ position: [0, .2, 8], fov: 30 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = dark ? 1.05 : 1; onReady() }}>
    <color attach="background" args={[dark ? '#08090c' : '#f2f4f7']} />
    <Studio dark={dark} />
    <directionalLight position={[-3, 5, 5]} intensity={dark ? 1 : 1.6} />
    <ambientLight intensity={dark ? .2 : .35} />
    <Rig store={store} />
    <Presence index={0} store={store}><Blob store={store} dark={dark} /></Presence>
    <Presence index={1} store={store}><Carousel store={store} /></Presence>
    <Presence index={2} store={store}><Bars dark={dark} /></Presence>
    <Presence index={3} store={store}><Bond store={store} /></Presence>
    <SoftShadow store={store} dark={dark} />
  </Canvas>
}
