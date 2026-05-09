import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchFromAPI } from '../api/client';
import { Icon } from '../components/Icon';

export function PublishProduct() {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        price: '',
        description: '',
        stock: '',
        category: '',
        image: ''
    });

    const handleMockFill = () => {
        setFormData({
            name: `Stress Test Product ${Math.floor(Math.random() * 10000)}`,
            price: (Math.random() * 100 + 10).toFixed(2),
            description: 'This is an automatically generated product designed for UI and database stress testing. It contains a mock description and standard parameters.',
            stock: '100',
            category: 'Testing gear',
            image: `https://picsum.photos/seed/${Math.random()}/400/300`
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await fetchFromAPI('/products', {
                method: 'POST',
                body: JSON.stringify({
                    name: formData.name,
                    price: parseFloat(formData.price),
                    description: formData.description,
                    stock: parseInt(formData.stock),
                    category: formData.category,
                    image: formData.image
                })
            });
            navigate('/');
        } catch (err: any) {
            alert(`Failed to publish product: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-6 lg:px-10 py-12">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10 animate-slideIn">
                <div>
                    <div className="flex items-center gap-2 text-xs text-mute mb-3">
                        <span>catalog</span><span>/</span><span className="text-ink">publish product</span>
                    </div>
                    <h1 className="text-4xl tracking-tight font-medium">Publish Product</h1>
                </div>
                <button 
                    type="button" 
                    onClick={handleMockFill}
                    className="h-10 px-4 rounded-full bg-sageBg text-sage text-sm font-medium hover:bg-sage/20 transition flex items-center gap-2 border border-sage/10"
                >
                    <Icon name="spark" size={14} /> Auto-Fill Mock Data
                </button>
            </div>

            <div className="rounded-3xl bg-paper shadow-cardHi border border-line p-8 animate-slideIn" style={{ animationDelay: '0.1s' }}>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div className="grid sm:grid-cols-3 gap-5">
                        <div className="sm:col-span-2">
                            <label className="block text-[11px] uppercase tracking-wider text-mute mb-1.5 ml-1">Product Name *</label>
                            <input 
                                required 
                                type="text" 
                                name="name" 
                                value={formData.name} 
                                onChange={handleChange} 
                                placeholder="e.g., Wireless Headphones" 
                                className="focus-ring w-full h-11 px-4 rounded-xl bg-paper border border-line text-sm placeholder:text-mute transition"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] uppercase tracking-wider text-mute mb-1.5 ml-1">Price ($) *</label>
                            <input 
                                required 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                name="price" 
                                value={formData.price} 
                                onChange={handleChange} 
                                placeholder="99.99" 
                                className="focus-ring w-full h-11 px-4 rounded-xl bg-paper border border-line text-sm placeholder:text-mute transition"
                            />
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[11px] uppercase tracking-wider text-mute mb-1.5 ml-1">Category *</label>
                            <input 
                                required 
                                type="text" 
                                name="category" 
                                value={formData.category} 
                                onChange={handleChange} 
                                placeholder="e.g., Electronics" 
                                className="focus-ring w-full h-11 px-4 rounded-xl bg-paper border border-line text-sm placeholder:text-mute transition"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] uppercase tracking-wider text-mute mb-1.5 ml-1">Initial Stock *</label>
                            <input 
                                required 
                                type="number" 
                                min="0" 
                                name="stock" 
                                value={formData.stock} 
                                onChange={handleChange} 
                                placeholder="50" 
                                className="focus-ring w-full h-11 px-4 rounded-xl bg-paper border border-line text-sm placeholder:text-mute transition"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-mute mb-1.5 ml-1">Image URL (Optional)</label>
                        <input 
                            type="url" 
                            name="image" 
                            value={formData.image} 
                            onChange={handleChange} 
                            placeholder="https://example.com/image.jpg" 
                            className="focus-ring w-full h-11 px-4 rounded-xl bg-paper border border-line text-sm placeholder:text-mute transition"
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-mute mb-1.5 ml-1">Description</label>
                        <textarea 
                            name="description" 
                            value={formData.description} 
                            onChange={handleChange} 
                            rows={4} 
                            placeholder="Describe the product..."
                            className="focus-ring w-full p-4 rounded-xl bg-paper border border-line text-sm placeholder:text-mute resize-y transition"
                        />
                    </div>

                    <div className="pt-4 border-t border-line mt-2">
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className={`w-full h-11 rounded-full text-sm font-medium transition flex items-center justify-center gap-2
                                ${isSubmitting ? 'bg-line/60 text-mute cursor-not-allowed' : 'bg-ink text-paper hover:bg-coral shadow-card'}`}
                        >
                            {isSubmitting ? 'Publishing...' : 'Publish Product'} <Icon name="check" size={16} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
