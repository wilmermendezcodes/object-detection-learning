import React, { useEffect, useRef, useState } from 'react'
import { inferImage, connectStream } from '../lib/api/client'
import { drawDetections, resizeCanvasToDPR, drawWatermark } from '../lib/canvas/draw'
import { useAppStore } from '../lib/state/store'

export default function DetectorView() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const capCanvasRef = useRef(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [streaming, setStreaming] = useState(false)
  const [wsMode, setWsMode] = useState(false)
  const wsRef = useRef(null)
  const wsActive = useRef(false)
  const [lastMs, setLastMs] = useState(0)
  const [fps, setFps] = useState(0)
  const lastMsgTs = useRef(0)
  const setDetections = useAppStore(s => s.setDetections)
  const controls = useAppStore(s => s.controls)
  const [err, setErr] = useState('')
  const tracksRef = useRef([]) // simple temporal tracks

  useEffect(() => {
    capCanvasRef.current = document.createElement('canvas')
    const onResize = () => {
      const v = videoRef.current
      if (v && v.videoWidth && v.videoHeight) {
        setDims({ w: v.videoWidth, h: v.videoHeight })
        resizeCanvasToDPR(canvasRef.current, v.videoWidth, v.videoHeight)
      }
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => { if (wsRef.current) wsRef.current.close() }
  }, [])

  const startCamera = async () => {
    setErr('')
    try {
      if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser')
      }
      const primary = { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: primary, audio: false })
      } catch (e) {
        // Fallback to default camera
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }
      const video = videoRef.current
      video.srcObject = stream
      await new Promise(resolve => {
        if (video.readyState >= 2) return resolve()
        video.onloadedmetadata = () => resolve()
      })
      await video.play()
      // match overlay canvas to video dimensions
      try {
        const w = video.videoWidth
        const h = video.videoHeight
        setDims({ w, h })
        resizeCanvasToDPR(canvasRef.current, w, h)
      } catch {}
      setStreaming(true)
    } catch (e) {
      console.error('startCamera error', e)
      setErr(`${e?.name || 'Error'}: ${e?.message || String(e)}`)
      setStreaming(false)
    }
  }

  const stopCamera = () => {
    const video = videoRef.current
    const stream = video?.srcObject
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      video.srcObject = null
    }
    setStreaming(false)
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
    // clear overlay canvas
    try {
      const c = canvasRef.current
      const ctx = c.getContext('2d')
      ctx.clearRect(0, 0, c.width, c.height)
    } catch {}
  }

  const grabFrameBlob = (mime = 'image/jpeg', quality = 0.8) => new Promise(resolve => {
    const video = videoRef.current
    const cap = capCanvasRef.current || (capCanvasRef.current = document.createElement('canvas'))
    const w = video.videoWidth
    const h = video.videoHeight
    cap.width = w
    cap.height = h
    const ctx = cap.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(video, 0, 0, w, h)
    cap.toBlob(resolve, mime, quality)
  })

  const doPostOnce = async () => {
    const blob = await grabFrameBlob()
    const selected = controls.selectedClasses
    const include = (!!controls.filterEnabled && selected?.size) ? Array.from(selected) : []
    const minArea = controls.minBoxPct ? controls.minBoxPct / 100 : undefined
    const res = await inferImage(blob, 'frame.jpg', {
      conf: controls.confidence,
      iou: controls.iou,
      max_results: controls.maxResults,
      include_classes: include,
      min_area_ratio: minArea,
    })
    const ctx = canvasRef.current.getContext('2d')
    const applyFilter = !!controls.filterEnabled && selected?.size
    // clear previous overlay; video shows beneath
    const ov = canvasRef.current
    ctx.clearRect(0, 0, ov.width, ov.height)
    let dets = Array.from(applyFilter ? res.detections.filter(d => selected.has(d.label)) : res.detections)
    dets = smoothDetections(dets, controls.smoothingEnabled)
    if (controls.autoDraw) {
      drawDetections(ctx, dets)
      drawWatermark(ctx, `POST ${dets.length} • ${lastMs.toFixed(1)}ms`)
    }
    setLastMs(res.time_ms)
    setDetections(dets)
  }

  const startWs = async () => {
    if (!streaming) await startCamera()
    // Close any existing socket before starting a new one
    if (wsRef.current && wsRef.current.readyState <= 1) {
      try { wsRef.current.close() } catch {}
    }
    const selected = controls.selectedClasses
    const include = (!!controls.filterEnabled && selected?.size) ? Array.from(selected) : []
    const minArea = controls.minBoxPct ? controls.minBoxPct / 100 : undefined
    const ws = connectStream({ conf: controls.confidence, iou: controls.iou, max_results: controls.maxResults, include_classes: include, min_area_ratio: minArea })
    wsRef.current = ws
    ws.binaryType = 'arraybuffer'
    ws.onopen = async () => {
      wsActive.current = true
      let inFlight = false
      const sendFrame = async () => {
        if (!wsActive.current || ws.readyState !== 1) return
        if (inFlight) return
        const v = videoRef.current
        if (!v || !v.videoWidth) return requestAnimationFrame(sendFrame)
        inFlight = true
        try {
          const blob = await grabFrameBlob('image/jpeg', 0.6)
          if (!wsActive.current || ws.readyState !== 1) return
          const ab = await blob.arrayBuffer()
          if (!wsActive.current || ws.readyState !== 1) return
          ws.send(ab)
        } catch (e) {
          wsActive.current = false
          try { ws.close() } catch {}
          return
        }
      }
      // Kick off first frame
      requestAnimationFrame(sendFrame)
      // on each response, send the next frame (ping-pong to avoid backlog)
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          const ctx = canvasRef.current.getContext('2d')
          const ov = canvasRef.current
          ctx.clearRect(0, 0, ov.width, ov.height)
          const selected = controls.selectedClasses
          const applyFilter = !!controls.filterEnabled && selected?.size
          let dets = Array.from(applyFilter ? (msg.detections || []).filter(d => selected.has(d.label)) : (msg.detections || []))
          dets = smoothDetections(dets, controls.smoothingEnabled)
          if (controls.autoDraw) {
            drawDetections(ctx, dets)
            drawWatermark(ctx, `WS ${dets.length} • ${(msg.time_ms||0).toFixed(1)}ms`)
          }
          setLastMs(msg.time_ms || 0)
          setDetections(dets)
          const now = performance.now()
          if (lastMsgTs.current) {
            const dt = now - lastMsgTs.current
            const inst = 1000 / Math.max(1, dt)
            setFps((prev) => prev ? prev * 0.8 + inst * 0.2 : inst)
          }
          lastMsgTs.current = now
        } catch {}
        // Mark previous send complete and queue the next frame
        inFlight = false
        requestAnimationFrame(sendFrame)
      }
    }
    // ws.onmessage reassigned in onopen to coordinate ping-pong sending
    ws.onerror = () => { wsActive.current = false }
    ws.onclose = () => { wsActive.current = false; setWsMode(false); if (wsRef.current === ws) wsRef.current = null }
    setWsMode(true)
  }

  const downloadSnapshot = async () => {
    const video = videoRef.current
    const overlay = canvasRef.current
    if (!video?.videoWidth) return
    const off = document.createElement('canvas')
    const w = video.videoWidth
    const h = video.videoHeight
    off.width = w
    off.height = h
    const ctx = off.getContext('2d')
    ctx.drawImage(video, 0, 0, w, h)
    // draw overlay scaled to match video dimensions
    ctx.drawImage(overlay, 0, 0, w, h)
    const url = off.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = 'snapshot.png'
    a.click()
  }

  return (
    <div className="grid gap-2 p-3">
      <div className="mx-auto w-full max-w-screen-lg">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {!streaming ? (
            <button type="button" className="btn btn-primary" onClick={startCamera} aria-label="Start camera">
              Start Camera
            </button>
          ) : (
            <button type="button" className="btn" onClick={stopCamera} aria-label="Stop camera">
              Stop
            </button>
          )}
          <button type="button" className="btn" onClick={doPostOnce} disabled={!streaming} aria-disabled={!streaming} aria-label="Detect via POST">
            Detect (POST)
          </button>
          {!wsMode ? (
            <button type="button" className="btn" onClick={startWs} disabled={!streaming} aria-disabled={!streaming} aria-label="Start WebSocket streaming">
              Start WS
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => { wsActive.current = false; wsRef.current?.close(); setWsMode(false) }} aria-label="Stop WebSocket streaming">
              Stop WS
            </button>
          )}
          <button type="button" className="btn" onClick={downloadSnapshot} disabled={!streaming} aria-disabled={!streaming} aria-label="Download snapshot">
            Snapshot
          </button>
          <div className="text-xs opacity-70 ml-auto">{wsMode ? 'WS' : 'POST'} | {lastMs.toFixed(1)} ms | {fps.toFixed(1)} fps</div>
        </div>

        {err && <div className="text-sm text-error mb-1">{err}. Tips: allow camera for localhost and close other apps using camera.</div>}

        <div className="relative rounded-md overflow-hidden shadow" style={{ aspectRatio: dims.w && dims.h ? `${dims.w} / ${dims.h}` : '16 / 9' }}>
          <video ref={videoRef} playsInline muted autoPlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', zIndex: 0 }} />
          <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 hidden">
        {!streaming ? (
          <button type="button" className="btn btn-primary" onClick={startCamera} aria-label="Start camera">
            Start Camera
          </button>
        ) : (
          <button type="button" className="btn" onClick={stopCamera} aria-label="Stop camera">
            Stop
          </button>
        )}
        <button type="button" className="btn" onClick={doPostOnce} disabled={!streaming} aria-disabled={!streaming} aria-label="Detect via POST">
          Detect (POST)
        </button>
        {!wsMode ? (
          <button type="button" className="btn" onClick={startWs} disabled={!streaming} aria-disabled={!streaming} aria-label="Start WebSocket streaming">
            Start WS
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => { wsActive.current = false; wsRef.current?.close(); setWsMode(false) }} aria-label="Stop WebSocket streaming">
            Stop WS
          </button>
        )}
        <button type="button" className="btn" onClick={downloadSnapshot} disabled={!streaming} aria-disabled={!streaming} aria-label="Download snapshot">
          Snapshot
        </button>
      </div>


    </div>
  )
}

let __tracks = []
function smoothDetections(dets, enabled) {
  if (!enabled) return dets
  const used = new Set()
  for (const d of dets) {
    let best = -1, bestIdx = -1
    for (let i = 0; i < __tracks.length; i++) {
      const t = __tracks[i]
      if (t.label !== d.label) continue
      const ov = iou({ bbox: t.bbox }, { bbox: d.bbox })
      if (ov > best) { best = ov; bestIdx = i }
    }
    if (best >= 0.5) {
      __tracks[bestIdx].bbox = d.bbox
      __tracks[bestIdx].hits = (__tracks[bestIdx].hits || 0) + 1
      __tracks[bestIdx].age = 0
      used.add(bestIdx)
    } else {
      __tracks.push({ label: d.label, bbox: d.bbox, hits: 1, age: 0 })
      used.add(__tracks.length - 1)
    }
  }
  for (let i = __tracks.length - 1; i >= 0; i--) {
    if (!used.has(i)) __tracks[i].age = (__tracks[i].age || 0) + 1
    if (__tracks[i].age > 5) __tracks.splice(i, 1)
  }
  // only output tracks that have at least 2 hits (persisted across frames)
  const stable = __tracks.filter(t => (t.hits || 0) >= 2).map(t => ({ label: t.label, bbox: t.bbox, class_id: 0, score: 0.0 }))
  // fallback: if none stable yet, return original detections
  return stable.length ? stable : dets
}

// Simple temporal smoothing: require detection to persist 2 consecutive frames
function iou(a, b) {
  const [ax, ay, aw, ah] = a.bbox; const [bx, by, bw, bh] = b.bbox
  const x1 = Math.max(ax, bx), y1 = Math.max(ay, by)
  const x2 = Math.min(ax + aw, bx + bw), y2 = Math.min(ay + ah, by + bh)
  const iw = Math.max(0, x2 - x1), ih = Math.max(0, y2 - y1)
  const inter = iw * ih
  const ua = aw * ah + bw * bh - inter
  return ua > 0 ? inter / ua : 0
}
