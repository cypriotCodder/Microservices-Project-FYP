import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        const connString = process.env.MONGO_URI || "mongodb://mongo:27017/product_db";
        console.log(`Attempting to connect to MongoDB... (URI defined: ${!!process.env.MONGO_URI})`);

        // connect to the 'product_db' specifically
        await mongoose.connect(connString);
        console.log("🍃 MongoDB Connected: Product Service");
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
    }
};

export default connectDB;