import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { fetchFromAPI } from '../api/client';
import '../styles/main.css';

interface Product {
    _id: string;
    name: string;
    price: number;
    stock: number;
    category: string;
    image?: string;
}

interface RecommendationResponse {
    userId: string;
    recommendations: { productId: string; score: number }[];
}

export function Dashboard() {
    const [products, setProducts] = useState<Product[]>([]);
    const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [sortOption, setSortOption] = useState<string>('default');
    
    // Pagination states
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [totalProducts, setTotalProducts] = useState<number>(0);
    const limit = 12; // Items per page

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                // Fetch paginated products correctly using query params
                const prodData = await fetchFromAPI(`/products?page=${currentPage}&limit=${limit}&category=${encodeURIComponent(selectedCategory)}&sort=${sortOption}`);
                
                // If it's the new paginated structure, extract products
                const isPaginated = prodData && typeof prodData === 'object' && !Array.isArray(prodData) && 'products' in prodData;
                const allProducts: Product[] = isPaginated ? prodData.products : (Array.isArray(prodData) ? prodData : []);
                
                setProducts(allProducts);
                if (isPaginated) {
                    setTotalPages(prodData.totalPages);
                    setTotalProducts(prodData.total);
                } else {
                    setTotalPages(1);
                    setTotalProducts(allProducts.length);
                }

                // Fetch real user recommendations
                const userStr = localStorage.getItem('user');
                const currentUser = userStr ? JSON.parse(userStr) : null;
                const currentUserId = currentUser?.userId || "1";

                const recData: RecommendationResponse = await fetchFromAPI(`/recommendations/${currentUserId}`); // Fetching for current user
                const recProductIds = recData.recommendations.map(r => r.productId);

                // Re-fetch these specific products since our paginated view might not have them
                let recProducts = allProducts.filter(p => recProductIds.includes(p._id));

                if (recProducts.length === 0 && allProducts.length >= 3) {
                    recProducts = allProducts.slice(0, 3);
                } else if (recProducts.length > 0) {
                    recProducts.sort((a, b) => recProductIds.indexOf(a._id) - recProductIds.indexOf(b._id));
                }

                setRecommendedProducts(recProducts);
            } catch (err) {
                console.error("Failed to load dashboard data", err);
            } finally {
                setLoading(false);
            }
        };

        loadDashboardData();
    }, [currentPage, selectedCategory, sortOption]); // Trigger automatically when filters change

    // Automatically scroll to top gracefully whenever the page index skips
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentPage]);

    const handleOrder = async (product: Product) => {
        try {
            const userStr = localStorage.getItem('user');
            const currentUser = userStr ? JSON.parse(userStr) : null;
            const currentUserId = currentUser?.userId || "1";

            await fetchFromAPI('/orders', {
                method: 'POST',
                body: JSON.stringify({
                    userId: currentUserId,
                    totalAmount: product.price,
                    products: [{ productId: product._id, quantity: 1 }]
                })
            });
            setProducts(prevProducts =>
                prevProducts.map(p =>
                    p._id === product._id ? { ...p, stock: p.stock - 1 } : p
                )
            );
            alert('Order placed successfully!');
        } catch (e) {
            alert('Failed to place order');
        }
    };

    // Hardcode core categories to support DB pagination seamlessly
    const availableCategories = ['All', 'Load Test', 'Electronics', 'Clothing', 'Home', 'Books', 'Toys', 'Sports', 'Other'];

    // All sorting and filtering is now managed by the backend
    const processedProducts = products;

    // Group processed products by category for the masonry layout
    const productsByCategory = processedProducts.reduce((acc, product) => {
        const cat = product.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(product);
        return acc;
    }, {} as Record<string, Product[]>);

    const CompactProductCard = ({ product }: { product: Product }) => (
        <div key={`compact-${product._id}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
            <Link to={`/product/${product._id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(45deg, #222, #333)',
                    backgroundImage: product.image ? `url(${product.image})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6rem',
                    color: '#666'
                }}>
                    {!product.image && 'IMG'}
                </div>
            </Link>
            <div style={{ flex: 1 }}>
                <Link to={`/product/${product._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.25rem 0', fontWeight: 600, color: 'var(--text-color)' }}>{product.name}</h3>
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                    <span style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '0.9rem' }}>${product.price}</span>
                    <button 
                        onClick={() => handleOrder(product)}
                        disabled={product.stock === 0}
                        style={{ background: 'transparent', border: 'none', color: product.stock > 0 ? 'var(--text-color)' : '#555', cursor: product.stock > 0 ? 'pointer' : 'not-allowed', fontSize: '1.2rem', padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Quick Add"
                    >
                        +
                    </button>
                </div>
            </div>
        </div>
    );

    const ProductCard = ({ product }: { product: Product }) => (
        <div key={product._id} className="card">
            <Link to={`/product/${product._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{
                    height: '150px',
                    background: 'linear-gradient(45deg, #333, #444)',
                    backgroundImage: product.image ? `url(${product.image})` : 'linear-gradient(45deg, #333, #444)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666'
                }}>
                    {!product.image && 'Product Image'}
                </div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{product.name}</h3>
            </Link>
            <p style={{ color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                ${product.price}
            </p>
            <p style={{ color: product.stock > 0 ? '#4caf50' : '#f44336', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                {product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock'}
            </p>
            <button
                className="btn"
                style={{ width: '100%', opacity: product.stock > 0 ? 1 : 0.5, cursor: product.stock > 0 ? 'pointer' : 'not-allowed' }}
                onClick={() => handleOrder(product)}
                disabled={product.stock === 0}
            >
                {product.stock > 0 ? 'Add to Cart' : 'Sold Out'}
            </button>
        </div>
    );

    return (
        <div>
            <Navbar />
            <div className="container">
                {loading ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>Loading fresh gear...</div>
                ) : (
                    <>
                        {/* Recommendations Section */}
                        {recommendedProducts.length > 0 && selectedCategory === 'All' && (
                            <div style={{ marginBottom: '4rem', marginTop: '2rem' }}>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: 500, marginBottom: '1.5rem', color: 'var(--text-color)', letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.7 }}>
                                    Recommended for You
                                </h2>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                                    {recommendedProducts.map(p => <CompactProductCard key={`rec-${p._id}`} product={p} />)}
                                </div>
                            </div>
                        )}

                        {/* Catalog Header */}
                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h1 className="page-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                                {selectedCategory === 'All' ? 'Store Catalog' : selectedCategory}
                            </h1>
                            <Link to="/publish" className="btn" style={{ textDecoration: 'none', padding: '0.6rem 1.2rem', backgroundColor: 'var(--accent-color)', color: '#fff', borderRadius: '4px', fontWeight: 'bold' }}>
                                + Publish Product
                            </Link>
                        </div>

                        {/* Control Bar: Categories, Sorting, and Item Count */}
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '2.5rem',
                            paddingBottom: '1rem',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            gap: '1rem'
                        }}>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                Showing <span style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>{products.length}</span> Product{products.length !== 1 ? 's' : ''} {totalProducts > products.length ? `(out of ${totalProducts} total)` : ''}
                            </div>

                            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category:</span>
                                    <select
                                        style={{
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                                            color: 'var(--text-color)',
                                            fontSize: '0.95rem',
                                            padding: '0.25rem 0.5rem 0.25rem 0',
                                            cursor: 'pointer',
                                            outline: 'none',
                                            transition: 'border-color 0.2s',
                                        }}
                                        onFocus={(e) => e.target.style.borderBottom = '1px solid var(--accent-color)'}
                                        onBlur={(e) => e.target.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)'}
                                        value={selectedCategory}
                                        onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                                    >
                                        {availableCategories.map(cat => (
                                            <option key={cat} value={cat} style={{ backgroundColor: 'var(--bg-color)', color: 'white' }}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sort:</span>
                                    <select
                                        style={{
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                                            color: 'var(--text-color)',
                                            fontSize: '0.95rem',
                                            padding: '0.25rem 0.5rem 0.25rem 0',
                                            cursor: 'pointer',
                                            outline: 'none',
                                            transition: 'border-color 0.2s',
                                        }}
                                        onFocus={(e) => e.target.style.borderBottom = '1px solid var(--accent-color)'}
                                        onBlur={(e) => e.target.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)'}
                                        value={sortOption}
                                        onChange={(e) => { setSortOption(e.target.value); setCurrentPage(1); }}
                                    >
                                        <option value="default" style={{ backgroundColor: 'var(--bg-color)', color: 'white' }}>Featured</option>
                                        <option value="name-asc" style={{ backgroundColor: 'var(--bg-color)', color: 'white' }}>Name: A-Z</option>
                                        <option value="name-desc" style={{ backgroundColor: 'var(--bg-color)', color: 'white' }}>Name: Z-A</option>
                                        <option value="price-asc" style={{ backgroundColor: 'var(--bg-color)', color: 'white' }}>Price: Low to High</option>
                                        <option value="price-desc" style={{ backgroundColor: 'var(--bg-color)', color: 'white' }}>Price: High to Low</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Categories Section */}
                        {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
                            <div key={category} style={{ marginBottom: '3rem' }}>
                                {selectedCategory === 'All' && (
                                    <h2 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', color: 'var(--text-color)', opacity: 0.9 }}>
                                        {category}
                                    </h2>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
                                    {categoryProducts.map((product) => <ProductCard key={product._id} product={product} />)}
                                </div>
                            </div>
                        ))}

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '4rem', marginBottom: '2rem' }}>
                                <button 
                                    className="btn" 
                                    disabled={currentPage === 1} 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    style={{ opacity: currentPage === 1 ? 0.5 : 1, padding: '0.5rem 1rem' }}
                                >
                                    &laquo; Prev
                                </button>
                                
                                <select 
                                    value={currentPage}
                                    onChange={(e) => setCurrentPage(Number(e.target.value))}
                                    style={{
                                        backgroundColor: 'transparent',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        color: 'var(--text-color)',
                                        fontSize: '0.95rem',
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        fontWeight: 500
                                    }}
                                >
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                                        <option key={pageNum} value={pageNum} style={{ backgroundColor: 'var(--bg-color)', color: 'white' }}>
                                            Page {pageNum} of {totalPages}
                                        </option>
                                    ))}
                                </select>
                                
                                <button 
                                    className="btn" 
                                    disabled={currentPage === totalPages} 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    style={{ opacity: currentPage === totalPages ? 0.5 : 1, padding: '0.5rem 1rem' }}
                                >
                                    Next &raquo;
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
