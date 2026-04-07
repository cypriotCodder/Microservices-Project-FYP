import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
    productId: { type: String, required: true },
    userId: { type: String, required: true },
    content: { type: String, required: true }
}, { timestamps: true });

export const Comment = mongoose.model('Comment', commentSchema);
