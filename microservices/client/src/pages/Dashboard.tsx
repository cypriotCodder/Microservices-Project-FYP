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

    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                // Fetch all products
                const prodData = await fetchFromAPI('/products');
                const allProducts: Product[] = Array.isArray(prodData) ? prodData : [];
                setProducts(allProducts);

                // Fetch real user recommendations
                const userStr = localStorage.getItem('user');
                const currentUser = userStr ? JSON.parse(userStr) : null;
                const currentUserId = currentUser?.userId || "1";

                const recData: RecommendationResponse = await fetchFromAPI(`/recommendations/${currentUserId}`); // Fetching for current user
                const recProductIds = recData.recommendations.map(r => r.productId);

                // Filter products that exist in recommendations
                const recProducts = allProducts.filter(p => recProductIds.includes(p._id));

                // Sort them by the order returned by the recommendation service (highest score first)
                recProducts.sort((a, b) => recProductIds.indexOf(a._id) - recProductIds.indexOf(b._id));

                setRecommendedProducts(recProducts);
            } catch (err) {
                console.error("Failed to load dashboard data", err);
            } finally {
                setLoading(false);
            }
        };

        loadDashboardData();
    }, []);

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
            // Update the local state to reflect the stock decrease immediately
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

    // Get unique categories for the dropdown
    const availableCategories = ['All', ...Array.from(new Set(products.map(p => p.category || 'Uncategorized')))];

    // Filter and Sort Logic
    let processedProducts = [...products];

    if (selectedCategory !== 'All') {
        processedProducts = processedProducts.filter(p => (p.category || 'Uncategorized') === selectedCategory);
    }

    if (sortOption === 'price-asc') {
        processedProducts.sort((a, b) => a.price - b.price);
    } else if (sortOption === 'price-desc') {
        processedProducts.sort((a, b) => b.price - a.price);
    } else if (sortOption === 'name-asc') {
        processedProducts.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOption === 'name-desc') {
        processedProducts.sort((a, b) => b.name.localeCompare(a.name));
    }

    // Group processed products by category
    const productsByCategory = processedProducts.reduce((acc, product) => {
        const cat = product.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(product);
        return acc;
    }, {} as Record<string, Product[]>);

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
                            <div style={{ marginBottom: '4rem', padding: '2rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid var(--accent-color)' }}>
                                <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-color)' }}>
                                    <span style={{ fontSize: '1.5rem' }}>✨</span> Recommended for You
                                </h2>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
                                    {recommendedProducts.map(p => <ProductCard key={`rec-${p._id}`} product={p} />)}
                                </div>
                            </div>
                        )}

                        {/* Catalog Header */}
                        <div style={{ marginTop: '2rem' }}>
                            <h1 className="page-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                                {selectedCategory === 'All' ? 'Store Catalog' : selectedCategory}
                            </h1>
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
                                Showing <span style={{ color: 'var(--text-color)', fontWeight: 'bold' }}>{processedProducts.length}</span> Product{processedProducts.length !== 1 ? 's' : ''} {products.length > processedProducts.length ? `(out of ${products.length} total)` : ''}
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
                                        onChange={(e) => setSelectedCategory(e.target.value)}
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
                                        onChange={(e) => setSortOption(e.target.value)}
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
                    </>
                )}
            </div>
        </div>
    );
}
