import { useState, useEffect } from 'react'
import { listProducts, createProduct, deleteProduct, listBatches, createBatch, deleteBatch } from '../api'

export default function Products({ toast }) {
  const [products, setProducts] = useState([])
  const [batches, setBatches] = useState([])
  const [pForm, setPForm] = useState({ name: '', sku: '', category: '', description: '' })
  const [bForm, setBForm] = useState({ batch_number: '', product_id: '', quantity: '', expiry_date: '' })
  const [loadingP, setLoadingP] = useState(true)
  const [loadingB, setLoadingB] = useState(true)
  const [showPForm, setShowPForm] = useState(false)
  const [showBForm, setShowBForm] = useState(false)

  const loadProducts = () => {
    setLoadingP(true)
    listProducts().then(d => setProducts(Array.isArray(d) ? d : d.items || [])).catch(console.error).finally(() => setLoadingP(false))
  }
  const loadBatches = () => {
    setLoadingB(true)
    listBatches().then(d => setBatches(Array.isArray(d) ? d : d.items || [])).catch(console.error).finally(() => setLoadingB(false))
  }

  useEffect(() => { loadProducts(); loadBatches() }, [])

  const submitProduct = async (e) => {
    e.preventDefault()
    try {
      await createProduct(pForm)
      toast('Product created', 'success')
      setPForm({ name: '', sku: '', category: '', description: '' })
      setShowPForm(false)
      loadProducts()
    } catch { toast('Failed to create product', 'error') }
  }

  const submitBatch = async (e) => {
    e.preventDefault()
    try {
      await createBatch({ ...bForm, quantity: parseInt(bForm.quantity, 10) || 0 })
      toast('Batch created', 'success')
      setBForm({ batch_number: '', product_id: '', quantity: '', expiry_date: '' })
      setShowBForm(false)
      loadBatches()
    } catch { toast('Failed to create batch', 'error') }
  }

  const delProduct = async (id) => {
    if (!confirm('Delete product?')) return
    try { await deleteProduct(id); toast('Deleted', 'success'); loadProducts() }
    catch { toast('Cannot delete — has linked batches', 'error') }
  }

  const delBatch = async (id) => {
    if (!confirm('Delete batch?')) return
    try { await deleteBatch(id); toast('Deleted', 'success'); loadBatches() }
    catch { toast('Cannot delete', 'error') }
  }

  const setP = (k, v) => setPForm(f => ({ ...f, [k]: v }))
  const setB = (k, v) => setBForm(f => ({ ...f, [k]: v }))

  return (
    <div className="page">
      <div className="page-header">
        <h2>Products & Batches</h2>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Products</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowPForm(f => !f)}>
            {showPForm ? 'Cancel' : '+ Add Product'}
          </button>
        </div>
        {showPForm && (
          <form onSubmit={submitProduct} style={{ marginBottom: 16 }}>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="form-group">
                <label>Name *</label>
                <input required value={pForm.name} onChange={e => setP('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label>SKU</label>
                <input value={pForm.sku} onChange={e => setP('sku', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Category</label>
                <input value={pForm.category} onChange={e => setP('category', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input value={pForm.description} onChange={e => setP('description', e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">Save Product</button>
          </form>
        )}
        {loadingP ? <span className="spinner" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>SKU</th><th>Category</th><th>Description</th><th></th></tr></thead>
              <tbody>
                {products.length === 0 && <tr><td colSpan={5}><div className="empty">No products yet</div></td></tr>}
                {products.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td style={{ fontFamily: 'monospace' }}>{p.sku || '—'}</td>
                    <td>{p.category || '—'}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{p.description || '—'}</td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => delProduct(p.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Batches</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowBForm(f => !f)}>
            {showBForm ? 'Cancel' : '+ Add Batch'}
          </button>
        </div>
        {showBForm && (
          <form onSubmit={submitBatch} style={{ marginBottom: 16 }}>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="form-group">
                <label>Batch Number *</label>
                <input required value={bForm.batch_number} onChange={e => setB('batch_number', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Product</label>
                <select value={bForm.product_id} onChange={e => setB('product_id', e.target.value)}>
                  <option value="">— None —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Quantity</label>
                <input type="number" min={0} value={bForm.quantity} onChange={e => setB('quantity', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Expiry Date</label>
                <input type="date" value={bForm.expiry_date} onChange={e => setB('expiry_date', e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">Save Batch</button>
          </form>
        )}
        {loadingB ? <span className="spinner" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Batch #</th><th>Product</th><th>Qty</th><th>Expiry</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {batches.length === 0 && <tr><td colSpan={6}><div className="empty">No batches yet</div></td></tr>}
                {batches.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontFamily: 'monospace' }}><strong>{b.batch_number}</strong></td>
                    <td>{b.product_name || '—'}</td>
                    <td>{b.quantity ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{b.expiry_date || '—'}</td>
                    <td><span className={`badge ${b.status === 'active' ? 'badge-pass' : 'badge-fail'}`}>{b.status || 'active'}</span></td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => delBatch(b.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
