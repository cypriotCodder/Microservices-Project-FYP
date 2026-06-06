import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

// Inline schema to avoid importing the full app wiring
const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: 'https://via.placeholder.com/150?text=Product' },
    category: { type: String, required: true },
    stock: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);

const sampleProducts = [
    {
        _id: '65bf73e93409110012345678',
        name: 'MacBook Pro M3',
        description: 'High performance laptop',
        price: 1999,
        stock: 100,
        image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=1000',
        category: 'Electronics'
    },
    {
        _id: '65bf73e93409110087654321',
        name: 'iPhone 15',
        description: 'Latest smartphone',
        price: 999,
        stock: 5,
        image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&q=80&w=1000',
        category: 'Electronics'
    },
    {
        _id: '65bf73e93409110000000000',
        name: 'Sony Headphones',
        description: 'Noise cancelling',
        price: 299,
        stock: 0,
        image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&q=80&w=1000',
        category: 'Electronics'
    }
];

async function seedStartup() {
    const mongoUri = process.env.MONGO_URI || '';
    if (!mongoUri) {
        console.error('[Seed]  MONGO_URI not set, skipping product seed');
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoUri);
        console.log('[Seed] Connected to MongoDB');

        const count = await Product.countDocuments();
        if (count > 0) {
            console.log(`[Seed]   Products collection already has ${count} documents, skipping seed`);
        } else {
            await Product.insertMany(sampleProducts);
            console.log(`[Seed]  Seeded ${sampleProducts.length} sample products`);
        }
    } catch (e) {
        console.error('[Seed]  Product seed failed:', e);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

seedStartup();
