"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const product_1 = require("./models/product");
const productController_1 = require("./controllers/productController");
const db_1 = __importDefault(require("./config/db"));
dotenv_1.default.config();
(0, db_1.default)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3002;
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.json({ status: 'Product Service is running' });
});
app.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // fetch from the db
    const products = yield product_1.Product.find();
    res.json(products);
}));
app.post('/', (req, res) => {
    const product = req.body;
    res.status(201).json({ message: 'Product created', product });
});
app.post('/seed', productController_1.seedProducts);
app.listen(PORT, () => {
    console.log(`Product Service running on port ${PORT}`);
});
