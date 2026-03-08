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
exports.getOrders = exports.createOrder = void 0;
const Order_1 = require("../model/Order");
const messageBroker_1 = require("../utils/messageBroker"); // Importing the tool we just built
const createOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // 1. Get data from the user
    const { products, userId, totalAmount } = req.body;
    // Expecting body like: { userId: "123", totalAmount: 100, products: [{ productId: "abc", quantity: 1 }] }
    try {
        // 2. Save Order to DB (Initially PENDING)
        // We don't know if there is stock yet, so we mark it PENDING.
        const newOrder = yield Order_1.Order.create({
            userId,
            products,
            totalAmount,
            status: 'PENDING'
        });
        // 3. Send Event to RabbitMQ
        const channel = (0, messageBroker_1.getChannel)();
        if (channel) {
            const eventData = JSON.stringify({
                orderId: newOrder._id,
                products: products,
                userId: userId
            });
            // Send to the 'ORDER_CREATED' queue
            channel.sendToQueue("ORDER_CREATED", Buffer.from(eventData));
            console.log(`📤 Event Sent: ORDER_CREATED for Order ${newOrder._id}`);
        }
        else {
            // Critical for Dissertation: This logs a failure in your 'Fault Tolerance' test
            console.warn("⚠️ RabbitMQ not connected! Order saved but stock not updated.");
        }
        // 4. Return immediate response (Low Latency!)
        res.status(201).json({
            message: "Order placed successfully. Processing...",
            order: newOrder
        });
    }
    catch (error) {
        console.error("Order creation failed:", error);
        res.status(500).json({ error: "Failed to create order" });
    }
});
exports.createOrder = createOrder;
const getOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orders = yield Order_1.Order.find().sort({ createdAt: -1 });
        res.status(200).json(orders);
    }
    catch (error) {
        console.error("Failed to fetch orders:", error);
        res.status(500).json({ error: "Failed to fetch orders" });
    }
});
exports.getOrders = getOrders;
