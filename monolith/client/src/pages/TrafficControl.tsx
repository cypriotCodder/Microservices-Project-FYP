import { useState, useEffect } from 'react';
import { fetchFromAPI } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Icon } from '../components/Icon';

interface Trial {
    id: number;
    rps: number;
    success: number;
    fail: number;
    failuresByService?: Record<string, number>;
}

interface TrafficStatus {
    isRunning: boolean;
    targetUrl: string;
    rps: number;
    metrics: {
        totalRequestsSent: number;
        successfulRequests: number;
        failedRequests: number;
    };
}

export function TrafficControl() {
    const [status, setStatus] = useState<TrafficStatus | null>(null);
    const [targetUrl, setTargetUrl] = useState<string>('http://host.docker.internal:4000');
    const [rps, setRps] = useState<number>(100);

    const [trials, setTrials] = useState<Trial[]>(() => {
        const saved = localStorage.getItem('monolith_traffic_trials');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('monolith_traffic_trials', JSON.stringify(trials));
    }, [trials]);

    const fetchStatus = async () => {
        try {
            const data = await fetchFromAPI('/traffic/status');
            setStatus(data);
        } catch (error) {
            console.error('Failed to fetch traffic status:', error);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleStart = async () => {
        try {
            await fetchFromAPI('/traffic/start', {
                method: 'POST',
                body: JSON.stringify({ targetUrl, rps })
            });
            fetchStatus();
        } catch (error) {
            alert('Failed to start traffic generator');
        }
    };

    const handleStop = async () => {
        try {
            const response = await fetchFromAPI('/traffic/stop', { method: 'POST' });
            if (response.config && response.config.metrics) {
                setTrials(prev => [...prev, {
                    id: prev.length + 1,
                    rps: response.config.rps,
                    success: response.config.metrics.successfulRequests,
                    fail: response.config.metrics.failedRequests,
                    failuresByService: response.config.metrics.failuresByService
                }]);
            }
            fetchStatus();
        } catch (error) {
            alert('Failed to stop traffic generator');
        }
    };

    const chartData = trials.map(t => ({
        id: t.id,
        rps: t.rps,
        success: t.success,
        fail: t.fail,
        auth: t.failuresByService?.auth || 0,
        products: t.failuresByService?.products || 0,
        llm: t.failuresByService?.llm || 0,
        orders: t.failuresByService?.orders || 0,
    }));

    return (
        <div className="max-w-4xl mx-auto px-6 lg:px-10 py-12">
            <div className="mb-10 animate-slideIn">
                <div className="flex items-center gap-2 text-xs text-mute mb-3">
                    <span>admin</span><span>/</span><span className="text-ink">traffic generator</span>
                </div>
                <h1 className="text-4xl tracking-tight font-medium">Traffic Generator</h1>
            </div>

            <div className="rounded-3xl bg-paper shadow-cardHi border border-line p-8 animate-slideIn" style={{ animationDelay: '0.1s' }}>
                <h2 className="text-lg font-medium mb-6 flex items-center gap-2">
                    <Icon name="gear" size={18} /> Configuration
                </h2>

                <div className="grid sm:grid-cols-2 gap-6 mb-8">
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-mute mb-2 ml-1">Target URL</label>
                        <div className="relative">
                            <select
                                value={targetUrl}
                                onChange={(e) => setTargetUrl(e.target.value)}
                                disabled={status?.isRunning}
                                className="appearance-none focus-ring w-full h-11 pl-4 pr-10 rounded-full bg-paper border border-line text-sm text-ink hover:border-ink/30 transition cursor-pointer disabled:opacity-50"
                            >
                                <option value="http://host.docker.internal:4000">Monolith Backend (:4000)</option>
                                <option value="http://api-gateway:8080">Microservices Backend (:8080)</option>
                            </select>
                            <Icon name="chevron" size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-mute pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-mute mb-2 ml-1">Requests Per Second (RPS)</label>
                        <input
                            type="number"
                            value={rps}
                            onChange={(e) => setRps(Number(e.target.value))}
                            min="1"
                            max="1000"
                            disabled={status?.isRunning}
                            className="focus-ring w-full h-11 px-4 rounded-full bg-paper border border-line text-sm placeholder:text-mute transition disabled:opacity-50"
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-line">
                    <button
                        onClick={handleStart}
                        disabled={status?.isRunning}
                        className={`flex-1 h-11 rounded-full text-sm font-medium transition flex items-center justify-center gap-2 shadow-card
                            ${status?.isRunning ? 'bg-line/60 text-mute cursor-not-allowed' : 'bg-sage text-paper hover:bg-sage/80'}`}
                    >
                        Start Traffic
                    </button>
                    <button
                        onClick={handleStop}
                        disabled={!status?.isRunning}
                        className={`flex-1 h-11 rounded-full text-sm font-medium transition flex items-center justify-center gap-2 shadow-card
                            ${!status?.isRunning ? 'bg-line/60 text-mute cursor-not-allowed' : 'bg-coral text-paper hover:bg-coralHi'}`}
                    >
                        Stop Traffic
                    </button>
                </div>
            </div>

            {status && (
                <div className={`mt-8 rounded-3xl p-8 border animate-slideIn ${status.isRunning ? 'bg-sageBg/30 border-sage/30' : 'bg-paper shadow-card border-line'}`} style={{ animationDelay: '0.2s' }}>
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-lg font-medium">Live Status</h2>
                        <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-medium tracking-wide uppercase
                            ${status.isRunning ? 'bg-sageBg text-sage border border-sage/20' : 'bg-coralBg text-coralHi border border-coral/20'}
                        `}>
                            {status.isRunning ? 'ACTIVE' : 'STOPPED'}
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-4 rounded-2xl bg-paper border border-line shadow-sm">
                            <div className="text-[11px] uppercase tracking-wider text-mute mb-1">Total Sent</div>
                            <div className="text-2xl font-medium tabular-nums">{status.metrics.totalRequestsSent}</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-sageBg border border-sage/20 text-sage shadow-sm">
                            <div className="text-[11px] uppercase tracking-wider mb-1">Successful</div>
                            <div className="text-2xl font-medium tabular-nums">{status.metrics.successfulRequests}</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-coralBg border border-coral/20 text-coral shadow-sm">
                            <div className="text-[11px] uppercase tracking-wider mb-1">Failed</div>
                            <div className="text-2xl font-medium tabular-nums">{status.metrics.failedRequests}</div>
                        </div>
                    </div>
                </div>
            )}

            {trials.length > 0 && (
                <div className="mt-8 rounded-3xl bg-paper shadow-cardHi border border-line p-8 animate-slideIn" style={{ animationDelay: '0.3s' }}>
                    <div className="flex items-center justify-between mb-8 border-b border-line pb-4">
                        <h2 className="text-lg font-medium">Trial History</h2>
                        <button 
                            onClick={() => setTrials([])}
                            className="text-xs font-medium text-coral hover:text-coralHi transition"
                        >
                            Clear History
                        </button>
                    </div>
                    
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
                                <XAxis dataKey="id" stroke="#6B6B66" tick={{ fill: '#6B6B66', fontSize: 12 }} tickFormatter={(id) => `Trial ${id}`} />
                                <YAxis stroke="#6B6B66" tick={{ fill: '#6B6B66', fontSize: 12 }} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#FAFAF8', borderColor: '#E8E8E4', borderRadius: '12px', fontSize: '13px' }}
                                    labelFormatter={(label) => `Trial ${label}`}
                                    formatter={(value: any, name: any, props: any) => {
                                        const total = props.payload.success + props.payload.fail;
                                        const ratio = total > 0 ? ((value as number / total) * 100).toFixed(1) + '%' : '0%';
                                        return [`${value} (${ratio})`, name === 'success' ? `Success (${props.payload.rps} RPS)` : `Fail (${props.payload.rps} RPS)`];
                                    }}
                                />
                                <Legend wrapperStyle={{ fontSize: '13px' }} />
                                <Bar dataKey="success" stackId="a" fill="#7FA98B" name="Success" radius={[0, 0, 4, 4]} />
                                <Bar dataKey="fail" stackId="a" fill="#E07A5F" name="Fail" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    
                    <div className="mt-8 pt-8 border-t border-line">
                        <h3 className="text-sm font-medium text-ink mb-6">Service Failure Breakdown</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
                                    <XAxis dataKey="id" stroke="#6B6B66" tick={{ fill: '#6B6B66', fontSize: 12 }} tickFormatter={(id) => `Trial ${id}`} />
                                    <YAxis stroke="#6B6B66" tick={{ fill: '#6B6B66', fontSize: 12 }} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#FAFAF8', borderColor: '#E8E8E4', borderRadius: '12px', fontSize: '13px' }}
                                        labelFormatter={(label) => `Trial ${label}`}
                                        formatter={(value: any, name: any) => [value, name]}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '13px' }} />
                                    <Bar dataKey="auth" stackId="b" fill="#D86A4D" name="Auth" />
                                    <Bar dataKey="products" stackId="b" fill="#7FA98B" name="Products" />
                                    <Bar dataKey="llm" stackId="b" fill="#F4A261" name="LLM" />
                                    <Bar dataKey="orders" stackId="b" fill="#9c27b0" name="Orders" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
