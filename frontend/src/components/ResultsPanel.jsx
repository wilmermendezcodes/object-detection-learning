import React from 'react'
import { useAppStore } from '../lib/state/store'

export default function ResultsPanel() {
  const detections = useAppStore(s => s.detections)
  return (
    <div className="p-4 grid gap-2">
      <div className="font-medium">Detections ({detections.length})</div>
      <div className="grid gap-1">
        {detections.map((d, i) => (
          <div key={i} className="text-sm opacity-90 flex justify-between">
            <span>{d.label ?? 'object'} #{d.class_id}</span>
            <span>{Math.round((d.score || 0) * 100)}%</span>
            <span>[{d.bbox.map(x => Math.round(x)).join(', ')}]</span>
          </div>
        ))}
        {!detections.length && <div className="text-sm opacity-60">No detections yet.</div>}
      </div>
    </div>
  )}

