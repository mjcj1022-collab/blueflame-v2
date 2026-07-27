/**
 * Bridge between the R3F stage and the panel for multi-view capture. The scene
 * lives inside the Canvas; a small rig there registers a capture function here,
 * which the panel calls to grab front / side / top renders. A module holder (not
 * React state) so calling it never triggers a re-render.
 */

export interface MultiView { front: string; side: string; top: string }

let capturer: (() => MultiView | null) | null = null

export function setCapturer(fn: (() => MultiView | null) | null): void { capturer = fn }

/** Capture the three technical views, or null if the stage isn't mounted. */
export function captureThreeViews(): MultiView | null {
  return capturer ? capturer() : null
}
