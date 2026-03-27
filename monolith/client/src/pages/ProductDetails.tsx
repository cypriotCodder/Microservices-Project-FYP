import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { fetchFromAPI } from '../api/client';
import { Sparkles, PackageCheck, AlertCircle } from 'lucide-react';
import '../styles/main.css';

interface Product {
    _id: string;
    name: string;
    price: number;
    description: string;
    stock: number;
    image?: string;
}

interface Review {
    _id: string;
    userId: string;
    title: string;
    content: string;
    rating: number;
    createdAt: string;
}

export default function ProductDetails() {
    const { id } = useParams<{ id: string }>();
    const [product, setProduct] = useState<Product | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const prodData = await fetchFromAPI(`/products/${id}`);
                setProduct(prodData);
                const reviewData = await fetchFromAPI(`/products/${id}/reviews`);
                setReviews(Array.isArray(reviewData) ? reviewData : []);

                // Track product view/click for recommendations
                const userStr = localStorage.getItem('user');
                const currentUser = userStr ? JSON.parse(userStr) : null;
                const currentUserId = currentUser?.userId || "1";

                fetchFromAPI('/recommendations/click', {
                    method: 'POST',
                    body: JSON.stringify({ userId: currentUserId, productId: id })
                }).catch(err => console.error("Could not track click:", err));

            } catch (err: any) {
                setError(err.message || 'Failed to fetch product details.');
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id]);

    const handleSummarize = async () => {
        setIsSummarizing(true);
        try {
            const payloadText = `Product Name: ${product?.name}\n\nProduct Full Description: ${product?.description || 'No description available.'}`;

            // This hits the monolith backend which natively triggers its own LLM integration
            const response = await fetchFromAPI('/llm/summarize', {
                method: 'POST',
                body: JSON.stringify({ text: payloadText })
            });
            setSummary(response.summary);
        } catch (err: any) {
            alert('Failed to summarize text: ' + err.message);
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleOrder = async () => {
        if (!product) return;
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
            setProduct(prevProduct =>
                prevProduct ? { ...prevProduct, stock: prevProduct.stock - 1 } : null
            );
            alert('Order placed successfully!');
        } catch (e) {
            alert('Failed to place order');
        }
    };

    if (loading) return <div><Navbar /><div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div></div>;
    if (error || !product) return <div><Navbar /><div className="container" style={{ textAlign: 'center', color: 'red', marginTop: '50px' }}>{error || 'Product not found'}</div></div>;

    return (
        <div>
            <Navbar />
            <div className="container" style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1rem' }}>
                <div style={{ display: 'flex', gap: '3rem', flexDirection: 'row', flexWrap: 'wrap' }}>

                    {/* Left Column: Product Info */}
                    <div style={{ flex: '1 1 400px' }}>
                        <div style={{
                            height: '300px',
                            background: 'linear-gradient(45deg, #333, #444)',
                            backgroundImage: product.image ? `url(${product.image})` : 'linear-gradient(45deg, #333, #444)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            borderRadius: '12px',
                            marginBottom: '2rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#666',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}>
                            {!product.image && 'No Image Available'}
                        </div>
                        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--text-color)' }}>{product.name}</h1>
                        <p style={{ fontSize: '1.5rem', color: 'var(--accent-color)', fontWeight: 'bold', marginBottom: '1rem' }}>${product.price}</p>

                        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: product.stock > 0 ? 'var(--success)' : 'var(--error)' }}>
                            {product.stock > 0 ? <PackageCheck size={20} /> : <AlertCircle size={20} />}
                            <span style={{ fontSize: '1.1rem' }}>{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</span>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Description</h3>
                            <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                {product.description || 'No description provided for this product.'}
                            </p>
                        </div>

                        <button
                            className="btn"
                            style={{
                                width: '100%',
                                padding: '1rem',
                                fontSize: '1.1rem',
                                fontWeight: 'bold',
                                opacity: product.stock > 0 ? 1 : 0.5,
                                cursor: product.stock > 0 ? 'pointer' : 'not-allowed'
                            }}
                            onClick={handleOrder}
                            disabled={product.stock === 0}
                        >
                            {product.stock > 0 ? 'Add to Cart' : 'Sold Out'}
                        </button>
                    </div>

                    {/* Right Column: AI Summary & Reviews */}
                    <div style={{ flex: '1 1 400px' }}>
                        <div style={{
                            background: 'var(--card-bg)',
                            padding: '1.5rem',
                            borderRadius: '12px',
                            marginBottom: '2rem',
                            border: '1px solid var(--border-color)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                    <Sparkles size={20} color="#6366f1" /> AI Summary
                                </h3>
                                <button
                                    className="btn btn-summarize"
                                    onClick={handleSummarize}
                                    disabled={isSummarizing || !product?.description}
                                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', opacity: (isSummarizing || !product?.description) ? 0.8 : 1, backgroundColor: '#6366f1', border: 'none' }}
                                >
                                    {isSummarizing ? 'Summarizing...' : 'Summarize details'}
                                </button>
                            </div>

                            {summary ? (
                                <p style={{ fontStyle: 'italic', color: 'var(--text-color)', lineHeight: '1.5', background: 'rgba(99, 102, 241, 0.1)', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid var(--accent-color)' }}>
                                    "{summary}"
                                </p>
                            ) : (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                    Click 'Summarize' to ask our AI to concisely read and summarize the product description.
                                </p>
                            )}
                        </div>

                        <div>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                                Customer Reviews ({reviews.length})
                            </h3>
                            {reviews.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {reviews.map(review => (
                                        <div key={review._id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <span style={{ fontWeight: 'bold' }}>{'⭐'.repeat(review.rating)}</span>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                    {new Date(review.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            {review.title && <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', color: 'var(--text-color)' }}>{review.title}</h4>}
                                            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.4' }}>{review.content}</p>
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>User: {review.userId}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ color: 'var(--text-secondary)' }}>No reviews yet. Be the first to leave a review!</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
