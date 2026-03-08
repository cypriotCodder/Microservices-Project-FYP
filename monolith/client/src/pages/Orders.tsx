import { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { fetchFromAPI } from '../api/client';
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

    useEffect(() => {
        fetchFromAPI('/orders')
            .then((data) => setOrders(Array.isArray(data) ? data : []))
            .catch((err) => console.error(err));
    }, []);

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

    return (
        <div>
            <Navbar />
            <div className="container">
                <h1 className="page-title">Your Orders</h1>
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
                                    <td style={{ padding: '1rem' }}>{order.products?.reduce((acc, p) => acc + p.quantity, 0) || 0}</td>
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
                                    <td style={{ padding: '1rem' }}>
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
