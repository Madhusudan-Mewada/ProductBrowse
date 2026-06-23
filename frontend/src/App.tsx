import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: number
  name: string
  category: string
  price: string
  created_at: string
  updated_at: string
}

interface Pagination {
  limit: number
  hasNextPage: boolean
  nextCursor: string | null
}

// Use env var in production, fallback to relative (proxied) for local dev
const API_BASE = (import.meta.env.VITE_API_URL as string) || ''

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]) // page history
  const [currentPage, setCurrentPage] = useState(0)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limit] = useState(20)

  // ── Fetch categories once ──────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/products/categories`)
      .then((r) => r.json())
      .then((d) => setCategories(d.categories))
      .catch(() => setError('Failed to load categories'))
  }, [])

  // ── Fetch products ─────────────────────────────────────────────────────────
  const fetchProducts = useCallback(
    async (cursor: string | null, category: string) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ limit: String(limit) })
        if (cursor) params.set('cursor', cursor)
        if (category) params.set('category', category)

        const res = await fetch(`${API_BASE}/api/products?${params}`)
        if (!res.ok) throw new Error('API error')
        const data = await res.json()
        setProducts(data.products)
        setPagination(data.pagination)
      } catch {
        setError('Failed to load products. Is the backend running?')
      } finally {
        setLoading(false)
      }
    },
    [limit]
  )

  // Fetch when page or category changes
  useEffect(() => {
    fetchProducts(cursorStack[currentPage], selectedCategory)
  }, [currentPage, cursorStack, selectedCategory, fetchProducts])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat)
    setCursorStack([null])
    setCurrentPage(0)
  }

  const handleNextPage = () => {
    if (!pagination?.nextCursor) return
    const newStack = [...cursorStack.slice(0, currentPage + 1), pagination.nextCursor]
    setCursorStack(newStack)
    setCurrentPage((p) => p + 1)
  }

  const handlePrevPage = () => {
    if (currentPage === 0) return
    setCurrentPage((p) => p - 1)
  }

  const formatPrice = (price: string) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
      Number(price)
    )

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    })

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <h1 style={styles.logo}>🛍️ ProductBrowse</h1>
          <p style={styles.subtitle}>Browse 2,00,000 products — fast & consistent pagination</p>
        </div>
      </header>

      <main style={styles.main}>
        {/* Category Filter */}
        <div style={styles.filterBar}>
          <span style={styles.filterLabel}>Filter by category:</span>
          <div style={styles.chips}>
            <button
              style={{ ...styles.chip, ...(selectedCategory === '' ? styles.chipActive : {}) }}
              onClick={() => handleCategoryChange('')}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                style={{ ...styles.chip, ...(selectedCategory === cat ? styles.chipActive : {}) }}
                onClick={() => handleCategoryChange(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Product Grid */}
        {loading ? (
          <div style={styles.loadingGrid}>
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} style={styles.skeleton} />
            ))}
          </div>
        ) : (
          <div style={styles.grid}>
            {products.map((p) => (
              <div key={p.id} style={styles.card}>
                <div style={styles.cardCategory}>{p.category}</div>
                <div style={styles.cardName}>{p.name}</div>
                <div style={styles.cardPrice}>{formatPrice(p.price)}</div>
                <div style={styles.cardDate}>Added {formatDate(p.created_at)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div style={styles.pagination}>
          <button
            style={{ ...styles.pageBtn, ...(currentPage === 0 ? styles.pageBtnDisabled : {}) }}
            onClick={handlePrevPage}
            disabled={currentPage === 0}
          >
            ← Previous
          </button>

          <span style={styles.pageInfo}>
            Page {currentPage + 1}
            {selectedCategory && ` · ${selectedCategory}`}
          </span>

          <button
            style={{
              ...styles.pageBtn,
              ...(!pagination?.hasNextPage ? styles.pageBtnDisabled : {}),
            }}
            onClick={handleNextPage}
            disabled={!pagination?.hasNextPage}
          >
            Next →
          </button>
        </div>
      </main>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', background: '#f0f2f5' },
  header: { background: '#1a1a2e', color: '#fff', padding: '24px 0' },
  headerInner: { maxWidth: 1200, margin: '0 auto', padding: '0 24px' },
  logo: { fontSize: 28, fontWeight: 700, letterSpacing: -0.5 },
  subtitle: { marginTop: 4, color: '#aaa', fontSize: 14 },
  main: { maxWidth: 1200, margin: '0 auto', padding: '24px' },
  filterBar: {
    background: '#fff', borderRadius: 12, padding: '16px 20px',
    marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
  },
  filterLabel: { fontWeight: 600, fontSize: 14, color: '#555', whiteSpace: 'nowrap' },
  chips: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  chip: {
    padding: '6px 14px', borderRadius: 20, border: '1.5px solid #ddd',
    background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    color: '#555', transition: 'all 0.15s',
  },
  chipActive: { background: '#1a1a2e', color: '#fff', border: '1.5px solid #1a1a2e' },
  error: {
    background: '#fff0f0', border: '1px solid #ffcdd2', color: '#c62828',
    padding: 16, borderRadius: 8, marginBottom: 24, fontSize: 14,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 16, marginBottom: 24,
  },
  loadingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 16, marginBottom: 24,
  },
  skeleton: {
    height: 148, borderRadius: 12,
    background: 'linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.2s infinite',
  },
  card: {
    background: '#fff', borderRadius: 12, padding: '18px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)', transition: 'transform 0.15s, box-shadow 0.15s',
    cursor: 'default',
  },
  cardCategory: {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8,
    color: '#1a1a2e', background: '#f0f0f8', display: 'inline-block',
    padding: '3px 8px', borderRadius: 4, marginBottom: 10,
  },
  cardName: { fontSize: 15, fontWeight: 600, color: '#222', marginBottom: 10, lineHeight: 1.3 },
  cardPrice: { fontSize: 20, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 },
  cardDate: { fontSize: 12, color: '#999' },
  pagination: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
    background: '#fff', borderRadius: 12, padding: '16px 24px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  pageBtn: {
    padding: '10px 24px', borderRadius: 8, border: 'none',
    background: '#1a1a2e', color: '#fff', fontWeight: 600, fontSize: 14,
    cursor: 'pointer', transition: 'opacity 0.15s',
  },
  pageBtnDisabled: { background: '#ccc', cursor: 'not-allowed' },
  pageInfo: { fontSize: 14, color: '#555', fontWeight: 500 },
}