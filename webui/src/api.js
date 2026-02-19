const BASE = ''

export async function getHealth() {
  const r = await fetch(BASE + '/healthz')
  return r.text()
}

export async function getInspections() {
  const r = await fetch(BASE + '/api/v1/inspections/')
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function createInspection(data) {
  const r = await fetch(BASE + '/api/v1/inspections/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function getInspection(id) {
  const r = await fetch(BASE + `/api/v1/inspections/${id}`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function getAuditRows(n = 20) {
  const r = await fetch(BASE + `/_dev/audit/latest?n=${n}`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function pushQueueItem(item) {
  const r = await fetch(BASE + `/_dev/queue/push?item=${encodeURIComponent(item)}`, { method: 'POST' })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}
