import mongoose from 'mongoose';

// Connect to MongoDB
export const connectMongo = async (uri: string) => {
    try {
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
};

// Define Mongoose Schemas directly within the seeder for self-containment
export const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true, default: 0 },
    category: { type: String },
    image: { type: String }
}, { timestamps: true });

export const ReviewSchema = new mongoose.Schema({
    productId: { type: String, required: true },
    userId: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true }
}, { timestamps: true });

export const OrderSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    products: [{
        productId: { type: String, required: true },
        quantity: { type: Number, required: true }
    }],
    totalAmount: { type: Number, required: true },
    status: { type: String, default: 'pending' }
}, { timestamps: true });

export const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export const Review = mongoose.models.Review || mongoose.model('Review', ReviewSchema);
export const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
