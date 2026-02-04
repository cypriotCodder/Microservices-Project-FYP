import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String },
    stock: { type: Number, required: true, default: 0 },
    // Version key helps with concurrency (dissertation discussion)
}, { timestamps: true });

export const Product = mongoose.model("Product", productSchema);    