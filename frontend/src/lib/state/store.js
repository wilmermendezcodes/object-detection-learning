import { create } from 'zustand'

const defaultControls = {
  confidence: 0.25,
  iou: 0.45,
  maxResults: 100,
  lowPower: false,
  autoDraw: true,
  classes: ['object'],
  selectedClasses: new Set(),
  filterEnabled: false,
  minBoxPct: 0, // % of frame area
  smoothingEnabled: false,
}

const persistedRaw = JSON.parse(localStorage.getItem('swift-detect-controls') || 'null')
const persisted = persistedRaw ? { ...persistedRaw, selectedClasses: new Set(persistedRaw.selectedClasses || []) } : null

export const useAppStore = create((set, get) => ({
  controls: { ...defaultControls, ...(persisted || {}) },
  detections: [],
  model: { engine: 'tensorflow', name: 'efficientdet_d0' },
  setControls: (patch) => set(state => {
    const next = { ...state.controls, ...patch }
    // Convert Set to array for persistence
    const toSave = { ...next, selectedClasses: Array.from(next.selectedClasses || []) }
    localStorage.setItem('swift-detect-controls', JSON.stringify(toSave))
    return { controls: next }
  }),
  setDetections: (arr) => set({ detections: arr }),
  setModel: (model) => set({ model }),
}))
