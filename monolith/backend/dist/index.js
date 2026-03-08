"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = require("./routes/auth");
const products_1 = __importDefault(require("./routes/products"));
const orders_1 = __importDefault(require("./routes/orders"));
const recommendations_1 = __importDefault(require("./routes/recommendations"));
const product_1 = require("./controllers/product");
const db_1 = __importDefault(require("./config/db"));
dotenv_1.default.config();
(0, db_1.default)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use('/auth', auth_1.authRouter);
app.use('/products', products_1.default);
app.use('/orders', orders_1.default);
app.use('/recommendations', recommendations_1.default);
app.post('/seed', product_1.seedProducts);
app.get('/health', (req, res) => {
    res.json({ status: 'Monolith Backend is running' });
});
app.listen(PORT, () => {
    console.log(`Monolith Backend running on port ${PORT}`);
});
