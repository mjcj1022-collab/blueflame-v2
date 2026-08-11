import * as THREE from 'three'

let cached: THREE.Texture | null = null

/**
 * A small white circular sprite, generated once on a canvas and cached.
 * THREE's default PointsMaterial draws square dots — feeding this in as the
 * point sprite's `map` (with alphaTest to punch out the transparent corners)
 * is what actually makes a `<points>` cloud read as round dots.
 */
export function circleSprite(): THREE.Texture {
  if (cached) return cached
  const size = 64
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  cached = tex
  return tex
}
