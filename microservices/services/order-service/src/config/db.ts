import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || '', {
            maxPoolSize: 20,                // cap concurrent connections (default is 100)
            serverSelectionTimeoutMS: 5000,  // fail fast if Mongo is unreachable
            socketTimeoutMS: 10000,          // kill idle sockets after 10s
        });
        console.log('MongoDB connected');
    } catch (error) {
        console.error('MongoDB connection error:', error);
    }
};

export default connectDB;