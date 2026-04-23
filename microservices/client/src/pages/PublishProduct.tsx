import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { fetchFromAPI } from '../api/client';
import '../styles/main.css';

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
            alert('Product published successfully!');
            navigate('/');
        } catch (err: any) {
            alert(`Failed to publish product: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <Navbar />
            <div className="container" style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                <div className="card" style={{ width: '100%', maxWidth: '600px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 className="page-title" style={{ margin: 0 }}>Publish New Product</h2>
                        <button 
                            type="button" 
                            onClick={handleMockFill}
                            style={{
                                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                color: '#6366f1',
                                border: '1px solid rgba(99, 102, 241, 0.5)',
                                padding: '0.4rem 0.8rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 'bold'
                            }}
                        >
                            ⚡ Auto-Fill Mock Data
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: 2 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Product Name *</label>
                                <input required type="text" className="input" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., Wireless Headphones" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Price ($) *</label>
                                <input required type="number" step="0.01" min="0" className="input" name="price" value={formData.price} onChange={handleChange} placeholder="99.99" />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Category *</label>
                                <input required type="text" className="input" name="category" value={formData.category} onChange={handleChange} placeholder="e.g., Electronics" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Initial Stock *</label>
                                <input required type="number" min="0" className="input" name="stock" value={formData.stock} onChange={handleChange} placeholder="50" />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Image URL (Optional)</label>
                            <input type="url" className="input" name="image" value={formData.image} onChange={handleChange} placeholder="https://example.com/image.jpg" />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Description</label>
                            <textarea 
                                className="input" 
                                name="description" 
                                value={formData.description} 
                                onChange={handleChange} 
                                rows={4} 
                                placeholder="Describe the product..."
                                style={{ resize: 'vertical' }}
                            />
                        </div>

                        <button type="submit" className="btn" style={{ marginTop: '1rem' }} disabled={isSubmitting}>
                            {isSubmitting ? 'Publishing...' : 'Publish Product'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
