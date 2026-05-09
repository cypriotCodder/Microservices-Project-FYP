import { useEffect, useState } from 'react';
import { fetchFromAPI } from '../api/client';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

interface OrderProduct {
    productId: string;
    quantity: number;
}

interface Order {
    _id?: string;
    id?: number;
    totalAmount: number;
    status: string;
    products?: OrderProduct[];
    items?: any[];
    createdAt: string;
}

export function Orders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [productCache, setProductCache] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        const currentUser = userStr ? JSON.parse(userStr) : null;
        const currentUserId = currentUser?.userId || "1";

        fetchFromAPI(`/orders/${currentUserId}`)
            .then(async (data) => {
                const fetchedOrders = Array.isArray(data) ? data : [];
                setOrders(fetchedOrders);
                
                const productIds = new Set<string>();
                fetchedOrders.forEach((o: Order) => {
                    const itemsList = o.products || o.items || [];
                    itemsList.forEach((p: any) => productIds.add(String(p.productId)));
                });
                
                const newCache: Record<string, string> = {};
                await Promise.all(Array.from(productIds).map(async (id) => {
                    try {
                        const p = await fetchFromAPI(`/products/${id}`);
                        newCache[id] = p.name;
                    } catch (e) {
                        newCache[id] = 'Unknown Product';
                    }
                }));
                
                setProductCache(prev => ({ ...prev, ...newCache }));
            })
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const handleBuy = async (orderId: string) => {
        try {
            await fetchFromAPI(`/orders/${orderId}/buy`, { method: 'POST' });
            setOrders(prevOrders => prevOrders.map(o => 
                getOrderId(o) === orderId ? { ...o, status: 'COMPLETED' } : o
            ));
        } catch (err) {
            alert('Failed to complete checkout');
        }
    };

    const getOrderId = (order: Order): string => String(order._id || order.id || '');

    const handleDelete = async (orderId: string) => {
        if (!confirm('Cancel this order? Stock will be refunded.')) return;
        try {
            await fetchFromAPI(`/orders/${orderId}`, { method: 'DELETE' });
            setOrders(prevOrders => prevOrders.filter(o => getOrderId(o) !== orderId));
        } catch (err) {
            alert('Failed to cancel order');
        }
    };

    const handleDeleteAll = async () => {
        if (orders.length === 0) return;
        if (!confirm('Cancel ALL your orders? Stock will be refunded.')) return;
        try {
            const userStr = localStorage.getItem('user');
            const currentUser = userStr ? JSON.parse(userStr) : null;
            const currentUserId = currentUser?.userId || "1";

            await fetchFromAPI(`/orders/all/${currentUserId}`, { method: 'DELETE' });
            setOrders([]);
        } catch (err) {
            alert('Failed to cancel all orders');
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10 animate-slideIn">
                <div>
                    <div className="flex items-center gap-2 text-xs text-mute mb-3">
                        <span>account</span><span>/</span><span className="text-ink">order history</span>
                    </div>
                    <h1 className="text-4xl tracking-tight font-medium">Your Orders</h1>
                </div>
                {orders.length > 0 && (
                    <button
                        onClick={handleDeleteAll}
                        className="h-10 px-4 rounded-full bg-coralBg text-coralHi text-sm font-medium hover:bg-coral/20 transition flex items-center gap-2 border border-coral/10"
                    >
                        <Icon name="x" size={14} /> Clear All Orders
                    </button>
                )}
            </div>

            <div className="rounded-3xl bg-paper shadow-card border border-line overflow-hidden animate-slideIn" style={{ animationDelay: '0.1s' }}>
                {loading ? (
                    <div className="p-12 text-center text-sm text-mute">Loading orders...</div>
                ) : orders.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-sageBg mx-auto grid place-items-center text-sage mb-4">
                            <Icon name="check" size={24} />
                        </div>
                        <h3 className="text-lg font-medium tracking-tight mb-2">No orders found</h3>
                        <p className="text-sm text-mute mb-6">Looks like you haven't placed any orders yet.</p>
                        <Link to="/" className="h-10 px-6 inline-flex items-center rounded-full bg-ink text-paper text-sm font-medium hover:bg-coral transition">
                            Start Shopping
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-sageBg/50 border-b border-line">
                                <tr>
                                    <th className="font-medium text-mute px-6 py-4">Order ID</th>
                                    <th className="font-medium text-mute px-6 py-4">Date</th>
                                    <th className="font-medium text-mute px-6 py-4">Amount</th>
                                    <th className="font-medium text-mute px-6 py-4">Items</th>
                                    <th className="font-medium text-mute px-6 py-4">Status</th>
                                    <th className="font-medium text-mute px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {orders.map((order) => {
                                    const oid = getOrderId(order);
                                    const isPending = order.status.toUpperCase() === 'PENDING';
                                    return (
                                    <tr key={oid} className="hover:bg-line/20 transition">
                                        <td className="px-6 py-4 font-mono text-xs text-mute">#{oid.substring(0, 8)}</td>
                                        <td className="px-6 py-4">{new Date(order.createdAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 font-medium tabular-nums">${order.totalAmount.toFixed(2)}</td>
                                        <td className="px-6 py-4">
                                            {(order.products || order.items || []).map((p: any, idx: number) => (
                                                <div key={idx} className="flex items-center gap-2 mb-1 last:mb-0">
                                                    <span className="text-xs text-mute tabular-nums">{p.quantity}x</span>
                                                    <Link to={`/product/${p.productId}`} className="hover:text-coral transition hover:underline">
                                                        {productCache[String(p.productId)] || 'Loading...'}
                                                    </Link>
                                                </div>
                                            ))}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-medium tracking-wide
                                                ${isPending ? 'bg-coralBg text-coralHi border border-coral/20' : 'bg-sageBg text-sage border border-sage/20'}
                                            `}>
                                                {order.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {isPending && (
                                                    <button onClick={() => handleBuy(oid)} className="h-8 px-3 rounded-full bg-ink text-paper text-xs font-medium hover:bg-sage transition">
                                                        Pay Now
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(oid)} className="h-8 w-8 grid place-items-center rounded-full text-mute hover:bg-coralBg hover:text-coralHi transition border border-transparent hover:border-coral/20" title="Cancel Order">
                                                    <Icon name="x" size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
