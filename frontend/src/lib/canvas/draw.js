export function drawDetections(ctx, detections = [], opts = {}) {
  const { color = '#00ff88', lineWidth = 3, font = '12px system-ui' } = opts
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lineWidth
  ctx.font = font
  detections.forEach(det => {
    const [x, y, w, h] = det.bbox
    ctx.strokeRect(x, y, w, h)
    const label = `${det.label ?? det.class ?? 'obj'} ${(det.score*100||0).toFixed(0)}%`
    ctx.fillText(label, x + 4, y + 12)
  })
  ctx.restore()
}

export function resizeCanvasToDPR(canvas, width, height) {
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  // Make overlay responsive: let CSS scale it with the container
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  const ctx = canvas.getContext('2d')
  // Draw in source pixel coordinates; CSS scales visually
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

export function drawWatermark(ctx, text, x = 8, y = 16) {
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(x - 6, y - 12, ctx.measureText(text).width + 12, 18)
  ctx.fillStyle = '#fff'
  ctx.font = '12px system-ui'
  ctx.fillText(text, x, y)
  ctx.restore()
}
