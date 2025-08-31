import React from 'react'
import { useAppStore } from '../lib/state/store'

export default function ControlsPanel() {
  const controls = useAppStore(s => s.controls)
  const setControls = useAppStore(s => s.setControls)

  return (
    <div className="p-4 grid gap-3">
      <div>
        <label className="label"><span className="label-text">Confidence: {controls.confidence.toFixed(2)}</span></label>
        <input type="range" min="0.05" max="0.95" step="0.01" value={controls.confidence}
          onChange={e => setControls({ confidence: Number(e.target.value) })} className="range" />
      </div>
      <div>
        <label className="label"><span className="label-text">IoU: {controls.iou.toFixed(2)}</span></label>
        <input type="range" min="0.1" max="0.9" step="0.01" value={controls.iou}
          onChange={e => setControls({ iou: Number(e.target.value) })} className="range" />
      </div>
      <div>
        <label className="label"><span className="label-text">Max Results: {controls.maxResults}</span></label>
        <input type="range" min="10" max="300" step="10" value={controls.maxResults}
          onChange={e => setControls({ maxResults: Number(e.target.value) })} className="range" />
      </div>
      <div>
        <label className="label"><span className="label-text">Min box area: {controls.minBoxPct}%</span></label>
        <input type="range" min="0" max="5" step="0.1" value={controls.minBoxPct}
          onChange={e => setControls({ minBoxPct: Number(e.target.value) })} className="range" />
      </div>
      <div className="flex items-center gap-2">
        <input id="lowpower" type="checkbox" className="toggle" checked={controls.lowPower}
          onChange={e => setControls({ lowPower: e.target.checked })} />
        <label htmlFor="lowpower">Low power (downscale)</label>
      </div>
      <div className="flex items-center gap-2">
        <input id="autodraw" type="checkbox" className="toggle" checked={controls.autoDraw}
          onChange={e => setControls({ autoDraw: e.target.checked })} />
        <label htmlFor="autodraw">Auto draw overlay</label>
      </div>
      <div className="flex items-center gap-2">
        <input id="smoothing" type="checkbox" className="toggle" checked={!!controls.smoothingEnabled}
          onChange={e => setControls({ smoothingEnabled: e.target.checked })} />
        <label htmlFor="smoothing">Temporal smoothing (reduce flicker/FPs)</label>
      </div>
      <div className="flex items-center gap-2">
        <input id="applyfilter" type="checkbox" className="toggle" checked={!!controls.filterEnabled}
          onChange={e => setControls({ filterEnabled: e.target.checked })} />
        <label htmlFor="applyfilter">Apply class filter</label>
      </div>
      <div>
        <div className="label"><span className="label-text">Classes</span></div>
        <div className="flex flex-wrap gap-2">
          {controls.classes.map((c) => {
            const checked = controls.selectedClasses?.has?.(c)
            return (
              <label key={c} className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" className="checkbox checkbox-xs" checked={!!checked}
                  onChange={e => {
                    const next = new Set(controls.selectedClasses || [])
                    if (e.target.checked) next.add(c); else next.delete(c)
                    setControls({ selectedClasses: next })
                  }} />
                <span className="text-sm">{c}</span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
