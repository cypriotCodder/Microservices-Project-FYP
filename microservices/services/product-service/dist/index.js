"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3002;
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.json({ status: 'Product Service is running' });
});
app.get('/', (req, res) => {
    // Other fake products
    res.json([
        { id: 1, name: 'Laptop', price: 999 },
        { id: 2, name: 'Phone', price: 499 }
    ]);
});
app.post('/', (req, res) => {
    const product = req.body;
    res.status(201).json({ message: 'Product created', product });
});
app.listen(PORT, () => {
    console.log(`Product Service running on port ${PORT}`);
});
