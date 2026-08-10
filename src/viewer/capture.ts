import * as THREE from 'three'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { pieceHandle } from './exportStl'

/**
 * Live handle to the Design scene's renderer/scene/camera, set by a small rig
 * component inside the Canvas. Used to render the piece off-screen at high
 * resolution for a hero photo and to spin it for an animated GIF — without
 * disturbing what's on screen.
 */
interface CaptureHandle { gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera }
export const captureHandle: { current: CaptureHandle | null } = { current: null }

export const canCapture = (): boolean => !!captureHandle.current

/** Render the current view into a 2D canvas at width×height (sRGB, tone-mapped). */
function renderToCanvas(width: number, height: number): HTMLCanvasElement | null {
  const h = captureHandle.current
  if (!h) return null
  const { gl, scene, camera } = h
  const rt = new THREE.WebGLRenderTarget(width, height, {
    colorSpace: THREE.SRGBColorSpace,       // encode sRGB so it matches the screen
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    samples: 4,
  })
  const cam = camera as THREE.PerspectiveCamera
  const prevAspect = cam.aspect
  cam.aspect = width / height
  cam.updateProjectionMatrix()
  gl.setRenderTarget(rt)
  gl.render(scene, cam)
  gl.setRenderTarget(null)
  cam.aspect = prevAspect
  cam.updateProjectionMatrix()

  const buf = new Uint8Array(width * height * 4)
  gl.readRenderTargetPixels(rt, 0, 0, width, height, buf)
  rt.dispose()

  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const img = ctx.createImageData(width, height)
  const rowBytes = width * 4
  for (let y = 0; y < height; y++) {                    // WebGL reads bottom-up; flip
    const src = (height - 1 - y) * rowBytes
    img.data.set(buf.subarray(src, src + rowBytes), y * rowBytes)
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

const trigger = (blob: Blob, filename: string) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

/** Render the current view and return it as a data URL plus its dimensions and
 *  format, for embedding elsewhere (e.g. the manufacturing tech pack PDF).
 *  Defaults to JPEG so embeds stay small. */
export function heroImage(scale = 1.5, mime: 'image/png' | 'image/jpeg' = 'image/jpeg', quality = 0.9):
  { url: string; w: number; h: number; format: 'PNG' | 'JPEG' } | null {
  const h = captureHandle.current
  if (!h) return null
  const dom = h.gl.domElement
  const w = Math.max(64, Math.round(dom.clientWidth * scale))
  const ht = Math.max(64, Math.round(dom.clientHeight * scale))
  const canvas = renderToCanvas(w, ht)
  if (!canvas) return null
  return { url: canvas.toDataURL(mime, quality), w, h: ht, format: mime === 'image/jpeg' ? 'JPEG' : 'PNG' }
}

/** Download a high-resolution PNG of the current view (scale× the on-screen size). */
export function downloadHeroPng(scale = 2): boolean {
  const h = captureHandle.current
  if (!h) return false
  const dom = h.gl.domElement
  const w = Math.max(64, Math.round(dom.clientWidth * scale))
  const ht = Math.max(64, Math.round(dom.clientHeight * scale))
  const canvas = renderToCanvas(w, ht)
  if (!canvas) return false
  canvas.toBlob(blob => { if (blob) trigger(blob, 'mandrel-render.png') }, 'image/png')
  return true
}

/**
 * Spin the piece a full turn, capturing frames, and download an animated GIF.
 * Rotates the rendered piece group directly, restoring it afterward.
 */
export async function downloadSpinGif(opts: { frames?: number; maxDim?: number; onProgress?: (p: number) => void } = {}): Promise<boolean> {
  const h = captureHandle.current
  const root = pieceHandle.current
  if (!h || !root) return false
  const { frames = 36, maxDim = 480, onProgress } = opts
  const dom = h.gl.domElement
  const ar = dom.clientWidth / Math.max(1, dom.clientHeight)
  const w = ar >= 1 ? maxDim : Math.round(maxDim * ar)
  const ht = ar >= 1 ? Math.round(maxDim / ar) : maxDim

  const enc = GIFEncoder()
  const start = root.rotation.y
  try {
    for (let i = 0; i < frames; i++) {
      root.rotation.y = start + (i / frames) * Math.PI * 2
      root.updateMatrixWorld(true)
      const canvas = renderToCanvas(w, ht)
      if (!canvas) break
      const data = canvas.getContext('2d')!.getImageData(0, 0, w, ht).data
      const palette = quantize(data, 256)
      const index = applyPalette(data, palette)
      enc.writeFrame(index, w, ht, { palette, delay: 60 })
      onProgress?.((i + 1) / frames)
      await new Promise(r => setTimeout(r))            // yield so the UI can paint progress
    }
  } finally {
    root.rotation.y = start
    root.updateMatrixWorld(true)
  }
  enc.finish()
  const bytes = enc.bytes()
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  trigger(new Blob([ab], { type: 'image/gif' }), 'mandrel-spin.gif')
  return true
}
