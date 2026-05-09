import React, { useState } from 'react';
import { fetchFromAPI } from '../api/client';
import { Icon } from '../components/Icon';

const ContentControl: React.FC = () => {
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
                    body: JSON.stringify({ lengthText })
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

    return (
        <div className="max-w-3xl mx-auto px-6 lg:px-10 py-12">
            <div className="mb-10 animate-slideIn">
                <div className="flex items-center gap-2 text-xs text-mute mb-3">
                    <span>admin</span><span>/</span><span className="text-ink">content generator</span>
                </div>
                <h1 className="text-4xl tracking-tight font-medium">Content Generator</h1>
            </div>

            <div className="rounded-3xl bg-paper shadow-card border border-line p-8 animate-slideIn" style={{ animationDelay: '0.1s' }}>
                <h2 className="text-lg font-medium mb-6 flex items-center gap-2">
                    <Icon name="gear" size={18} /> Configuration
                </h2>

                <div className="grid sm:grid-cols-2 gap-6 mb-8">
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-mute mb-2 ml-1">Description Length</label>
                        <div className="relative">
                            <select
                                value={lengthText}
                                onChange={(e) => setLengthText(e.target.value)}
                                className="appearance-none focus-ring w-full h-11 pl-4 pr-10 rounded-full bg-paper border border-line text-sm text-ink hover:border-ink/30 transition cursor-pointer"
                            >
                                <option value="1 short sentence">Microsnap (1 Sentence)</option>
                                <option value="2 short sentences">Standard (2 Sentences)</option>
                                <option value="1 detailed paragraph">Descriptive (1 Paragraph)</option>
                                <option value="2 large paragraphs of marketing copy">Deep Dive (2 Paragraphs)</option>
                                <option value="an extremely long and brutally detailed 5-page SEO blog post covering every possible specification and marketing copy angle">Maximum (SEO Article)</option>
                            </select>
                            <Icon name="chevron" size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-mute pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-mute mb-2 ml-1">
                            Batch Size: <span className="font-bold text-ink">{generateCount}</span>
                        </label>
                        <div className="flex items-center gap-4 mt-1">
                            <input
                                type="range"
                                min="1"
                                max="50"
                                value={generateCount}
                                onChange={(e) => setGenerateCount(parseInt(e.target.value) || 1)}
                                className="flex-1 accent-coral"
                            />
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={generateCount}
                                onChange={(e) => setGenerateCount(parseInt(e.target.value) || 1)}
                                className="focus-ring w-16 h-11 text-center rounded-full bg-paper border border-line text-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-line">
                    <button
                        onClick={handleCreateProduct}
                        disabled={isLoadingProduct}
                        className={`flex-1 h-11 rounded-full text-sm font-medium transition flex items-center justify-center gap-2
                            ${isLoadingProduct ? 'bg-line/60 text-mute cursor-not-allowed' : 'bg-ink text-paper hover:bg-coral shadow-card'}`}
                    >
                        {isLoadingProduct ? `Generating... (${generateCount})` : `Generate ${generateCount} Product${generateCount > 1 ? 's' : ''}`}
                    </button>
                    <button
                        onClick={handleCreateReview}
                        disabled={isLoadingReview}
                        className={`flex-1 h-11 rounded-full text-sm font-medium transition flex items-center justify-center gap-2
                            ${isLoadingReview ? 'bg-line/60 text-mute cursor-not-allowed' : 'bg-sage text-paper hover:bg-sage/80 shadow-card'}`}
                    >
                        {isLoadingReview ? 'Generating...' : 'Generate Review'}
                    </button>
                </div>
            </div>

            {statusMessage && (
                <div className={`mt-6 p-4 rounded-2xl border flex items-center gap-3 animate-fadeIn
                    ${statusMessage.type === 'success' ? 'bg-sageBg text-sage border-sage/20' : 'bg-coralBg text-coralHi border-coral/20'}`}
                >
                    <Icon name={statusMessage.type === 'success' ? 'check' : 'x'} size={18} />
                    <span className="text-sm font-medium">{statusMessage.text}</span>
                </div>
            )}

            <div className="mt-8 rounded-3xl bg-coralBg/30 border border-coral/20 p-8 animate-slideIn" style={{ animationDelay: '0.2s' }}>
                <h2 className="text-lg font-medium text-coralHi mb-2 flex items-center justify-between">
                    Danger Zone
                    <span className="text-[11px] uppercase tracking-wider px-2 py-1 rounded-full bg-coral/10">⚠ Destructive</span>
                </h2>
                <p className="text-sm text-coralHi/80 mb-6">
                    Permanently wipe all products from the database and invalidate the Redis cache. This action cannot be undone.
                </p>
                <button
                    onClick={handleDeleteAllProducts}
                    disabled={isDeleting}
                    className={`w-full h-11 rounded-full text-sm font-medium transition flex items-center justify-center
                        ${isDeleting ? 'bg-coralBg text-coralHi/50 cursor-not-allowed border border-coral/20' : 'bg-coralBg text-coralHi border border-coral/30 hover:bg-coral/10'}`}
                >
                    {isDeleting ? 'Deleting All Products...' : 'Delete All Products'}
                </button>
            </div>
        </div>
    );
};

export default ContentControl;
