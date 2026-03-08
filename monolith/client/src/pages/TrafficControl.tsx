import { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { fetchFromAPI } from '../api/client';
import '../styles/main.css';

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
    const [targetUrl, setTargetUrl] = useState<string>('http://api-gateway:8080');
    const [rps, setRps] = useState<number>(100);

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
            await fetchFromAPI('/traffic/stop', { method: 'POST' });
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
                                <option value="http://localhost:8080">Microservices (localhost:8080)</option>
                                <option value="http://localhost:4000">Monolith (localhost:4000)</option>
                                <option value="http://api-gateway:8080">Docker API Gateway Internal</option>
                                <option value="http://monolith-backend:4000">Docker Monolith Internal</option>
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
            </div>
        </div>
    );
}
