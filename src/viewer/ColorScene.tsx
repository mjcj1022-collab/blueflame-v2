import { useRef, Suspense } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Environment, Lightformer, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { useDesign } from '../state/design'
import { useWorkspace } from '../state/workspace'
import { Piece, viewTarget } from './Piece'

const DEFAULT_BG = '#0E1113'

/** Compact procedural softbox so metals and stones reflect real light with no
 *  external HDRI — reused, self-contained copy of the design-stage rig. */
function StudioEnv() {
  return (
    <Environment resolution={256} environmentIntensity={1}>
      <Lightformer form="rect" intensity={1.6} color="#ffffff" scale={[46, 46, 1]} position={[0, 25, 4]} rotation={[-Math.PI / 2, 0, 0]} />
      <Lightformer form="rect" intensity={0.85} color="#ffffff" scale={[46, 46, 1]} position={[0, -25, 4]} rotation={[Math.PI / 2, 0, 0]} />
      <Lightformer form="rect" intensity={1.4} color="#ffffff" scale={[22, 42, 1]} position={[24, 4, 4]} rotation={[0, -Math.PI / 2, 0]} />
      <Lightformer form="rect" intensity={0.9} color="#ffffff" scale={[22, 42, 1]} position={[-24, 4, 4]} rotation={[0, Math.PI / 2, 0]} />
      <Lightformer form="ring" intensity={2.6} color="#ffffff" scale={5} position={[9, 15, 18]} />
      <Lightformer form="ring" intensity={1.8} color="#ffffff" scale={3.5} position={[-11, 9, 16]} />
    </Environment>
  )
}

function Spin({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.18 })
  return <group ref={ref}>{children}</group>
}

/**
 * The Color-studio viewport: the live 3D piece on a paintable backdrop. Clicking
 * a surface selects it as the colour target (metal vs. stone, decided by the hit
 * material's metalness) so the panel's picker paints exactly what you clicked —
 * the Paint half of the "Photoshop-meets-Paint" brief. Orbit + auto-spin otherwise.
 */
export function ColorScene() {
  const spec = useDesign(s => s.spec)
  const bg = useDesign(s => s.colorwork.bg) ?? DEFAULT_BG
  const setTarget = useDesign(s => s.setColorTarget)
  const target = viewTarget(spec)
  const mode = useWorkspace(s => s.mode)

  const pick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const obj = e.object as THREE.Mesh
    const mat = obj.material as THREE.MeshStandardMaterial | undefined
    // Transmissive stones carry metalness 0; metals sit at 1. Anything ambiguous
    // falls back to metal, the most common paint target.
    if (mat && typeof mat.metalness === 'number' && mat.metalness < 0.5) setTarget('stone')
    else setTarget('metal')
  }

  return (
    <div className="stage colorstage">
      <Canvas
        dpr={[1, 2]}
        frameloop={mode === 'color' ? 'always' : 'never'}
        camera={{ fov: 30, position: [18, 16, 44] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        <color attach="background" args={[bg]} />
        <Suspense fallback={null}>
          <StudioEnv />
        </Suspense>
        <ambientLight intensity={0.3} />
        <directionalLight position={[6, 12, 9]} intensity={1.5} />
        <directionalLight position={[-8, 3, -7]} intensity={0.65} color="#BFD4FF" />
        <Spin>
          <group onPointerDown={pick}>
            <Piece spec={spec} />
          </group>
        </Spin>
        <ContactShadows position={[0, -13, 0]} opacity={0.5} scale={70} blur={2.6} far={26} resolution={512} color="#000000" />
        <OrbitControls makeDefault enablePan={false} minDistance={16} maxDistance={110} target={target} />
      </Canvas>

      <div className="stage-foot">
        <div className="scalebar"><i /> Click the metal or the stone to paint it · drag to orbit</div>
      </div>
    </div>
  )
}
