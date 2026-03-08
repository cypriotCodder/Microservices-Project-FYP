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
    image?: string;
}

export function Dashboard() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFromAPI('/products')
            .then((data) => {
                // data could be an array or object depending on implementation, ensuring array
                setProducts(Array.isArray(data) ? data : []);
            })
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const handleOrder = async (product: Product) => {
        try {
            await fetchFromAPI('/orders', {
                method: 'POST',
                body: JSON.stringify({
                    userId: "1", // Hardcoded user for now
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

    return (
        <div>
            <Navbar />
            <div className="container">
                <h1 className="page-title">Featured Products</h1>
                {loading ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading fresh gear...</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
                        {products.map((product) => (
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
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
