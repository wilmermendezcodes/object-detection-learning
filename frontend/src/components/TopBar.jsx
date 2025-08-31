import React, { useEffect, useState } from 'react'
import { health, listModels, getActiveModel, selectModel, getLabels } from '../lib/api/client'
import { useAppStore } from '../lib/state/store'

export default function TopBar() {
  const [status, setStatus] = useState('checking')
  const model = useAppStore(s => s.model)
  const setModel = useAppStore(s => s.setModel)
  const setControls = useAppStore(s => s.setControls)
  const detCount = useAppStore(s => s.detections.length)
  const [models, setModels] = useState([])

  useEffect(() => {
    let mounted = true
    const tick = async () => {
      try {
        await health()
        if (mounted) setStatus('up')
      } catch {
        if (mounted) setStatus('down')
      }
    }
    tick()
    const id = setInterval(tick, 3000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const [lst, act] = await Promise.all([listModels(), getActiveModel()])
        setModels(lst)
        setModel(act)
        // fetch labels for active model and update controls
        try {
          const labels = await getLabels()
          setControls({ classes: labels })
        } catch {}
      } catch {}
    }
    load()
  }, [setModel])

  const onSelect = async (e) => {
    const [engine, name] = e.target.value.split(':')
    try {
      const m = await selectModel({ engine, name })
      setModel(m)
      // update labels after switching
      try {
        const labels = await getLabels()
        setControls({ classes: labels, selectedClasses: new Set() })
      } catch {}
    } catch {}
  }

  return (
    <div className="w-full px-4 py-2 flex items-center justify-between border-b">
      <div className="font-semibold">SwiftDetect</div>
      <div className="flex items-center gap-4 text-sm">
        <div>Backend: {status === 'up' ? '🟢 Up' : status === 'down' ? '🔴 Down' : '🟡 Checking'}</div>
        <div>Detections: {detCount}</div>
        <div className="flex items-center gap-2">
          <span>Model:</span>
          <select className="select select-xs" value={`${model.engine}:${model.name}`} onChange={onSelect}>
            {models.map(m => (
              <option key={`${m.engine}:${m.name}`} value={`${m.engine}:${m.name}`}>{m.engine}:{m.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
