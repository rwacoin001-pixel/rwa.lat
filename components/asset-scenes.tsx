'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Float, RoundedBox } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

export type AssetSceneKind = 'compute' | 'solar' | 'stocks' | 'prediction' | 'wallet' | 'portfolio' | 'solar-dome'

const MINT = '#2fe6bf'
const ICE = '#c5e3f7'
const METAL = '#9eabb5'
const DARK = '#080b0e'

function Stage({ wide = false }: { wide?: boolean }) {
  return (
    <group position={[0, -1.08, 0]}>
      <mesh>
        <cylinderGeometry args={[wide ? 1.62 : 1.2, wide ? 1.82 : 1.38, .24, 64]} />
        <meshStandardMaterial color="#141a1f" metalness={.94} roughness={.16} />
      </mesh>
      <mesh position={[0, .14, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[wide ? 1.34 : .96, .025, 10, 96]} />
        <meshBasicMaterial color={MINT} transparent opacity={.82} />
      </mesh>
      <mesh position={[0, -.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[wide ? 1.59 : 1.17, .012, 8, 96]} />
        <meshBasicMaterial color={ICE} transparent opacity={.42} />
      </mesh>
    </group>
  )
}

function ComputeObject() {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y = Math.sin(clock.elapsedTime * .35) * .18 - .3
  })
  return (
    <Float speed={1.2} rotationIntensity={.06} floatIntensity={.16}>
      <group ref={ref} position={[0, .05, 0]} rotation={[.05, -.3, 0]}>
        <RoundedBox args={[1.82, 1.82, 1.82]} radius={.14} smoothness={5}>
          <meshStandardMaterial color="#3c4850" metalness={.94} roughness={.16} emissive="#0b1517" emissiveIntensity={.32} />
        </RoundedBox>
        {[.58, .19, -.2, -.59].map((y) => (
          <group key={y} position={[0, y, .93]}>
            <RoundedBox args={[1.48, .25, .08]} radius={.045} smoothness={3}>
              <meshStandardMaterial color="#10171a" metalness={.76} roughness={.23} emissive="#061714" emissiveIntensity={.55} />
            </RoundedBox>
            <mesh position={[.48, 0, .055]}><boxGeometry args={[.34, .035, .025]} /><meshBasicMaterial color={MINT} /></mesh>
            {[-.55, -.42, -.29].map((x) => <mesh key={x} position={[x, 0, .06]}><sphereGeometry args={[.025, 10, 10]} /><meshBasicMaterial color={ICE} /></mesh>)}
          </group>
        ))}
        <mesh position={[0, .93, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[.54, .08, 12, 64]} />
          <meshStandardMaterial color="#070a0c" metalness={.92} roughness={.18} />
        </mesh>
        {Array.from({ length: 8 }).map((_, index) => (
          <mesh key={index} position={[Math.cos(index * Math.PI / 4) * .55, .99, Math.sin(index * Math.PI / 4) * .55]}>
            <boxGeometry args={[.08, .03, .34]} />
            <meshStandardMaterial color={METAL} metalness={1} roughness={.1} />
          </mesh>
        ))}
      </group>
    </Float>
  )
}

function SolarPanels({ large = false }: { large?: boolean }) {
  const rows = large ? [-.72, 0, .72] : [-.42, .42]
  const columns = large ? [-.82, 0, .82] : [-.48, .48]
  return (
    <group position={[0, .18, 0]} rotation={[0, -.3, 0]}>
      {rows.flatMap((z) => columns.map((x) => (
        <group key={`${x}-${z}`} position={[x, .05, z]} rotation={[-.22, 0, 0]}>
          <mesh><boxGeometry args={[large ? .72 : .8, .055, large ? .52 : .64]} /><meshBasicMaterial color="#224f82" /></mesh>
          <mesh position={[0, .034, 0]}><planeGeometry args={[large ? .66 : .74, large ? .46 : .58, 6, 4]} /><meshBasicMaterial color="#7ba8cf" transparent opacity={.72} wireframe /></mesh>
        </group>
      )))}
    </group>
  )
}

function SolarObject({ dome = false }: { dome?: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * .22) * .08
  })
  return (
    <group ref={ref} position={[0, dome ? -.18 : .08, 0]}>
      <RoundedBox args={[dome ? 3.05 : 2.15, .22, dome ? 2.22 : 1.68]} radius={.16} smoothness={4} position={[0, -.54, 0]}>
        <meshStandardMaterial color="#172019" metalness={.78} roughness={.26} />
      </RoundedBox>
      <SolarPanels large={dome} />
      <group position={[dome ? 1.05 : .72, -.05, dome ? -.45 : -.35]}>
        <mesh><cylinderGeometry args={[.25, .29, .82, 32]} /><meshStandardMaterial color={METAL} metalness={.98} roughness={.12} /></mesh>
        <mesh position={[0, 0, .26]}><boxGeometry args={[.24, .48, .03]} /><meshBasicMaterial color={MINT} transparent opacity={.72} /></mesh>
      </group>
      {dome && (
        <>
          <group position={[1.18, -.08, -.6]} scale={.62}>
            <mesh position={[0, .45, 0]}><cylinderGeometry args={[.05, .07, 1.28, 12]} /><meshStandardMaterial color={METAL} metalness={.9} roughness={.2} /></mesh>
            <mesh position={[0, 1.05, 0]}><coneGeometry args={[.4, .9, 4]} /><meshStandardMaterial color={ICE} wireframe metalness={1} roughness={.2} /></mesh>
          </group>
          <mesh scale={[1.75, .92, 1.35]} position={[0, .16, 0]}>
            <sphereGeometry args={[1.08, 56, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshPhysicalMaterial color={ICE} metalness={0} roughness={.02} transmission={.92} transparent opacity={.065} thickness={.04} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
    </group>
  )
}

function StocksObject() {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * .16 })
  return (
    <group ref={ref} position={[0, .05, 0]}>
      <mesh position={[0, .52, 0]}><sphereGeometry args={[.82, 34, 34]} /><meshPhysicalMaterial color="#9fc4d4" metalness={.25} roughness={.06} transmission={.28} transparent opacity={.42} /></mesh>
      <mesh position={[0, .52, 0]}><sphereGeometry args={[.84, 18, 12]} /><meshBasicMaterial color={ICE} transparent opacity={.25} wireframe /></mesh>
      {[-.72, -.34, .05, .44, .8].map((x, index) => (
        <group key={x} position={[x, -.42 + index * .05, .48]}>
          <mesh><cylinderGeometry args={[.12, .16, .5 + index * .24, 24]} /><meshStandardMaterial color={index > 2 ? MINT : METAL} metalness={.88} roughness={.12} emissive={index > 2 ? MINT : '#000000'} emissiveIntensity={index > 2 ? .22 : 0} /></mesh>
          <mesh position={[0, .27 + index * .12, 0]}><sphereGeometry args={[.13, 20, 20]} /><meshStandardMaterial color={ICE} metalness={.92} roughness={.08} /></mesh>
        </group>
      ))}
    </group>
  )
}

function PredictionObject() {
  const ref = useRef<THREE.Group>(null)
  const nodes = useMemo(() => [
    [-.48, .36, .42], [.1, .78, .25], [.52, .18, .38], [-.2, -.25, .52], [.38, -.42, .4], [-.6, -.12, .2],
  ] as [number, number, number][], [])
  const lineGeometry = useMemo(() => {
    const points: THREE.Vector3[] = []
    ;[[0,1],[1,2],[2,4],[4,3],[3,5],[5,0],[0,3],[1,4]].forEach(([a,b]) => points.push(new THREE.Vector3(...nodes[a]), new THREE.Vector3(...nodes[b])))
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [nodes])
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * .2 })
  return (
    <group ref={ref} position={[0, .28, 0]}>
      <mesh><sphereGeometry args={[1.02, 48, 48]} /><meshPhysicalMaterial color="#9dbaca" metalness={.1} roughness={.03} transmission={.42} transparent opacity={.32} thickness={.2} /></mesh>
      <lineSegments geometry={lineGeometry}><lineBasicMaterial color={MINT} transparent opacity={.72} /></lineSegments>
      {nodes.map((position, index) => <mesh key={index} position={position}><sphereGeometry args={[.055, 16, 16]} /><meshBasicMaterial color={index === 1 ? ICE : MINT} /></mesh>)}
    </group>
  )
}

function WalletCoin() {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y = -.28 + Math.sin(clock.elapsedTime * .34) * .16
    ref.current.position.y = Math.sin(clock.elapsedTime * .7) * .07 + .14
  })
  return (
    <group ref={ref} rotation={[0, -.28, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[1.08, 1.08, .3, 64]} /><meshStandardMaterial color="#69737b" metalness={1} roughness={.12} /></mesh>
      <mesh position={[0, 0, .17]}><circleGeometry args={[.93, 64]} /><meshStandardMaterial color="#1a2025" metalness={.96} roughness={.18} /></mesh>
      <mesh position={[0, 0, .185]}><torusGeometry args={[.62, .045, 14, 80]} /><meshStandardMaterial color={ICE} metalness={1} roughness={.07} /></mesh>
      <mesh position={[-.05, 0, .2]}><boxGeometry args={[1.12, .055, .06]} /><meshStandardMaterial color={ICE} metalness={1} roughness={.08} /></mesh>
      <mesh position={[.63, 0, .22]}><sphereGeometry args={[.09, 22, 22]} /><meshBasicMaterial color={MINT} /></mesh>
    </group>
  )
}

function PortfolioObject() {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * .13 })
  return (
    <group ref={ref} position={[0, .1, 0]} rotation={[.2, 0, 0]}>
      {[.66, .94, 1.22].map((radius, index) => (
        <mesh key={radius} rotation={[Math.PI / 2 + index * .18, index * .35, 0]}>
          <torusGeometry args={[radius, .055 - index * .012, 12, 96]} />
          <meshStandardMaterial color={index === 1 ? MINT : ICE} metalness={.94} roughness={.1} emissive={index === 1 ? MINT : '#000'} emissiveIntensity={index === 1 ? .18 : 0} />
        </mesh>
      ))}
      {[0, 1.57, 3.14, 4.71].map((angle, index) => <mesh key={angle} position={[Math.cos(angle) * .94, Math.sin(index * 1.4) * .28, Math.sin(angle) * .94]}><sphereGeometry args={[.12, 20, 20]} /><meshStandardMaterial color={index === 2 ? MINT : METAL} metalness={.95} roughness={.09} /></mesh>)}
      <mesh><sphereGeometry args={[.36, 32, 32]} /><meshStandardMaterial color="#c4d0d7" metalness={1} roughness={.07} /></mesh>
    </group>
  )
}

function Scene({ kind }: { kind: AssetSceneKind }) {
  const wide = kind === 'solar-dome'
  return (
    <>
      <ambientLight intensity={1.35} color="#c7d6df" />
      <spotLight position={[3.8, 5, 4.5]} intensity={42} angle={.48} penumbra={.8} color="#e6f3ff" />
      <pointLight position={[-3, 0, 3]} intensity={20} color={MINT} distance={9} />
      <pointLight position={[2, -2, 2]} intensity={10} color="#ffbd72" distance={7} />
      {kind === 'compute' && <ComputeObject />}
      {kind === 'solar' && <SolarObject />}
      {kind === 'solar-dome' && <SolarObject dome />}
      {kind === 'stocks' && <StocksObject />}
      {kind === 'prediction' && <PredictionObject />}
      {kind === 'wallet' && <WalletCoin />}
      {kind === 'portfolio' && <PortfolioObject />}
      <Stage wide={wide} />
      <ContactShadows position={[0, -1.18, 0]} opacity={.58} scale={wide ? 5 : 3.8} blur={2.8} far={3} color="#000000" />
    </>
  )
}

export default function AssetScene({ kind, className = '' }: { kind: AssetSceneKind; className?: string }) {
  const cameraZ = kind === 'solar-dome' ? 6.8 : kind === 'wallet' ? 5.85 : 5.1
  const cameraY = kind === 'solar-dome' ? 2.55 : kind === 'solar' ? 1.25 : .25
  return (
    <div className={`asset-scene asset-scene--${kind} ${className}`} aria-hidden="true">
      <Canvas dpr={[1, 1.35]} camera={{ position: [0, cameraY, cameraZ], fov: kind === 'solar-dome' ? 36 : 39 }} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}>
        <Scene kind={kind} />
      </Canvas>
    </div>
  )
}
