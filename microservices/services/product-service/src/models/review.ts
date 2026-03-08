import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    userId: { type: String, required: true },
    title: { type: String },
    content: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 }
}, { timestamps: true });

export const Review = mongoose.model('Review', reviewSchema);
