import { useEffect, useState } from 'react'
import { api } from '../api'

export default function Products() {
  const [products, setProducts] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('products')
  const [modal, setModal] = useState(null) // 'product' | 'batch'
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const load = () => Promise.all([
    api('/products').catch(() => []),
    api('/batches').catch(() => [])
  ]).then(([p, b]) => {
    setProducts(Array.isArray(p) ? p : [])
    setBatches(Array.isArray(b) ? b : [])
    setLoading(false)
  })

  useEffect(() => { load() }, [])

  const showToast = (msg, type='success') => {
    setToast({msg,type})
    setTimeout(() => setToast(null), 3000)
  }

  const openModal = (type) => {
    setForm(type === 'product' ? {name:'',sku:'',description:''} : {batch_number:'',product_id:'',quantity:'',expiry_date:'',status:'active'})
    setModal(type)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const endpoint = modal === 'product' ? '/products' : '/batches'
      const payload = {...form}
      if (modal === 'batch') {
        if (payload.product_id) payload.product_id = parseInt(payload.product_id)
        if (payload.quantity) payload.quantity = parseInt(payload.quantity)
        if (!payload.expiry_date) delete payload.expiry_date
      }
      const res = await api(endpoint, { method:'POST', body: JSON.stringify(payload) })
      if (!res?.id) throw new Error('Failed to save')
      showToast(`${modal === 'product' ? 'Product' : 'Batch'} created!`)
      setModal(null)
      load()
    } catch (err) {
      showToast(err?.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="page-header">
        <div>
          <h1 className="page-title">Products & Batches</h1>
          <p className="page-sub">Manage your product catalog</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={() => openModal('batch')}>+ New Batch</button>
          <button className="btn btn-primary" onClick={() => openModal('product')}>+ New Product</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="tabs">
            <button className={`tab${tab==='products'?' active':''}`} onClick={() => setTab('products')}>
              Products <span className="tab-count">{products.length}</span>
            </button>
            <button className={`tab${tab==='batches'?' active':''}`} onClick={() => setTab('batches')}>
              Batches <span className="tab-count">{batches.length}</span>
            </button>
          </div>
        </div>
        <div className="card-body" style={{padding:0}}>
          {loading ? (
            <div style={{padding:40,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}} /></div>
          ) : tab === 'products' ? (
            products.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <div>No products yet</div>
                <button className="btn btn-primary" style={{marginTop:16}} onClick={() => openModal('product')}>Create Product</button>
              </div>
            ) : (
              <table className="table">
                <thead><tr><th>#</th><th>Name</th><th>SKU</th><th>Description</th><th>Created</th></tr></thead>
                <tbody>
                  {products.map((p,i) => (
                    <tr key={p.id}>
                      <td style={{color:'var(--text-muted)',fontSize:12}}>{i+1}</td>
                      <td style={{fontWeight:500}}>{p.name}</td>
                      <td><code style={{fontSize:12,background:'var(--bg-secondary)',padding:'2px 6px',borderRadius:4}}>{p.sku || '—'}</code></td>
                      <td style={{color:'var(--text-muted)',fontSize:13}}>{p.description || '—'}</td>
                      <td style={{color:'var(--text-muted)',fontSize:12}}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            batches.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🏷️</div>
                <div>No batches yet</div>
                <button className="btn btn-primary" style={{marginTop:16}} onClick={() => openModal('batch')}>Create Batch</button>
              </div>
            ) : (
              <table className="table">
                <thead><tr><th>#</th><th>Batch Number</th><th>Product</th><th>Qty</th><th>Status</th><th>Expiry</th></tr></thead>
                <tbody>
                  {batches.map((b,i) => {
                    const prod = products.find(p => p.id === b.product_id)
                    return (
                      <tr key={b.id}>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{i+1}</td>
                        <td style={{fontWeight:500}}>{b.batch_number || `Batch #${b.id}`}</td>
                        <td>{prod?.name || '—'}</td>
                        <td>{b.quantity ?? '—'}</td>
                        <td><span className={`badge badge-${b.status==='active'?'green':b.status==='expired'?'red':'yellow'}`}>{b.status || 'active'}</span></td>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{modal === 'product' ? 'New Product' : 'New Batch'}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <form onSubmit={save}>
              <div className="modal-body">
                {modal === 'product' ? (
                  <>
                    <div className="form-group"><label>Product Name *</label><input required value={form.name||''} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Widget A" /></div>
                    <div className="form-group"><label>SKU</label><input value={form.sku||''} onChange={e => setForm(p=>({...p,sku:e.target.value}))} placeholder="auto-generated if blank" /></div>
                    <div className="form-group"><label>Description</label><textarea rows={2} value={form.description||''} onChange={e => setForm(p=>({...p,description:e.target.value}))} /></div>
                  </>
                ) : (
                  <>
                    <div className="form-group"><label>Batch Number *</label><input required value={form.batch_number||''} onChange={e => setForm(p=>({...p,batch_number:e.target.value}))} placeholder="e.g. BATCH-2024-001" /></div>
                    <div className="form-group">
                      <label>Product</label>
                      <select value={form.product_id||''} onChange={e => setForm(p=>({...p,product_id:e.target.value}))}>
                        <option value="">— Select —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <div className="form-group"><label>Quantity</label><input type="number" value={form.quantity||''} onChange={e => setForm(p=>({...p,quantity:e.target.value}))} /></div>
                      <div className="form-group"><label>Status</label>
                        <select value={form.status||'active'} onChange={e => setForm(p=>({...p,status:e.target.value}))}>
                          <option value="active">Active</option>
                          <option value="quarantine">Quarantine</option>
                          <option value="expired">Expired</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group"><label>Expiry Date</label><input type="date" value={form.expiry_date||''} onChange={e => setForm(p=>({...p,expiry_date:e.target.value}))} /></div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
