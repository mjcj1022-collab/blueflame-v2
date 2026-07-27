import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useModeler } from '../state/modeler'
import { bakedVertices } from '../lib/sculpt'
import { setCapturer, type MultiView } from '../lib/capture'

/**
 * Lives inside the Canvas. Registers a synchronous capture function that renders
 * the piece from front / side / top with a temporary camera framed to the model's
 * own bounding box (so grid/lights don't skew the fit), reading each frame off the
 * canvas immediately. Restores the live view afterward. No async frame timing.
 */
export function CaptureRig() {
  const { gl, scene, camera, invalidate } = useThree()

  useEffect(() => {
    setCapturer((): MultiView | null => {
      const objs = useModeler.getState().objects
      if (!objs.length) return null
      // World bounds from the model only (exclude grid/gizmo/lights).
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity
      for (const o of objs) {
        const v = bakedVertices(o)
        for (let i = 0; i < v.length; i += 3) {
          minX = Math.min(minX, v[i]); maxX = Math.max(maxX, v[i])
          minY = Math.min(minY, v[i + 1]); maxY = Math.max(maxY, v[i + 1])
          minZ = Math.min(minZ, v[i + 2]); maxZ = Math.max(maxZ, v[i + 2])
        }
      }
      if (!isFinite(minX)) return null
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2
      const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 10
      const fov = 32
      const dist = (size * 1.5) / (2 * Math.tan((fov * Math.PI) / 360)) + size

      const el = gl.domElement
      const cam = new THREE.PerspectiveCamera(fov, el.width / el.height || 1, 0.1, 10000)
      const center = new THREE.Vector3(cx, cy, cz)

      const shoot = (pos: [number, number, number], up: [number, number, number]): string => {
        cam.position.set(cx + pos[0], cy + pos[1], cz + pos[2])
        cam.up.set(up[0], up[1], up[2])
        cam.lookAt(center)
        cam.updateProjectionMatrix()
        gl.render(scene, cam)
        return el.toDataURL('image/png')
      }

      const out: MultiView = {
        front: shoot([0, 0, dist], [0, 1, 0]),
        side: shoot([dist, 0, 0], [0, 1, 0]),
        top: shoot([0, dist, 0.0001], [0, 0, -1]),
      }
      // Hand the canvas back to the live view.
      gl.render(scene, camera)
      invalidate()
      return out
    })
    return () => setCapturer(null)
  }, [gl, scene, camera, invalidate])

  return null
}
