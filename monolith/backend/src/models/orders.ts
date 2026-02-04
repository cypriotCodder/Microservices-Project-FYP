import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    userId: { type: String, required: true }, // Simple string for now
    products: [
        {
            productId: { type: String, required: true },
            quantity: { type: Number, required: true }
        }
    ],
    totalAmount: { type: Number, required: true },
    status: {
        type: String,
        enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
        default: 'PENDING'
    }
}, { timestamps: true });

export const Order = mongoose.model("Order", orderSchema);