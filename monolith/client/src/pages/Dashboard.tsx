import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchFromAPI } from '../api/client';
import { useCart } from '../context/CartContext';
import { Icon } from '../components/Icon';
import { Newsletter } from '../components/Newsletter';

interface Product {
    id: number;
    name: string;
    price: number;
    stock: number;
    category: string;
    swatch?: string;
    note?: string;
}

const CATEGORIES = ["All categories", "Load Test", "Electronics", "Clothing", "Home", "Books", "Toys", "Sports", "Other"];
const SORTS = ["Featured", "Price: low to high", "Price: high to low"];
const PAGE_SIZE = 20;

const PillSelect = ({ label, value, onChange, options }: { label: string, value: string, onChange: (v: string) => void, options: string[] }) => (
  <label className="group relative inline-flex items-center">
    <span className="absolute -top-2 left-3 px-1 bg-paper text-[10px] tracking-wide text-mute uppercase">{label}</span>
    <select
      className="ms-select focus-ring pl-4 pr-9 h-10 rounded-full bg-paper border border-line text-sm text-ink hover:border-ink/30 transition cursor-pointer"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
    <span className="pointer-events-none absolute right-3 text-mute"><Icon name="chevron" size={14} /></span>
  </label>
);

const Placeholder = ({ swatch = "#E8DCC8", label, large = false }: { swatch?: string, label: string, large?: boolean }) => (
  <div className="relative w-full h-full overflow-hidden rounded-xl swatch-stripe" style={{ backgroundColor: swatch }}>
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="px-2.5 py-1 rounded-full bg-paper/80 backdrop-blur-sm text-[10px] tracking-wide text-mute font-mono">
        {label}
      </div>
    </div>
    {large && <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-paper/60" />}
  </div>
);

const ProductCard = ({ p, qty, onAdd, onInc, onDec }: { p: Product, qty: number, onAdd: (p: Product) => void, onInc: (p: Product) => void, onDec: (p: Product) => void }) => {
  const [hover, setHover] = useState(false);
  const out = p.stock === 0;
  const low = p.stock > 0 && p.stock < 20;

  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative rounded-2xl bg-paper shadow-card hover:shadow-cardHi hover:-translate-y-1 transition-all duration-200 p-3"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
        <Placeholder swatch={p.swatch} label="product photo" large />
        <Link to={`/product/${p.id}`}
          aria-label="quick view"
          className={`absolute top-3 right-3 h-8 w-8 grid place-items-center rounded-full bg-paper/95 text-ink shadow-card transition-all ${hover ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}>
          <Icon name="search" size={14} />
        </Link>
        {out && (
          <div className="absolute inset-0 grid place-items-center bg-paper/70 backdrop-blur-[1px]">
            <div className="px-3 py-1.5 rounded-full bg-ink text-paper text-[11px] tracking-wide">restocking soon</div>
          </div>
        )}
      </div>

      <div className="px-1 pt-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/product/${p.id}`} className="hover:underline">
              <h3 className="text-[15px] leading-snug truncate">{p.name}</h3>
            </Link>
            <p className="text-xs text-mute mt-0.5">{p.note || p.category}</p>
          </div>
          <div className="text-[15px] text-coral whitespace-nowrap font-medium tabular-nums">${p.price}</div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {out ? (
            <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-line/70 text-mute text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-mute" /> out of stock
            </span>
          ) : low ? (
            <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-coralBg text-coralHi text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-coral" /> only {p.stock} left
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-sageBg text-sage text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-sage" /> {p.stock} in stock
            </span>
          )}
        </div>

        <div className="mt-4">
          {qty > 0 ? (
            <div className="animate-slideIn flex items-center justify-between h-10 rounded-full bg-ink text-paper px-1.5">
              <button onClick={() => onDec(p)} className="h-8 w-8 grid place-items-center rounded-full hover:bg-paper/10 transition" aria-label="decrease">
                <Icon name="minus" size={14} />
              </button>
              <span className="text-sm tabular-nums">{qty} in cart</span>
              <button onClick={() => onInc(p)} className="h-8 w-8 grid place-items-center rounded-full hover:bg-paper/10 transition" aria-label="increase">
                <Icon name="plus" size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onAdd(p)}
              disabled={out}
              className={`w-full h-10 rounded-full text-sm font-medium transition flex items-center justify-center gap-2
                ${out ? 'bg-line/60 text-mute cursor-not-allowed' : 'bg-ink text-paper hover:bg-coral'}`}
            >
              {out ? 'notify me' : 'add to cart'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

export function Dashboard() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [recProducts, setRecProducts] = useState<Product[]>([]);

    const [category, setCategory] = useState("All categories");
    const [sort, setSort] = useState("Featured");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    
    const { cart, addToCart, incQty, decQty } = useCart();

    // Reset to page 1 whenever filters change
    useEffect(() => { setPage(1); }, [category, sort, query]);

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                const prodData = await fetchFromAPI(`/products?page=1&limit=500`);
                const isPaginated = prodData && typeof prodData === 'object' && !Array.isArray(prodData) && 'products' in prodData;
                const allProducts: Product[] = isPaginated ? prodData.products : (Array.isArray(prodData) ? prodData : []);
                setProducts(allProducts);

                // Load personalized recommendations for logged-in user
                try {
                    const userStr = localStorage.getItem('user');
                    const currentUser = userStr ? JSON.parse(userStr) : null;
                    const userId = currentUser?.userId || '1';
                    const recData = await fetchFromAPI(`/recommendations/${userId}`);
                    const recList = recData?.recommendations || [];
                    const resolved = recList
                        .map((r: any) => allProducts.find(p => String(p.id) === String(r.productId)))
                        .filter(Boolean) as Product[];
                    const seen = new Set<number>();
                    const deduped = resolved.filter(p => {
                        if (seen.has(p.id)) return false;
                        seen.add(p.id); return true;
                    }).slice(0, 6);
                    setRecProducts(deduped);
                } catch { /* recommendations are non-critical */ }
            } catch (err) {
                console.error("Failed to load products", err);
            } finally {
                setLoading(false);
            }
        };

        loadDashboardData();
    }, []);

    // filter + sort logic (Client-side to match the instant MicroShop feel)
    const filtered = useMemo(() => {
      let list = [...products];
      if (category !== "All categories") list = list.filter(p => p.category === category);
      if (query.trim()) {
        const q = query.toLowerCase();
        list = list.filter(p => p.name.toLowerCase().includes(q) || (p.note || p.category).toLowerCase().includes(q));
      }
      switch (sort) {
        case "Price: low to high": list.sort((a, b) => a.price - b.price); break;
        case "Price: high to low": list.sort((a, b) => b.price - a.price); break;
        default: break; // Featured (Default DB order)
      }
      return list;
    }, [products, category, sort, query]);

    // pagination
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = useMemo(() => {
      const start = (page - 1) * PAGE_SIZE;
      return filtered.slice(start, start + PAGE_SIZE);
    }, [filtered, page]);

    // group paginated slice by category
    const grouped = useMemo(() => {
      const m = new Map<string, Product[]>();
      paginated.forEach(p => { 
        const c = p.category || 'Uncategorized';
        if (!m.has(c)) m.set(c, []); 
        m.get(c)!.push(p); 
      });
      return Array.from(m.entries());
    }, [paginated]);

    return (
        <div>
            <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-12 pb-6">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 text-xs text-mute mb-3">
                    <span>shop</span><span>/</span><span className="text-ink">store catalog</span>
                  </div>
                  <h1 className="text-[44px] md:text-[56px] leading-[1.02] tracking-tight font-medium">store catalog</h1>
                  <p className="mt-3 text-sm text-mute">showing <span className="text-ink">{Math.min(page * PAGE_SIZE, filtered.length)}</span> of <span className="text-ink">{filtered.length}</span> products &mdash; page <span className="text-ink">{page}</span> of <span className="text-ink">{totalPages}</span></p>
                </div>
                <div className="flex items-center gap-3">
                  <Link to="/publish" className="h-11 px-5 inline-flex items-center gap-2 rounded-full bg-coral text-paper text-sm font-medium shadow-card hover:bg-coralHi hover:-translate-y-px transition">
                    <Icon name="plus" size={16} /> publish product
                  </Link>
                </div>
              </div>

              <div className="mt-9 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <PillSelect label="category" value={category} onChange={setCategory} options={CATEGORIES} />
                  <PillSelect label="sort" value={sort} onChange={setSort} options={SORTS} />
                </div>
                <div className="relative w-full md:w-72">
                  <Icon name="search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-mute" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="search products"
                    className="focus-ring h-10 w-full pl-10 pr-4 rounded-full bg-paper border border-line text-sm placeholder:text-mute"
                  />
                </div>
              </div>
            </section>

            <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-8">
              {loading ? (
                <div className="text-center py-24 border border-dashed border-line rounded-2xl">
                  <div className="text-sm text-mute">loading fresh gear...</div>
                </div>
              ) : grouped.length === 0 ? (
                <div className="text-center py-24 border border-dashed border-line rounded-2xl">
                  <div className="text-sm text-mute">no products match those filters.</div>
                  <button onClick={() => { setCategory("All categories"); setQuery(""); }}
                    className="mt-3 text-sm text-coral hover:text-coralHi">clear filters</button>
                </div>
              ) : (
                grouped.map(([cat, list]) => (
                  <div key={cat} className="mb-12">
                    <div className="flex items-end justify-between gap-4 mb-5">
                      <div className="flex items-baseline gap-3">
                        <h2 className="text-lg tracking-tight font-medium">{cat.toLowerCase()}</h2>
                        <span className="text-xs text-mute">{list.length} item{list.length === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                    <div className="h-px bg-line mb-6" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {list.map(p => (
                        <ProductCard 
                          key={p.id} 
                          p={p} 
                          qty={cart[p.id] || 0} 
                          onAdd={() => addToCart(p)} 
                          onInc={() => incQty(p)} 
                          onDec={() => decQty(p)} 
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>

            {/* Pagination controls */}
            {!loading && totalPages > 1 && (
              <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-10 flex items-center justify-center gap-2">
                <button
                  onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={page === 1}
                  className="h-9 px-4 rounded-full border border-line text-sm text-ink hover:border-ink/30 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >&larr; prev</button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
                    .reduce<(number | '...')[]>((acc, n, idx, arr) => {
                      if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('...');
                      acc.push(n); return acc;
                    }, [])
                    .map((n, i) => n === '...' ? (
                      <span key={`ellipsis-${i}`} className="w-8 text-center text-mute text-sm">&hellip;</span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => { setPage(n as number); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className={`h-9 w-9 rounded-full text-sm transition ${
                          page === n ? 'bg-ink text-paper' : 'border border-line text-ink hover:border-ink/30'
                        }`}
                      >{n}</button>
                    ))
                  }
                </div>

                <button
                  onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={page === totalPages}
                  className="h-9 px-4 rounded-full border border-line text-sm text-ink hover:border-ink/30 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >next &rarr;</button>
              </div>
            )}

            {/* Recommendations strip */}
            {recProducts.length > 0 && (
              <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-12">
                <div className="flex items-center gap-3 mb-6">
                  <Icon name="spark" size={16} className="text-coral" />
                  <h2 className="text-lg font-medium tracking-tight">Recommended for You</h2>
                  <span className="text-xs text-mute">based on your browsing</span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
                  {recProducts.map(p => (
                    <div key={p.id} className="snap-start flex-shrink-0 w-52">
                      <ProductCard
                        p={p}
                        qty={cart[p.id] || 0}
                        onAdd={() => addToCart(p)}
                        onInc={() => incQty(p)}
                        onDec={() => decQty(p)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <Newsletter />
        </div>
    );
}
