'use client'

import { useEffect, useRef } from 'react'

export default function TrustArtifact({ name, onReady }: { name: 'tablet' | 'stater'; onReady: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    let cancelled = false
    let dispose = () => {}
    const controller = new AbortController()
    async function setup() {
      const [THREE, { GLTFLoader }, { RoomEnvironment }] = await Promise.all([
        import('three'), import('three/examples/jsm/loaders/GLTFLoader.js'), import('three/examples/jsm/environments/RoomEnvironment.js'),
      ])
      if (cancelled || !el) return
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = .75
      el.append(renderer.domElement)
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(33, 1, .1, 30)
      camera.position.set(0, 0, 6.1)
      const room = new RoomEnvironment()
      const pmrem = new THREE.PMREMGenerator(renderer)
      const environment = pmrem.fromScene(room, .05)
      scene.environment = environment.texture
      scene.environmentIntensity = .4
      room.dispose(); pmrem.dispose()
      const light = new THREE.DirectionalLight('#ffe2ad', 2.2)
      light.position.set(-3, 4, 5); scene.add(light)
      const rim = new THREE.DirectionalLight('#a9c5d5', .85)
      rim.position.set(4, 2, -1); scene.add(rim)
      scene.add(new THREE.AmbientLight('#b6a186', .5))
      let model: import('three').Group | null = null
      let frame = 0
      const release = () => {
        cancelAnimationFrame(frame)
        model?.traverse(o => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose()
            const materials = Array.isArray(o.material) ? o.material : [o.material]
            materials.forEach(m => {
              const material = m as import('three').MeshStandardMaterial
              material.map?.dispose(); m.dispose()
            })
          }
        })
        environment.dispose(); renderer.dispose(); renderer.domElement.remove()
      }
      dispose = release
      const response = await fetch(`/media/desktop/trust-v2/models/${name}.glb`, { signal: controller.signal })
      if (!response.ok) throw new Error('Artifact unavailable')
      const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '')
      model = gltf.scene
      if (cancelled) { release(); return }
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      model.position.sub(box.getCenter(new THREE.Vector3()))
      const group = new THREE.Group(); group.add(model)
      group.scale.setScalar(3 / Math.max(size.x, size.y))
      scene.add(group)
      const resize = () => {
        const { width, height } = el.getBoundingClientRect()
        if (!width || !height) return
        renderer.setSize(width, height)
        camera.aspect = width / height; camera.updateProjectionMatrix()
      }
      const observer = new ResizeObserver(resize); observer.observe(el); resize()
      let x = 0, y = 0, tx = -.12, ty = -.04
      const move = (e: PointerEvent) => { tx = -.12 + (e.clientX / innerWidth - .5) * .28; ty = (e.clientY / innerHeight - .5) * .1 }
      window.addEventListener('pointermove', move, { passive: true })
      let last = performance.now()
      const render = (now: number) => {
        if (cancelled) return
        const dt = Math.max(.001, Math.min(.06, (now - last) / 1000)); last = now
        x = THREE.MathUtils.damp(x, tx, 5, dt); y = THREE.MathUtils.damp(y, ty, 5, dt)
        group.rotation.set(y, x, -.018)
        renderer.render(scene, camera)
        frame = requestAnimationFrame(render)
      }
      dispose = () => { observer.disconnect(); window.removeEventListener('pointermove', move); release() }
      render(performance.now()); onReady()
    }
    setup().catch(() => { dispose() /* Keep the transparent photographic fallback. */ })
    return () => { cancelled = true; controller.abort(); dispose() }
  }, [name, onReady])
  return <div ref={host} aria-hidden="true" style={{ position: 'absolute', inset: 0 }} />
}
