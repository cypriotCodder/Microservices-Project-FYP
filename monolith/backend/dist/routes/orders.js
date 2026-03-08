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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const products_1 = require("../models/products");
const router = (0, express_1.Router)();
router.get('/health', (req, res) => {
    res.json({ status: 'Order Module is running' });
});
router.get('/', (req, res) => {
    res.json([
        { id: 1, productId: 1, quantity: 1, status: 'pending' }
    ]);
});
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const order = req.body;
    try {
        // Directly decrement stock in the same request for monolith
        if (order.products && Array.isArray(order.products)) {
            for (const item of order.products) {
                yield products_1.Product.updateOne({ _id: item.productId }, { $inc: { stock: -item.quantity } });
            }
        }
        res.status(201).json({ message: 'Order created', order });
    }
    catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
}));
exports.default = router;
