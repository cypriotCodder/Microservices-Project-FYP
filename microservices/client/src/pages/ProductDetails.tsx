import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchFromAPI } from '../api/client';
import { useCart, getProductId } from '../context/CartContext';
import { Icon } from '../components/Icon';

interface Product {
    _id: string;
    id: number;
    name: string;
    price: number;
    description: string;
    stock: number;
    category: string;
    image?: string;
    swatch?: string;
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
    id?: number;
    _id?: string;
    userId: string;
    content: string;
    createdAt: string;
}

const Placeholder = ({ swatch = "#E8DCC8" }: { swatch?: string }) => (
    <div className="w-full h-full swatch-stripe" style={{ backgroundColor: swatch }} />
);

export default function ProductDetails() {
    const { id } = useParams<{ id: string }>();
    const [product, setProduct] = useState<Product | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [summary, setSummary] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    
    const [commentText, setCommentText] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    const [showReviewForm, setShowReviewForm] = useState(false);
    const [reviewTitle, setReviewTitle] = useState('');
    const [reviewContent, setReviewContent] = useState('');
    const [reviewRating, setReviewRating] = useState(0);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    const { cart, addToCart, incQty, decQty } = useCart();

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const prodData = await fetchFromAPI(`/products/${id}`);
                setProduct(prodData);
                const reviewData = await fetchFromAPI(`/products/${id}/reviews`);
                setReviews(Array.isArray(reviewData) ? reviewData : []);

                try {
                    const commentData = await fetchFromAPI(`/products/${id}/comments`);
                    setComments(Array.isArray(commentData) ? commentData : []);
                } catch {}

                const userStr = localStorage.getItem('user');
                const currentUser = userStr ? JSON.parse(userStr) : null;
                const currentUserId = currentUser?.userId || "1";

                fetchFromAPI('/recommendations/click', {
                    method: 'POST',
                    body: JSON.stringify({ userId: currentUserId, productId: id })
                }).catch(() => {});

            } catch (err) {
                console.error(err);
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

    const handleReview = async () => {
        if (!reviewTitle.trim() || !reviewContent.trim() || reviewRating === 0 || !product) return;
        setIsSubmittingReview(true);
        try {
            const userStr = localStorage.getItem('user');
            const currentUser = userStr ? JSON.parse(userStr) : null;
            const userId = currentUser?.userId || currentUser?.username || 'anonymous';

            const response = await fetchFromAPI(`/products/${id}/reviews`, {
                method: 'POST',
                body: JSON.stringify({
                    userId: String(userId),
                    title: reviewTitle.trim(),
                    content: reviewContent.trim(),
                    rating: reviewRating
                })
            });

            const newReview = response.review || response.data || response;
            setReviews(prev => [{ ...newReview, _id: newReview._id || newReview.id || Date.now().toString() }, ...prev]);
            setReviewTitle('');
            setReviewContent('');
            setReviewRating(0);
            setShowReviewForm(false);
        } catch (e: any) {
            alert('Failed to post review: ' + e.message);
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleComment = async () => {
        if (!commentText.trim() || !product) return;
        setIsSubmittingComment(true);
        try {
            const userStr = localStorage.getItem('user');
            const currentUser = userStr ? JSON.parse(userStr) : null;
            const userId = currentUser?.userId || '1';

            await fetchFromAPI(`/products/${id}/comments`, {
                method: 'POST',
                body: JSON.stringify({ userId, content: commentText.trim() })
            });

            const now = new Date().toISOString();
            setComments(prev => [{ userId, content: commentText.trim(), createdAt: now }, ...prev]);
            setCommentText('');
        } catch (e: any) {
            alert('Failed to post comment: ' + e.message);
        } finally {
            setIsSubmittingComment(false);
        }
    };

    if (loading) return <div className="text-center py-32 text-mute">loading product details...</div>;
    if (!product) return <div className="text-center py-32 text-coralHi">product not found</div>;

    const out = product.stock === 0;
    const qty = cart[getProductId(product)] || 0;

    return (
        <article className="max-w-7xl mx-auto px-6 lg:px-10 py-12 animate-slideIn">
            <div className="flex items-center gap-2 text-xs text-mute mb-8">
                <Link to="/" className="hover:text-ink transition">store catalog</Link>
                <span>/</span>
                <span className="text-ink">{product.name.toLowerCase()}</span>
            </div>

            <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
                {/* Left: Image */}
                <div className="aspect-square rounded-3xl overflow-hidden bg-paper shadow-cardHi border border-line">
                    <Placeholder swatch={product.swatch} />
                </div>

                {/* Right: Info */}
                <div className="flex flex-col justify-center">
                    <div className="mb-2 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-paper border border-line text-[11px] font-medium tracking-wide uppercase text-mute shadow-card">
                        {product.category || 'Uncategorized'}
                    </div>
                    <h1 className="text-4xl lg:text-5xl tracking-tight font-medium mb-4">{product.name}</h1>
                    <div className="text-2xl text-coral font-medium tabular-nums mb-6">${product.price.toFixed(2)}</div>

                    <div className="flex items-center gap-2 mb-8">
                        {out ? (
                            <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-line/70 text-mute text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-mute" /> out of stock
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-sageBg text-sage text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-sage" /> {product.stock} in stock
                            </span>
                        )}
                    </div>

                    <div className="text-mute text-sm leading-relaxed mb-10">
                        {product.description || 'No description provided for this product.'}
                    </div>

                    <div className="pt-8 border-t border-line">
                        {qty > 0 ? (
                            <div className="animate-slideIn flex items-center justify-between h-14 rounded-full bg-ink text-paper px-2 max-w-[240px]">
                                <button onClick={() => decQty(product)} className="h-10 w-10 grid place-items-center rounded-full hover:bg-paper/10 transition">
                                    <Icon name="minus" size={16} />
                                </button>
                                <span className="text-sm tabular-nums font-medium">{qty} in cart</span>
                                <button onClick={() => incQty(product)} className="h-10 w-10 grid place-items-center rounded-full hover:bg-paper/10 transition">
                                    <Icon name="plus" size={16} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => addToCart(product)}
                                disabled={out}
                                className={`h-14 px-8 rounded-full text-sm font-medium transition flex items-center justify-center gap-2 w-full max-w-[240px] shadow-card
                                    ${out ? 'bg-line/60 text-mute cursor-not-allowed' : 'bg-ink text-paper hover:bg-coral'}`}
                            >
                                {out ? 'notify me' : 'add to cart'} <Icon name="right" size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Sections */}
            <div className="mt-24 grid lg:grid-cols-[1fr_400px] gap-12 lg:gap-20">
                
                {/* Comments & Reviews */}
                <div>
                    {/* Reviews */}
                    <div className="mb-16">
                        <div className="flex items-end justify-between border-b border-line pb-4 mb-6">
                            <h3 className="text-xl tracking-tight font-medium">Customer Reviews <span className="text-mute text-base">({reviews.length})</span></h3>
                            <button onClick={() => setShowReviewForm(!showReviewForm)} className="text-sm font-medium text-coral hover:text-coralHi transition">
                                {showReviewForm ? 'cancel' : 'write a review'}
                            </button>
                        </div>

                        {showReviewForm && (
                            <div className="p-6 rounded-2xl bg-paper shadow-card border border-line mb-8 animate-fadeIn">
                                <div className="mb-4">
                                    <label className="block text-[11px] uppercase tracking-wider text-mute mb-2">Rating</label>
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button key={star} onClick={() => setReviewRating(star)} className="p-1 hover:scale-110 transition">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill={reviewRating >= star ? "#E07A5F" : "none"} stroke={reviewRating >= star ? "#E07A5F" : "currentColor"} strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <label className="block text-[11px] uppercase tracking-wider text-mute mb-2">Title</label>
                                    <input value={reviewTitle} onChange={e => setReviewTitle(e.target.value)} placeholder="Sum up your experience..." className="focus-ring w-full h-11 px-4 rounded-xl bg-paper border border-line text-sm placeholder:text-mute" />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-[11px] uppercase tracking-wider text-mute mb-2">Review</label>
                                    <textarea value={reviewContent} onChange={e => setReviewContent(e.target.value)} placeholder="Share your thoughts..." rows={4} className="focus-ring w-full p-4 rounded-xl bg-paper border border-line text-sm placeholder:text-mute resize-y" />
                                </div>
                                <button onClick={handleReview} disabled={isSubmittingReview || !reviewTitle || !reviewContent || !reviewRating} className="h-10 px-6 rounded-full bg-ink text-paper text-sm font-medium hover:bg-coral transition disabled:opacity-50">
                                    {isSubmittingReview ? 'Posting...' : 'Submit Review'}
                                </button>
                            </div>
                        )}

                        <div className="space-y-4">
                            {reviews.length === 0 ? (
                                <p className="text-sm text-mute">No reviews yet. Be the first to leave a review!</p>
                            ) : (
                                reviews.map(r => (
                                    <div key={r._id} className="p-5 rounded-2xl bg-paper border border-line shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1 text-coral">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i < r.rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                                ))}
                                            </div>
                                            <span className="text-xs text-mute">{new Date(r.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <h4 className="font-medium text-sm mb-1">{r.title}</h4>
                                        <p className="text-sm text-mute leading-relaxed mb-3">{r.content}</p>
                                        <div className="text-[11px] font-medium tracking-wide uppercase text-mute">By {r.userId}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Comments */}
                    <div>
                        <div className="border-b border-line pb-4 mb-6">
                            <h3 className="text-xl tracking-tight font-medium">Discussion <span className="text-mute text-base">({comments.length})</span></h3>
                        </div>

                        <div className="mb-8 relative">
                            <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Ask a question or leave a comment..." rows={3} className="focus-ring w-full p-4 pb-14 rounded-2xl bg-paper border border-line text-sm placeholder:text-mute resize-y" />
                            <button onClick={handleComment} disabled={isSubmittingComment || !commentText} className="absolute right-3 bottom-3 h-8 px-4 rounded-full bg-ink text-paper text-xs font-medium hover:bg-coral transition disabled:opacity-50">
                                Post
                            </button>
                        </div>

                        <div className="space-y-4">
                            {comments.map((c, i) => (
                                <div key={c.id || c._id || i} className="p-4 rounded-2xl bg-paper border border-line">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-coralHi">User {c.userId}</span>
                                        <span className="text-xs text-mute">{new Date(c.createdAt).toLocaleString()}</span>
                                    </div>
                                    <p className="text-sm text-mute">{c.content}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: AI Summary Column */}
                <div>
                    <div className="sticky top-24 p-6 rounded-3xl bg-coralBg/40 border border-coral/10">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-medium flex items-center gap-2 text-coralHi">
                                <Icon name="spark" size={16} /> AI Summary
                            </h3>
                        </div>
                        
                        {summary ? (
                            <p className="text-sm text-ink/80 leading-relaxed bg-paper/60 p-4 rounded-2xl border border-coral/20">
                                {summary}
                            </p>
                        ) : (
                            <div className="text-center">
                                <p className="text-sm text-coralHi/70 mb-4">
                                    Too long? Ask our AI to concisely read and summarize the product description for you.
                                </p>
                                <button
                                    onClick={handleSummarize}
                                    disabled={isSummarizing || !product?.description}
                                    className="w-full h-10 rounded-full bg-coralBg text-coralHi text-sm font-medium hover:bg-coral/10 transition border border-coral/20 disabled:opacity-50"
                                >
                                    {isSummarizing ? 'Summarizing...' : 'Generate Summary'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </article>
    );
}
