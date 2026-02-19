const base = '';
const el = id => document.getElementById(id);

el('btn-health').addEventListener('click', async () => {
  el('out-health').textContent = 'loading...';
  try {
    const r = await fetch(base + '/healthz');
    const txt = await r.text();
    el('out-health').textContent = `${r.status} ${txt}`;
  } catch (e) {
    el('out-health').textContent = 'error: ' + e;
  }
});

el('btn-metrics').addEventListener('click', async () => {
  el('out-metrics').textContent = 'loading...';
  try {
    const r = await fetch(base + '/metrics');
    const txt = await r.text();
    el('out-metrics').textContent = (txt||'').slice(0,200);
  } catch (e) {
    el('out-metrics').textContent = 'error: ' + e;
  }
});

el('btn-push').addEventListener('click', async () => {
  const value = el('queue-item').value || `ui-test-${Date.now()}`;
  el('out-push').textContent = 'pushing...';
  try {
    const r = await fetch(base + `/ _dev/queue/push?item=${encodeURIComponent(value)}`, {method:'POST'});
    const j = await r.json();
    el('out-push').textContent = JSON.stringify(j, null, 2);
  } catch (e) {
    el('out-push').textContent = 'error: ' + e;
  }
});

el('btn-audit').addEventListener('click', async () => {
  const n = el('audit-n').value || 10;
  el('out-audit').textContent = 'loading...';
  try {
    const r = await fetch(base + `/ _dev/audit/latest?n=${encodeURIComponent(n)}`);
    const j = await r.json();
    el('out-audit').textContent = JSON.stringify(j, null, 2);
  } catch (e) {
    el('out-audit').textContent = 'error: ' + e;
  }
});
