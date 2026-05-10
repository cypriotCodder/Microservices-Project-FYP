import mongoose from 'mongoose';

//product schema for the DB
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

export const Product = mongoose.model('Product', ProductSchema);