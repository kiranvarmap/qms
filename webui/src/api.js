const BASE = '/api/v1';

function getToken() {
  return localStorage.getItem('qms_token');
}

async function req(method, path, body) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Generic fetch helper used by page components
export async function api(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const login = (username, password) => req('POST', '/auth/login', { username, password });
export const register = (data) => req('POST', '/auth/register', data);
export const getStats = () => req('GET', '/stats/');

export const listInspections = (params = {}) => {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  if (params.limit) q.set('limit', String(params.limit || 50));
  if (params.offset) q.set('offset', String(params.offset || 0));
  return req('GET', `/inspections/?${q}`);
};
export const createInspection = (data) => req('POST', '/inspections/', data);
export const getInspection = (id) => req('GET', `/inspections/${id}`);
export const updateStatus = (id, status) => req('PATCH', `/inspections/${id}/status`, { status });
export const deleteInspection = (id) => req('DELETE', `/inspections/${id}`);

export const listSignatures = (id) => req('GET', `/inspections/${id}/signatures`);
export const addSignature = (id, data) => req('POST', `/inspections/${id}/signatures`, data);
export const revokeSignature = (id, sigId) => req('DELETE', `/inspections/${id}/signatures/${sigId}`);

export const listProducts = () => req('GET', '/products');
export const createProduct = (data) => req('POST', '/products', data);
export const deleteProduct = (id) => req('DELETE', `/products/${id}`);

export const listBatches = () => req('GET', '/batches');
export const createBatch = (data) => req('POST', '/batches', data);
export const deleteBatch = (id) => req('DELETE', `/batches/${id}`);

export const listOperators = () => req('GET', '/operators/');
export const createOperator = (data) => req('POST', '/operators/', data);

export const listDefectTypes = () => req('GET', '/defects/types');
export const createDefectType = (data) => req('POST', '/defects/types', data);
export const deleteDefectType = (id) => req('DELETE', `/defects/types/${id}`);
export const listInspectionDefects = (id) => req('GET', `/defects/inspection/${id}`);
export const attachDefect = (id, data) => req('POST', `/defects/inspection/${id}`, data);
export const removeDefect = (id, did) => req('DELETE', `/defects/inspection/${id}/${did}`);

export const getAuditRows = (n = 20) => fetch(`/_dev/audit/latest?n=${n}`).then(r => r.json());
export const getHealth = () => fetch('/healthz').then(r => r.text());
