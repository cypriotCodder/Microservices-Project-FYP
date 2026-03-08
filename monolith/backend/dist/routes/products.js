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
    res.json({ status: 'Product Module is running' });
});
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //fetch from the database
    const products = yield products_1.Product.find();
    res.json(products);
}));
router.post('/', (req, res) => {
    const product = req.body;
    res.status(201).json({ message: 'Product created', product });
});
exports.default = router;
