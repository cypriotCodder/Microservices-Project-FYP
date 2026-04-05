// MongoDB connection removed — all data now lives in PostgreSQL via Prisma
export const connectDB = async () => {
    console.log('ℹ️  MongoDB connection removed. Using PostgreSQL via Prisma.');
};

export default connectDB;