import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchFromAPI } from '../api/client';
import { Icon } from '../components/Icon';

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

    if (loading) return <div className="text-center py-32 text-mute">loading dashboard...</div>;
    if (!metrics) return <div className="text-center py-32 text-coralHi">failed to load dashboard. check server/role permissions.</div>;

    const chartTelemetry = [
        { name: 'Last 60s Avg', LatencyMs: metrics.telemetry.avgLatencyMs, '4xx Errors': metrics.telemetry.errorRate4xx, '5xx Errors': metrics.telemetry.errorRate5xx }
    ];

    const chartOrders = metrics.chartData.map((d: any) => ({
        time: new Date(d._id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        orders: d.count
    }));

    return (
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10 animate-slideIn">
                <div>
                    <div className="flex items-center gap-2 text-xs text-mute mb-3">
                        <span>admin</span><span>/</span><span className="text-ink">dashboard</span>
                    </div>
                    <h1 className="text-4xl tracking-tight font-medium">System Overview</h1>
                </div>
                <div className="text-xs text-mute font-medium px-4 py-2 rounded-full bg-paper border border-line shadow-sm">
                    Last updated: {lastUpdated}
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8 animate-slideIn" style={{ animationDelay: '0.1s' }}>
                <div className="p-6 rounded-3xl bg-paper shadow-card border border-line text-center">
                    <div className="text-[11px] uppercase tracking-wider text-mute mb-2 flex items-center justify-center gap-2">
                        <Icon name="search" size={12} /> Total Users
                    </div>
                    <div className="text-4xl font-medium tabular-nums">{metrics.users}</div>
                </div>
                <div className="p-6 rounded-3xl bg-sageBg border border-sage/20 text-center shadow-sm">
                    <div className="text-[11px] uppercase tracking-wider text-sage mb-2 flex items-center justify-center gap-2">
                        <Icon name="bag" size={12} /> Orders Processed
                    </div>
                    <div className="text-4xl font-medium tabular-nums text-sage">{metrics.orders}</div>
                </div>
                <div className="p-6 rounded-3xl bg-coralBg border border-coral/20 text-center shadow-sm">
                    <div className="text-[11px] uppercase tracking-wider text-coralHi mb-2 flex items-center justify-center gap-2">
                        <Icon name="spark" size={12} /> System Revenue
                    </div>
                    <div className="text-4xl font-medium tabular-nums text-coralHi">${metrics.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_360px] gap-8 animate-slideIn" style={{ animationDelay: '0.2s' }}>
                
                <div className="flex flex-col gap-8">
                    <div className="p-8 rounded-3xl bg-paper shadow-card border border-line">
                        <h3 className="text-lg font-medium mb-6">Live Traffic Metrics</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartTelemetry}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
                                    <XAxis dataKey="name" stroke="#6B6B66" tick={{ fill: '#6B6B66', fontSize: 12 }} />
                                    <YAxis stroke="#6B6B66" tick={{ fill: '#6B6B66', fontSize: 12 }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#FAFAF8', borderColor: '#E8E8E4', borderRadius: '12px', fontSize: '13px' }} />
                                    <Legend wrapperStyle={{ fontSize: '13px' }} />
                                    <Bar dataKey="LatencyMs" fill="#7FA98B" name="Avg Latency (ms)" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="4xx Errors" fill="#F4A261" name="4xx Error (%)" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="5xx Errors" fill="#E07A5F" name="5xx Fault (%)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="p-8 rounded-3xl bg-paper shadow-card border border-line">
                        <h3 className="text-lg font-medium mb-6">Sales Velocity</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartOrders}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
                                    <XAxis dataKey="time" stroke="#6B6B66" tick={{ fill: '#6B6B66', fontSize: 12 }} />
                                    <YAxis stroke="#6B6B66" allowDecimals={false} tick={{ fill: '#6B6B66', fontSize: 12 }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#FAFAF8', borderColor: '#E8E8E4', borderRadius: '12px', fontSize: '13px' }} />
                                    <Legend wrapperStyle={{ fontSize: '13px' }} />
                                    <Bar dataKey="orders" fill="#1A1A1A" name="Orders / min" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="p-8 rounded-3xl bg-paper shadow-cardHi border border-line h-fit">
                    <h3 className="text-lg font-medium mb-6">Top Products</h3>
                    <div className="space-y-4">
                        {metrics.topProducts.map((p: any, idx: number) => (
                            <div key={p._id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-line/30 transition">
                                <div className="w-8 h-8 rounded-full bg-line text-mute grid place-items-center text-xs font-bold">
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate">{p.name || 'Unknown Item'}</div>
                                    <div className="text-[10px] text-mute uppercase tracking-widest mt-0.5">ID: {p._id.slice(-6)}</div>
                                </div>
                                <div className="text-coralHi font-medium tabular-nums">
                                    {p.totalSold} <span className="text-[10px] text-mute">sold</span>
                                </div>
                            </div>
                        ))}
                        {metrics.topProducts.length === 0 && (
                            <div className="text-sm text-mute text-center py-6">No sales data available.</div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
