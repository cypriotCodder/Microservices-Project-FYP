import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        // connect to the 'product_db' specifically
        await mongoose.connect("mongodb://mongo:27017/product_db");
        console.log("🍃 MongoDB Connected: Product Service");
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
    }
};

export default connectDB;