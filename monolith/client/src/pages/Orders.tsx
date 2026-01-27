import { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { fetchFromAPI } from '../api/client';
import '../styles/main.css';

interface Order {
    id: number;
    productId: number;
    quantity: number;
    status: string;
}

export function Orders() {
    const [orders, setOrders] = useState<Order[]>([]);

    useEffect(() => {
        fetchFromAPI('/orders')
            .then((data) => setOrders(Array.isArray(data) ? data : []))
            .catch((err) => console.error(err));
    }, []);

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
                                <th style={{ padding: '1rem' }}>Product ID</th>
                                <th style={{ padding: '1rem' }}>Quantity</th>
                                <th style={{ padding: '1rem' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <tr key={order.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem' }}>#{order.id}</td>
                                    <td style={{ padding: '1rem' }}>{order.productId}</td>
                                    <td style={{ padding: '1rem' }}>{order.quantity}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '999px',
                                            fontSize: '0.875rem',
                                            backgroundColor: order.status === 'pending' ? 'rgba(255, 170, 0, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                            color: order.status === 'pending' ? '#fbbf24' : '#34d399'
                                        }}>
                                            {order.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
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
