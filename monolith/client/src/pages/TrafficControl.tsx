import { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { fetchFromAPI } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../styles/main.css';

interface Trial {
    id: number;
    rps: number;
    success: number;
    fail: number;
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
                    fail: response.config.metrics.failedRequests
                }]);
            }
            fetchStatus();
        } catch (error) {
            alert('Failed to stop traffic generator');
        }
    };

    return (
        <div>
            <Navbar />
            <div className="container" style={{ maxWidth: '800px' }}>
                <h1 className="page-title">Traffic Generator</h1>

                <div className="card" style={{ marginBottom: '2rem' }}>
                    <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Configuration</h2>

                    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr', marginBottom: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Target URL</label>
                            <select
                                value={targetUrl}
                                onChange={(e) => setTargetUrl(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#333', color: 'white', border: '1px solid #444', borderRadius: '4px' }}
                                disabled={status?.isRunning}
                            >
                                <option value="http://host.docker.internal:4000">Monolith Backend (host.docker.internal:4000)</option>
                                <option value="http://api-gateway:8080">Microservices Backend (api-gateway:8080)</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Requests Per Second (RPS)</label>
                            <input
                                type="number"
                                value={rps}
                                onChange={(e) => setRps(Number(e.target.value))}
                                min="1"
                                max="1000"
                                style={{ width: '100%', padding: '0.75rem', backgroundColor: '#333', color: 'white', border: '1px solid #444', borderRadius: '4px' }}
                                disabled={status?.isRunning}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            className="btn"
                            onClick={handleStart}
                            disabled={status?.isRunning}
                            style={{ flex: 1, backgroundColor: status?.isRunning ? '#555' : '#4caf50', cursor: status?.isRunning ? 'not-allowed' : 'pointer' }}
                        >
                            Start Traffic
                        </button>
                        <button
                            className="btn"
                            onClick={handleStop}
                            disabled={!status?.isRunning}
                            style={{ flex: 1, backgroundColor: !status?.isRunning ? '#555' : '#f44336', cursor: !status?.isRunning ? 'not-allowed' : 'pointer' }}
                        >
                            Stop Traffic
                        </button>
                    </div>
                </div>

                {status && (
                    <div className="card" style={{ border: status.isRunning ? '1px solid #4caf50' : '1px solid var(--border-color)' }}>
                        <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                            Live Status
                            <span style={{ color: status.isRunning ? '#4caf50' : '#f44336', fontSize: '1rem' }}>
                                {status.isRunning ? '● ACTIVE' : '○ STOPPED'}
                            </span>
                        </h2>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
                            <div style={{ padding: '1rem', backgroundColor: '#222', borderRadius: '8px' }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Total Sent</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{status.metrics.totalRequestsSent}</div>
                            </div>
                            <div style={{ padding: '1rem', backgroundColor: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)', borderRadius: '8px' }}>
                                <div style={{ color: '#4caf50', fontSize: '0.875rem' }}>Successful</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4caf50' }}>{status.metrics.successfulRequests}</div>
                            </div>
                            <div style={{ padding: '1rem', backgroundColor: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.3)', borderRadius: '8px' }}>
                                <div style={{ color: '#f44336', fontSize: '0.875rem' }}>Failed</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f44336' }}>{status.metrics.failedRequests}</div>
                            </div>
                        </div>
                    </div>
                )}

                {trials.length > 0 && (
                    <div className="card" style={{ marginTop: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                            <h2 style={{ margin: 0 }}>Trial History</h2>
                            <button 
                                className="btn" 
                                onClick={() => setTrials([])}
                                style={{ backgroundColor: '#f44336', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                            >
                                Clear History
                            </button>
                        </div>
                        
                        <div style={{ height: '300px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={trials} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="id" stroke="#888" tickFormatter={(id) => `Trial ${id}`} />
                                    <YAxis stroke="#888" />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#222', borderColor: '#444' }}
                                        labelFormatter={(label) => `Trial ${label}`}
                                        formatter={(value: any, name: any, props: any) => {
                                            const total = props.payload.success + props.payload.fail;
                                            const ratio = total > 0 ? ((value as number / total) * 100).toFixed(1) + '%' : '0%';
                                            return [`${value} (${ratio})`, name === 'success' ? `Success (${props.payload.rps} RPS)` : `Fail (${props.payload.rps} RPS)`];
                                        }}
                                    />
                                    <Legend />
                                    <Bar dataKey="success" stackId="a" fill="#4caf50" name="Success" />
                                    <Bar dataKey="fail" stackId="a" fill="#f44336" name="Fail" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
