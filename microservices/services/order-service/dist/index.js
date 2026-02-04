"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3003;
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.json({ status: 'Order Service is running' });
});
app.get('/', (req, res) => {
    res.json([
        { id: 1, productId: 1, quantity: 1, status: 'pending' }
    ]);
});
app.post('/', (req, res) => {
    const order = req.body;
    res.status(201).json({ message: 'Order created', order });
    //update the database
    const { productId, quantity } = order;
    //Product.updateOne({ _id: productId }, { $inc: { stock: -quantity } });
});
app.listen(PORT, () => {
    console.log(`Order Service running on port ${PORT}`);
});
