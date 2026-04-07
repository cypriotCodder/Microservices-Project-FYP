import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { fetchFromAPI } from '../api/client';
import { Sparkles, PackageCheck, AlertCircle, MessageSquare, Send } from 'lucide-react';
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

interface Comment {
    _id?: string;
    id?: number;
    userId: string;
    content: string;
    createdAt: string;
}

export default function ProductDetails() {
    const { id } = useParams<{ id: string }>();
    const [product, setProduct] = useState<Product | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [commentText, setCommentText] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [commentFeedback, setCommentFeedback] = useState<{ type: 'queued' | 'saved' | 'error'; msg: string } | null>(null);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const prodData = await fetchFromAPI(`/products/${id}`);
                setProduct(prodData);
                const reviewData = await fetchFromAPI(`/products/${id}/reviews`);
                setReviews(Array.isArray(reviewData) ? reviewData : []);

                // Comments fetch is independent — don't let it crash the product load
                // (the GET /comments endpoint may not exist in older container builds)
                try {
                    const commentData = await fetchFromAPI(`/products/${id}/comments`);
                    setComments(Array.isArray(commentData) ? commentData : []);
                } catch {
                    // Silently ignore — comments section shows empty
                }

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

            // This hits the API Gateway which forwards to the LLM service
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

    const handleComment = async () => {
        if (!commentText.trim() || !product) return;
        setIsSubmittingComment(true);
        setCommentFeedback(null);
        try {
            const userStr = localStorage.getItem('user');
            const currentUser = userStr ? JSON.parse(userStr) : null;
            const userId = currentUser?.userId || '1';

            await fetchFromAPI(`/products/${id}/comments`, {
                method: 'POST',
                body: JSON.stringify({ userId, content: commentText.trim() })
            });

            setCommentFeedback({
                type: 'queued',
                msg: '✓ Comment queued via RabbitMQ — will appear when the worker processes it.'
            });
            setCommentText('');

            // Re-fetch comments after a short delay to allow worker to process
            setTimeout(async () => {
                const updated = await fetchFromAPI(`/products/${id}/comments`);
                setComments(Array.isArray(updated) ? updated : []);
            }, 1500);
        } catch (e: any) {
            setCommentFeedback({ type: 'error', msg: 'Failed to post comment: ' + e.message });
        } finally {
            setIsSubmittingComment(false);
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

                        {/* Comments Section */}
                        <div style={{ marginTop: '2rem' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <MessageSquare size={18} /> Comments ({comments.length})
                            </h3>

                            {/* Submit form */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', background: 'var(--card-bg)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                <textarea
                                    id="comment-input"
                                    value={commentText}
                                    onChange={e => setCommentText(e.target.value)}
                                    placeholder="Leave a comment..."
                                    rows={3}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-color)', resize: 'vertical', fontSize: '0.95rem', boxSizing: 'border-box' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    {commentFeedback && (
                                        <span style={{ fontSize: '0.85rem', color: commentFeedback.type === 'error' ? 'var(--error)' : '#37872D', fontStyle: 'italic' }}>
                                            {commentFeedback.msg}
                                        </span>
                                    )}
                                    <button
                                        id="submit-comment-btn"
                                        className="btn"
                                        onClick={handleComment}
                                        disabled={isSubmittingComment || !commentText.trim()}
                                        style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.2rem', fontSize: '0.9rem', opacity: (!commentText.trim() || isSubmittingComment) ? 0.6 : 1 }}
                                    >
                                        <Send size={14} />
                                        {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                                    </button>
                                </div>
                            </div>

                            {/* Comment list */}
                            {comments.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {comments.map((c, i) => (
                                        <div key={c._id || i} style={{ padding: '0.85rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-color)' }}>User {c.userId}</span>
                                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{new Date(c.createdAt).toLocaleString()}</span>
                                            </div>
                                            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.4', fontSize: '0.92rem' }}>{c.content}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No comments yet. Be the first!</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
