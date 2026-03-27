import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { fetchFromAPI } from '../api/client';
import '../styles/main.css';

const ContentControl: React.FC = () => {
    const [targetUrl, setTargetUrl] = useState<string>('http://api-gateway:8080');
    const [lengthText, setLengthText] = useState<string>('2 short sentences');
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isLoadingProduct, setIsLoadingProduct] = useState(false);
    const [isLoadingReview, setIsLoadingReview] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [generateCount, setGenerateCount] = useState<number>(1);

    const handleCreateProduct = async () => {
        setIsLoadingProduct(true);
        setStatusMessage(null);
        let successCount = 0;
        try {
            for (let i = 0; i < generateCount; i++) {
                setStatusMessage({ type: 'success', text: `Generating product ${i + 1} of ${generateCount}...` });
                await fetchFromAPI('/content/generate-product', {
                    method: 'POST',
                    body: JSON.stringify({ targetUrl, lengthText })
                });
                successCount++;
            }
            setStatusMessage({ type: 'success', text: `✓ Successfully created ${successCount} product${successCount > 1 ? 's' : ''}!` });
        } catch (error: any) {
            setStatusMessage({ type: 'error', text: `Failed after ${successCount} products: ${error.message || 'Unknown error'}` });
        } finally {
            setIsLoadingProduct(false);
        }
    };

    const handleCreateReview = async () => {
        setIsLoadingReview(true);
        setStatusMessage(null);
        try {
            const response = await fetchFromAPI('/content/generate-review', {
                method: 'POST',
                body: JSON.stringify({ targetUrl })
            });
            setStatusMessage({ type: 'success', text: `✓ Review created! Rating: ${response.data.rating}/5` });
        } catch (error: any) {
            setStatusMessage({ type: 'error', text: error.message || 'Failed to generate review' });
        } finally {
            setIsLoadingReview(false);
        }
    };

    const handleDeleteAllProducts = async () => {
        if (!window.confirm('WARNING: This will permanently delete every product from the database and clear the Redis cache. This cannot be undone. Proceed?')) return;
        setIsDeleting(true);
        setStatusMessage(null);
        try {
            const response = await fetchFromAPI('/products/all', { method: 'DELETE' });
            setStatusMessage({ type: 'success', text: response.message || '✓ All products deleted successfully' });
        } catch (error: any) {
            setStatusMessage({ type: 'error', text: error.message || 'Failed to delete products' });
        } finally {
            setIsDeleting(false);
        }
    };

    const selectStyle: React.CSSProperties = {
        width: '100%',
        padding: '0.75rem',
        backgroundColor: '#333',
        color: 'white',
        border: '1px solid #444',
        borderRadius: '4px',
        fontSize: '0.95rem',
        cursor: 'pointer',
        outline: 'none',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        marginBottom: '0.5rem',
        color: 'var(--text-secondary)',
        fontSize: '0.9rem',
    };

    return (
        <div>
            <Navbar />
            <div className="container" style={{ maxWidth: '800px' }}>
                <h1 className="page-title">Content Generator</h1>

                {/* Configuration Card */}
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        Configuration
                    </h2>

                    <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: '1fr 1fr', marginBottom: '1.5rem' }}>
                        <div>
                            <label style={labelStyle}>Target Environment</label>
                            <select
                                value={targetUrl}
                                onChange={(e) => setTargetUrl(e.target.value)}
                                style={selectStyle}
                            >
                                <option value="http://api-gateway:8080">Microservices (Docker Internal)</option>
                                <option value="http://host.docker.internal:4000">Monolith (via Host)</option>
                            </select>
                        </div>

                        <div>
                            <label style={labelStyle}>Description Length</label>
                            <select
                                value={lengthText}
                                onChange={(e) => setLengthText(e.target.value)}
                                style={selectStyle}
                            >
                                <option value="1 short sentence">Microsnap (1 Sentence)</option>
                                <option value="2 short sentences">Standard (2 Sentences)</option>
                                <option value="1 detailed paragraph">Descriptive (1 Paragraph)</option>
                                <option value="2 large paragraphs of marketing copy">Deep Dive (2 Paragraphs)</option>
                                <option value="an extremely long and brutally detailed 5-page SEO blog post covering every possible specification and marketing copy angle">Maximum (SEO Article)</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={labelStyle}>Batch Size: <strong style={{ color: 'var(--text-color)' }}>{generateCount}</strong></label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <input
                                type="range"
                                min="1"
                                max="50"
                                value={generateCount}
                                onChange={(e) => setGenerateCount(parseInt(e.target.value) || 1)}
                                style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                            />
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={generateCount}
                                onChange={(e) => setGenerateCount(parseInt(e.target.value) || 1)}
                                style={{
                                    width: '70px',
                                    padding: '0.5rem',
                                    backgroundColor: '#333',
                                    color: 'white',
                                    border: '1px solid #444',
                                    borderRadius: '4px',
                                    textAlign: 'center',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                }}
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            className="btn"
                            onClick={handleCreateProduct}
                            disabled={isLoadingProduct}
                            style={{
                                flex: 1,
                                backgroundColor: isLoadingProduct ? '#555' : 'var(--accent-color)',
                                cursor: isLoadingProduct ? 'not-allowed' : 'pointer',
                                transition: 'background-color 0.2s',
                            }}
                        >
                            {isLoadingProduct ? `Generating... (${generateCount})` : `Generate ${generateCount} Product${generateCount > 1 ? 's' : ''}`}
                        </button>
                        <button
                            className="btn"
                            onClick={handleCreateReview}
                            disabled={isLoadingReview}
                            style={{
                                flex: 1,
                                backgroundColor: isLoadingReview ? '#555' : '#4caf50',
                                cursor: isLoadingReview ? 'not-allowed' : 'pointer',
                                transition: 'background-color 0.2s',
                            }}
                        >
                            {isLoadingReview ? 'Generating...' : 'Generate Review'}
                        </button>
                    </div>
                </div>

                {/* Status Message */}
                {statusMessage && (
                    <div
                        className="card"
                        style={{
                            marginBottom: '2rem',
                            padding: '1rem 1.5rem',
                            border: statusMessage.type === 'success'
                                ? '1px solid rgba(76, 175, 80, 0.5)'
                                : '1px solid rgba(244, 67, 54, 0.5)',
                            backgroundColor: statusMessage.type === 'success'
                                ? 'rgba(76, 175, 80, 0.1)'
                                : 'rgba(244, 67, 54, 0.1)',
                        }}
                    >
                        <span style={{
                            color: statusMessage.type === 'success' ? '#4caf50' : '#f44336',
                            fontWeight: '500',
                        }}>
                            {statusMessage.text}
                        </span>
                    </div>
                )}

                {/* Danger Zone */}
                <div className="card" style={{ border: '1px solid rgba(244, 67, 54, 0.3)' }}>
                    <h2 style={{
                        marginBottom: '1rem',
                        borderBottom: '1px solid var(--border-color)',
                        paddingBottom: '0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        Danger Zone
                        <span style={{ color: '#f44336', fontSize: '0.85rem', fontWeight: 'normal' }}>⚠ Destructive</span>
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Permanently wipe all products from the database and invalidate the Redis cache. This action cannot be undone.
                    </p>
                    <button
                        className="btn"
                        onClick={handleDeleteAllProducts}
                        disabled={isDeleting}
                        style={{
                            width: '100%',
                            backgroundColor: isDeleting ? '#555' : 'rgba(244, 67, 54, 0.15)',
                            color: isDeleting ? '#999' : '#f44336',
                            border: '1px solid rgba(244, 67, 54, 0.5)',
                            cursor: isDeleting ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.2s',
                        }}
                        onMouseOver={(e) => { if (!isDeleting) e.currentTarget.style.backgroundColor = 'rgba(244, 67, 54, 0.3)'; }}
                        onMouseOut={(e) => { if (!isDeleting) e.currentTarget.style.backgroundColor = 'rgba(244, 67, 54, 0.15)'; }}
                    >
                        {isDeleting ? 'Deleting All Products...' : 'Delete All Products'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ContentControl;
