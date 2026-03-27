import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchFromAPI } from '../api/client';

export function Admin() {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!user || user.role !== 'ADMIN') {
        return <Navigate to="/" replace />;
    }

    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string>('');

    const fetchMetrics = async () => {
        try {
            const data = await fetchFromAPI('/admin/metrics', {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setMetrics(data);
            setLastUpdated(new Date().toLocaleTimeString());
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch admin metrics', error);
        }
    };

    useEffect(() => {
        fetchMetrics();
        let timerId: ReturnType<typeof setTimeout>;
        const poll = () => {
            const jitter = Math.random() * 5000 + 5000;
            timerId = setTimeout(async () => {
                await fetchMetrics();
                poll();
            }, jitter);
        };
        poll();

        return () => clearTimeout(timerId);
    }, []);

    if (loading) return <div><Navbar /><div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>Loading Admin Dashboard...</div></div>;
    if (!metrics) return <div><Navbar /><div className="container" style={{ textAlign: 'center', color: 'red', marginTop: '50px' }}>Failed to load Admin Dashboard. Check Server/Role permissions.</div></div>;

    const chartTelemetry = [
        { name: 'Last 60s Average', LatencyMs: metrics.telemetry.avgLatencyMs, '4xx Errors': metrics.telemetry.errorRate4xx, '5xx Errors': metrics.telemetry.errorRate5xx }
    ];

    const chartOrders = metrics.chartData.map((d: any) => ({
        time: new Date(d._id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        orders: d.count
    }));

    return (
        <div>
            <Navbar />
            <div className="container" style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--accent-color)', paddingBottom: '0.5rem', display: 'inline-block' }}>System Admin Dashboard</h1>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Last updated: {lastUpdated}</span>
                </div>

                {/* KPI Cards */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ flex: 1, backgroundColor: 'var(--card-bg)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Total System Users</h3>
                        <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0', color: 'var(--accent-color)' }}>{metrics.users}</p>
                    </div>
                    <div style={{ flex: 1, backgroundColor: 'var(--card-bg)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Total Orders Processed</h3>
                        <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0', color: 'var(--accent-color)' }}>{metrics.orders}</p>
                    </div>
                    <div style={{ flex: 1, backgroundColor: 'var(--card-bg)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                        <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Total System Revenue</h3>
                        <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0', color: 'var(--accent-color)' }}>${metrics.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>

                    {/* Charts Section */}
                    <div style={{ flex: '1 1 60%', minWidth: '400px' }}>
                        <div style={{ backgroundColor: 'var(--card-bg)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', color: 'var(--text-color)' }}>Live Traffic Metrics (Last 60s)</h3>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartTelemetry}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                        <XAxis dataKey="name" stroke="var(--text-secondary)" />
                                        <YAxis stroke="var(--text-secondary)" />
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
                                        <Legend />
                                        <Bar dataKey="LatencyMs" fill="#8884d8" name="Avg Latency (ms)" />
                                        <Bar dataKey="4xx Errors" fill="#ffc658" name="4xx Error Rate (%)" />
                                        <Bar dataKey="5xx Errors" fill="#ff7300" name="5xx Server Fault Rate (%)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div style={{ backgroundColor: 'var(--card-bg)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', color: 'var(--text-color)' }}>Sales Velocity (Orders / Min)</h3>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartOrders}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                        <XAxis dataKey="time" stroke="var(--text-secondary)" />
                                        <YAxis stroke="var(--text-secondary)" allowDecimals={false} />
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }} />
                                        <Legend />
                                        <Bar dataKey="orders" fill="var(--accent-color)" name="Orders per minute" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Top Products Table */}
                    <div style={{ flex: '1 1 30%', minWidth: '300px' }}>
                        <div style={{ backgroundColor: 'var(--card-bg)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', color: 'var(--text-color)' }}>Top 10 Product Sales</h3>
                            <div style={{ display: 'table', width: '100%', borderCollapse: 'collapse' }}>
                                <div style={{ display: 'table-row', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                                    <div style={{ display: 'table-cell', padding: '0.5rem' }}>Product ID</div>
                                    <div style={{ display: 'table-cell', padding: '0.5rem', textAlign: 'right' }}>Total Sold</div>
                                </div>
                                {metrics.topProducts.map((p: any) => (
                                    <div key={p._id} style={{ display: 'table-row', borderBottom: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'table-cell', padding: '0.75rem 0.5rem' }}>
                                            <div style={{ fontWeight: 'bold', color: 'var(--text-color)' }}>{p.name || 'Unknown Item'}</div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>ID: {p._id.slice(-6)}</div>
                                        </div>
                                        <div style={{ display: 'table-cell', padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 'bold' }}>
                                            {p.totalSold}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
