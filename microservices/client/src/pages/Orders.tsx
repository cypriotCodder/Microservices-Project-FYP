import { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { fetchFromAPI } from '../api/client';
import { Link } from 'react-router-dom';
import '../styles/main.css';

interface OrderProduct {
    productId: string;
    quantity: number;
}

interface Order {
    _id: string;
    totalAmount: number;
    status: string;
    products: OrderProduct[];
    createdAt: string;
}

export function Orders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [productCache, setProductCache] = useState<Record<string, string>>({});

    useEffect(() => {
        const userStr = localStorage.getItem('user');
        const currentUser = userStr ? JSON.parse(userStr) : null;
        const currentUserId = currentUser?.userId || "1";

        fetchFromAPI(`/orders/${currentUserId}`)
            .then(async (data) => {
                const fetchedOrders = Array.isArray(data) ? data : [];
                setOrders(fetchedOrders);
                
                // Fetch product names dynamically for the UI cache
                const productIds = new Set<string>();
                fetchedOrders.forEach((o: Order) => {
                    const itemsList = o.products || (o as any).items || [];
                    itemsList.forEach((p: OrderProduct) => productIds.add(p.productId.toString()));
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
            .catch((err) => console.error(err));
    }, []);

    const handleBuy = async (orderId: string) => {
        try {
            await fetchFromAPI(`/orders/${orderId}/buy`, { method: 'POST' });
            setOrders(prevOrders => prevOrders.map(o => 
                o._id === orderId ? { ...o, status: 'COMPLETED' } : o
            ));
            alert('Purchase successful! Items have been removed from the database.');
        } catch (err) {
            console.error('Failed to buy order', err);
            alert('Failed to complete checkout');
        }
    };

    const handleDelete = async (orderId: string) => {
        if (!confirm('Are you sure you want to cancel this order? It will be removed and stock will be refunded.')) return;
        try {
            await fetchFromAPI(`/orders/${orderId}`, { method: 'DELETE' });
            setOrders(prevOrders => prevOrders.filter(o => o._id !== orderId));
            alert('Order cancelled successfully!');
        } catch (err) {
            console.error('Failed to delete order', err);
            alert('Failed to cancel order');
        }
    };

    const handleDeleteAll = async () => {
        if (orders.length === 0) return;
        if (!confirm('Are you sure you want to cancel ALL your orders? They will be removed and stock will be refunded.')) return;
        try {
            const userStr = localStorage.getItem('user');
            const currentUser = userStr ? JSON.parse(userStr) : null;
            const currentUserId = currentUser?.userId || "1";

            await fetchFromAPI(`/orders/all/${currentUserId}`, { method: 'DELETE' });
            setOrders([]);
            alert('All orders cancelled successfully!');
        } catch (err) {
            console.error('Failed to delete all orders', err);
            alert('Failed to cancel all orders');
        }
    };

    return (
        <div>
            <Navbar />
            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h1 className="page-title" style={{ marginBottom: 0 }}>Your Orders</h1>
                    {orders.length > 0 && (
                        <button
                            onClick={handleDeleteAll}
                            style={{
                                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                                color: '#f44336',
                                border: '1px solid rgba(244, 67, 54, 0.5)',
                                padding: '0.5rem 1rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 67, 54, 0.2)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 67, 54, 0.1)'}
                        >
                            Delete All Orders
                        </button>
                    )}
                </div>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ backgroundColor: '#222' }}>
                            <tr>
                                <th style={{ padding: '1rem' }}>Order ID</th>
                                <th style={{ padding: '1rem' }}>Date</th>
                                <th style={{ padding: '1rem' }}>Amount</th>
                                <th style={{ padding: '1rem' }}>Items</th>
                                <th style={{ padding: '1rem' }}>Status</th>
                                <th style={{ padding: '1rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <tr key={order._id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem' }}>#{order._id ? order._id.substring(0, 8) : 'N/A'}</td>
                                    <td style={{ padding: '1rem' }}>{new Date(order.createdAt).toLocaleDateString()}</td>
                                    <td style={{ padding: '1rem' }}>${order.totalAmount}</td>
                                    <td style={{ padding: '1rem' }}>
                                        {(order.products || (order as any).items || []).map((p: OrderProduct, idx: number) => (
                                            <div key={idx} style={{ marginBottom: '0.25rem' }}>
                                                <span style={{ color: 'var(--text-secondary)', marginRight: '0.25rem' }}>{p.quantity}x</span>
                                                <Link to={`/product/${p.productId}`} style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: '500' }} onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}>
                                                    {productCache[p.productId.toString()] || 'Loading...'}
                                                </Link>
                                            </div>
                                        ))}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '999px',
                                            fontSize: '0.875rem',
                                            backgroundColor: order.status === 'PENDING' || order.status === 'pending' ? 'rgba(255, 170, 0, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                            color: order.status === 'PENDING' || order.status === 'pending' ? '#fbbf24' : '#34d399'
                                        }}>
                                            {order.status || 'UNKNOWN'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => handleDelete(order._id)}
                                            style={{
                                                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                                                color: '#f44336',
                                                border: '1px solid rgba(244, 67, 54, 0.5)',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '0.875rem'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 67, 54, 0.2)'}
                                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 67, 54, 0.1)'}
                                        >
                                            Delete
                                        </button>

                                        {(order.status === 'PENDING' || order.status === 'pending') && (
                                            <button
                                                onClick={() => handleBuy(order._id)}
                                                style={{
                                                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                                    color: '#10b981',
                                                    border: '1px solid rgba(16, 185, 129, 0.5)',
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 'bold'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)'}
                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'}
                                            >
                                                Buy
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No orders found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
