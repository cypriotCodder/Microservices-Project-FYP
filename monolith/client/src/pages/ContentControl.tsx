import React, { useState } from 'react';
import { fetchFromAPI } from '../api/client';
import { Bot, PackagePlus, FileText, CheckCircle2, XCircle } from 'lucide-react';

const ContentControl: React.FC = () => {
    const [targetUrl, setTargetUrl] = useState<string>('http://localhost:8080'); // Default to Gateway
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isLoadingProduct, setIsLoadingProduct] = useState(false);
    const [isLoadingReview, setIsLoadingReview] = useState(false);

    const handleCreateProduct = async () => {
        setIsLoadingProduct(true);
        setStatusMessage(null);
        try {
            const response = await fetchFromAPI('/content/generate-product', {
                method: 'POST',
                body: JSON.stringify({ targetUrl })
            });
            setStatusMessage({ type: 'success', text: `Product created! ${response.data.name}` });
        } catch (error: any) {
            setStatusMessage({ type: 'error', text: error.message || 'Failed to generate product' });
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
            setStatusMessage({ type: 'success', text: `Review created successfully! Rating: ${response.data.rating}/5` });
        } catch (error: any) {
            setStatusMessage({ type: 'error', text: error.message || 'Failed to generate review' });
        } finally {
            setIsLoadingReview(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-6 text-indigo-600">
                    <Bot size={24} />
                    <h2 className="text-xl font-semibold text-gray-800">Content Creator</h2>
                </div>

                <div className="space-y-4">
                    <p className="text-gray-600 text-sm">
                        Use this tool to automatically generate simulated product listings and customer reviews.
                    </p>

                    <div className="flex items-center gap-4 py-2">
                        <label className="text-sm font-medium text-gray-700 w-32">Target API URL:</label>
                        <select
                            value={targetUrl}
                            onChange={(e) => setTargetUrl(e.target.value)}
                            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2"
                        >
                            <option value="http://api-gateway:8080">Microservices (Docker internal)</option>
                            <option value="http://localhost:8080">Microservices (Localhost gateway port 8080)</option>
                            <option value="http://localhost:4000">Monolith (Localhost port 4000)</option>
                        </select>
                    </div>

                    {statusMessage && (
                        <div className={`p-4 rounded-md flex items-center gap-2 ${statusMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {statusMessage.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                            <span className="text-sm">{statusMessage.text}</span>
                        </div>
                    )}

                    <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={handleCreateProduct}
                            disabled={isLoadingProduct}
                            className={`flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                                ${isLoadingProduct ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`}
                        >
                            <PackagePlus size={18} />
                            {isLoadingProduct ? 'Generating...' : 'Generate 1 Fake Product'}
                        </button>

                        <button
                            onClick={handleCreateReview}
                            disabled={isLoadingReview}
                            className={`flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                                ${isLoadingReview ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500'}`}
                        >
                            <FileText size={18} />
                            {isLoadingReview ? 'Generating...' : 'Generate 1 Fake Review'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContentControl;
