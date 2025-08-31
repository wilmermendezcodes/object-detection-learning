const base = '/api/v1'

export async function health() {
  // Use direct /api/health to avoid path normalization issues
  const res = await fetch(`/api/health`)
  if (!res.ok) throw new Error('health failed')
  return res.json()
}

export async function inferImage(blob, filename = 'frame.jpg', params = {}) {
  const fd = new FormData()
  fd.append('file', blob, filename)
  const qs = new URLSearchParams()
  if (params.conf != null) qs.set('conf', String(params.conf))
  if (params.iou != null) qs.set('iou', String(params.iou))
  if (params.max_results != null) qs.set('max_results', String(params.max_results))
  if (params.include_classes && params.include_classes.length) qs.set('include_classes', params.include_classes.join(','))
  if (params.min_area_ratio != null) qs.set('min_area_ratio', String(params.min_area_ratio))
  const res = await fetch(`${base}/infer/image?${qs}`, {
    method: 'POST',
    body: fd,
  })
  if (!res.ok) throw new Error('infer failed')
  return res.json()
}

export function connectStream(params = {}) {
  const qs = new URLSearchParams()
  if (params.conf != null) qs.set('conf', String(params.conf))
  if (params.iou != null) qs.set('iou', String(params.iou))
  if (params.max_results != null) qs.set('max_results', String(params.max_results))
  if (params.include_classes && params.include_classes.length) qs.set('include_classes', params.include_classes.join(','))
  if (params.min_area_ratio != null) qs.set('min_area_ratio', String(params.min_area_ratio))
  const suffix = qs.toString() ? `?${qs}` : ''
  const wsUrl = (location.origin.replace('http', 'ws') + '/api/v1/infer/stream' + suffix)
  return new WebSocket(wsUrl)
}

export async function listModels() {
  const res = await fetch(`${base}/models`)
  if (!res.ok) throw new Error('models failed')
  return res.json()
}

export async function getActiveModel() {
  const res = await fetch(`${base}/models/active`)
  if (!res.ok) throw new Error('active failed')
  return res.json()
}

export async function selectModel(body) {
  const res = await fetch(`${base}/models/select`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error('select failed')
  return res.json()
}

export async function getLabels() {
  const res = await fetch(`${base}/models/labels`)
  if (!res.ok) throw new Error('labels failed')
  return res.json()
}
