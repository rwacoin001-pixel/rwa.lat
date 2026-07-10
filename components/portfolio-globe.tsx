'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

const MINT = new THREE.Color('#26e6b7')
const PLATINUM = new THREE.Color('#dce8ef')

function pseudoRandom(index: number) {
  const value = Math.sin(index * 91.345 + 17.23) * 43758.5453
  return value - Math.floor(value)
}

function isLand(latitude: number, longitude: number) {
  const shapes: Array<[number, number, number, number]> = [
    [-100, 43, 29, 23], [-93, 19, 17, 19], [-61, -15, 18, 30], [-7, 53, 18, 10],
    [21, 9, 25, 35], [67, 44, 55, 23], [112, 25, 22, 27], [136, -25, 17, 15],
    [48, -19, 6, 10], [-41, 73, 12, 8], [142, 48, 13, 9],
  ]
  return shapes.some(([lon, lat, width, height]) => {
    const dx = (((longitude - lon) + 540) % 360) - 180
    const dy = latitude - lat
    return (dx * dx) / (width * width) + (dy * dy) / (height * height) < 1
  })
}

function DottedContinents() {
  const geometry = useMemo(() => {
    const positions: number[] = []
    const colors: number[] = []
    let attempts = 0
    let point = 0
    while (positions.length < 5400 && attempts < 14000) {
      attempts += 1
      const latitude = pseudoRandom(attempts * 2) * 150 - 75
      const longitude = pseudoRandom(attempts * 2 + 1) * 360 - 180
      if (!isLand(latitude, longitude)) continue
      const phi = THREE.MathUtils.degToRad(90 - latitude)
      const theta = THREE.MathUtils.degToRad(longitude + 180)
      const radius = 1.586
      positions.push(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      )
      const tint = 0.47 + pseudoRandom(point + 510) * 0.44
      colors.push(0.5 * tint, 0.96 * tint, 0.96 * tint)
      point += 1
    }
    const output = new THREE.BufferGeometry()
    output.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    output.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return output
  }, [])

  return <points geometry={geometry}><pointsMaterial size={0.026} vertexColors transparent opacity={0.94} sizeAttenuation depthWrite={false} /></points>
}

function Orbit({ rotation, speed, color, phase }: { rotation: [number, number, number]; speed: number; color: THREE.Color; phase: number }) {
  const ref = useRef<THREE.Group>(null)
  const nodeRef = useRef<THREE.Group>(null)

  useFrame(({ clock }, delta) => {
    if (ref.current) ref.current.rotation.z += delta * speed
    if (nodeRef.current) {
      const t = clock.getElapsedTime() * speed * 2 + phase
      nodeRef.current.position.set(Math.cos(t) * 1.72, Math.sin(t) * 0.035, Math.sin(t) * 0.88)
    }
  })

  return (
    <group ref={ref} rotation={rotation}>
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.16, .54, 1]}>
        <torusGeometry args={[1.48, 0.011, 8, 120]} />
        <meshBasicMaterial color={color} transparent opacity={0.42} depthWrite={false} />
      </mesh>
      <group ref={nodeRef}>
        <mesh><sphereGeometry args={[0.078, 20, 20]} /><meshStandardMaterial color="#d9e4ec" metalness={.96} roughness={.12} /></mesh>
        <mesh scale={1.55}><sphereGeometry args={[0.078, 20, 20]} /><meshBasicMaterial color={color} transparent opacity={.14} /></mesh>
      </group>
    </group>
  )
}

function GlobeScene() {
  const ref = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Group>(null)

  useFrame(({ clock, pointer }, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * .105
      ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, pointer.y * .12 - .02, .025)
      ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, -pointer.x * .08, .025)
      ref.current.position.y = Math.sin(clock.getElapsedTime() * .68) * .055
    }
    if (coreRef.current) coreRef.current.rotation.y -= delta * .52
  })

  return (
    <>
      <ambientLight intensity={1.2} color="#b8c6df" />
      <pointLight position={[4, 3, 5]} intensity={27} color="#dce9ff" distance={12} />
      <pointLight position={[-4, -1, 3]} intensity={22} color="#26e6b7" distance={10} />
      <pointLight position={[0, -4, 3]} intensity={10} color="#ffb547" distance={9} />
      <pointLight position={[0, 0, 2.2]} intensity={12} color="#bdf9e9" distance={4} />
      <group ref={ref} position={[0, -.02, 0]}>
        <mesh>
          <sphereGeometry args={[1.59, 80, 80]} />
          <meshStandardMaterial color="#b8d7e3" metalness={.32} roughness={.055} transparent opacity={.19} emissive="#102630" emissiveIntensity={.5} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <DottedContinents />
        <mesh rotation={[0, .55, .18]}>
          <torusGeometry args={[1.595, .007, 6, 120]} />
          <meshBasicMaterial color={PLATINUM} transparent opacity={.28} />
        </mesh>
        <mesh rotation={[Math.PI / 2, .45, .12]} scale={[1, .68, 1]}>
          <torusGeometry args={[1.602, .007, 6, 120]} />
          <meshBasicMaterial color={PLATINUM} transparent opacity={.22} />
        </mesh>
        <group ref={coreRef}>
          <mesh><sphereGeometry args={[.37, 48, 48]} /><meshStandardMaterial color="#dbe7ec" metalness={1} roughness={.055} emissive="#1c434c" emissiveIntensity={.82} /></mesh>
          <mesh scale={.63}><sphereGeometry args={[.37, 40, 40]} /><meshBasicMaterial color="#26e6b7" transparent opacity={.46} depthWrite={false} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.47, .022, 12, 64]} /><meshStandardMaterial color="#f2fbff" metalness={.98} roughness={.08} /></mesh>
        </group>
        <Orbit rotation={[.68, .12, .12]} speed={.14} color={MINT} phase={0} />
        <Orbit rotation={[.47, .58, -.3]} speed={-.095} color={PLATINUM} phase={2.1} />
        <Orbit rotation={[.84, -.26, .42]} speed={.078} color={new THREE.Color('#7788a3')} phase={4.3} />
        <group position={[0, -1.78, 0]}>
          <mesh><cylinderGeometry args={[1.14, 1.28, .24, 72]} /><meshStandardMaterial color="#26333d" metalness={.94} roughness={.13} /></mesh>
          <mesh position={[0, .14, 0]}><cylinderGeometry args={[.91, 1.02, .07, 72]} /><meshStandardMaterial color="#60717b" metalness={.91} roughness={.13} /></mesh>
          <mesh position={[0, .19, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.8, .032, 12, 96]} /><meshBasicMaterial color={MINT} transparent opacity={.88} /></mesh>
          <mesh position={[0, -.15, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.14, .012, 8, 96]} /><meshBasicMaterial color={PLATINUM} transparent opacity={.38} /></mesh>
        </group>
      </group>
    </>
  )
}

export default function PortfolioGlobe() {
  return (
    <div className="portfolio-globe-canvas">
      <Canvas dpr={[1, 1.45]} camera={{ position: [0, .12, 6.65], fov: 34 }} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}>
        <GlobeScene />
      </Canvas>
    </div>
  )
}
