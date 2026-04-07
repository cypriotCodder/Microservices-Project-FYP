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
exports.consumeOrderDeletedEvents = exports.consumeCommentCreatedEvents = exports.publishCommentCreatedEvent = exports.consumeOrderBoughtEvents = exports.getChannel = exports.connectToRabbitMQ = void 0;
const amqplib_1 = __importDefault(require("amqplib"));
const product_1 = require("../models/product");
const comment_1 = require("../models/comment");
const redis_1 = require("../config/redis");
let connection = null;
let channel = null;
// Docker service name for RabbitMQ is usually 'rabbitmq'
const RABBITMQ_URL = "amqp://rabbitmq:5672";
const connectToRabbitMQ = () => __awaiter(void 0, void 0, void 0, function* () {
    let retries = 5;
    while (retries > 0) {
        try {
            // 1. Connect to the RabbitMQ Server
            connection = yield amqplib_1.default.connect(RABBITMQ_URL);
            // 2. Create a Channel (This is where we publish/consume messages)
            channel = yield connection.createChannel();
            // 3. Define the Queue (idempotent: only creates if it doesn't exist)
            // "durable: true" means the queue survives if RabbitMQ crashes
            yield channel.assertQueue("ORDER_BOUGHT", { durable: true });
            console.log("Connected to RabbitMQ successfully");
            // Handle connection close events
            connection.on("close", () => {
                console.error("RabbitMQ connection closed. Retrying...");
                setTimeout(exports.connectToRabbitMQ, 5000);
            });
            return; // Return immediately if successful
        }
        catch (error) {
            console.error(`Failed to connect to RabbitMQ. Retries left: ${retries - 1}`, error);
            retries -= 1;
            // Wait for 5 seconds before retrying
            yield new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    console.error("Could not connect to RabbitMQ after several attempts.");
});
exports.connectToRabbitMQ = connectToRabbitMQ;
// Helper to access the channel from other files
const getChannel = () => {
    return channel;
};
exports.getChannel = getChannel;
const consumeOrderBoughtEvents = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!channel) {
        console.error("RabbitMQ channel not found. Cannot consume events.");
        return;
    }
    // Ensure the queue exists
    yield channel.assertQueue("ORDER_BOUGHT", { durable: true });
    console.log("Listening for ORDER_BOUGHT events...");
    // Start consuming messages from the queue
    channel.consume("ORDER_BOUGHT", (msg) => __awaiter(void 0, void 0, void 0, function* () {
        if (msg !== null) {
            try {
                // 1. Parse the message data
                const eventData = JSON.parse(msg.content.toString());
                console.log(`Received order event for Order ID: ${eventData.orderId}`);
                // 2. Loop through the products in the order
                if (eventData.products && Array.isArray(eventData.products)) {
                    for (const item of eventData.products) {
                        // 3. Decrement the stock count in the MongoDB database
                        yield product_1.Product.updateOne({ _id: item.productId }, { $inc: { stock: -item.quantity } });
                        // Invalidate the cache for this product and the master list
                        yield redis_1.redisClient.del(`product:${item.productId}`);
                        yield redis_1.redisClient.del('products:all');
                        console.log(`Decremented stock for product ${item.productId} by ${item.quantity}`);
                    }
                }
                // 4. Acknowledge (ack) the message so RabbitMQ removes it from the queue
                channel.ack(msg);
            }
            catch (error) {
                console.error("Error processing ORDER_BOUGHT event:", error);
                // If it fails, we don't acknowledge, so RabbitMQ can requeue it or move it to a dead-letter queue
            }
        }
    }));
});
exports.consumeOrderBoughtEvents = consumeOrderBoughtEvents;
// --- Comments Event Logic ---
const publishCommentCreatedEvent = (commentData) => __awaiter(void 0, void 0, void 0, function* () {
    if (!channel) {
        console.error('Cannot publish CommentCreated: Channel is null');
        return;
    }
    channel.sendToQueue('COMMENT_CREATED', Buffer.from(JSON.stringify(commentData)), { persistent: true });
});
exports.publishCommentCreatedEvent = publishCommentCreatedEvent;
const consumeCommentCreatedEvents = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!channel)
        return;
    // Set up Dead Letter Exchange and Queue
    yield channel.assertExchange('dlx_exchange', 'direct', { durable: true });
    yield channel.assertQueue('COMMENT_DLQ', { durable: true });
    yield channel.bindQueue('COMMENT_DLQ', 'dlx_exchange', 'dlq_routing_key');
    // Assert main queue pointing to DLX for rejects
    yield channel.assertQueue('COMMENT_CREATED', {
        durable: true,
        arguments: {
            'x-dead-letter-exchange': 'dlx_exchange',
            'x-dead-letter-routing-key': 'dlq_routing_key'
        }
    });
    console.log("Listening for COMMENT_CREATED events...");
    channel.consume("COMMENT_CREATED", (msg) => __awaiter(void 0, void 0, void 0, function* () {
        if (msg !== null) {
            try {
                const data = JSON.parse(msg.content.toString());
                // 1. Insert into MongoDB
                const comment = yield comment_1.Comment.create({
                    productId: data.productId,
                    userId: data.userId,
                    content: data.content
                });
                // 2. Add to Redis List for fast reads
                const redisKey = `product:${data.productId}:comments:recent`;
                yield redis_1.redisClient.lPush(redisKey, JSON.stringify(comment));
                yield redis_1.redisClient.lTrim(redisKey, 0, 49); // Keep top 50
                yield redis_1.redisClient.expire(redisKey, 3600); // 1 hr TTL
                // 3. Manual Ack
                channel.ack(msg);
            }
            catch (error) {
                console.error("Error processing COMMENT_CREATED:", error);
                // NACK, send to DLQ instead of endlessly requeuing
                channel.nack(msg, false, false);
            }
        }
    }));
});
exports.consumeCommentCreatedEvents = consumeCommentCreatedEvents;
const consumeOrderDeletedEvents = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!channel) {
        console.error("RabbitMQ channel not found. Cannot consume events.");
        return;
    }
    // Ensure the queue exists
    yield channel.assertQueue("ORDER_DELETED", { durable: true });
    console.log("Listening for ORDER_DELETED events...");
    // Start consuming messages from the queue
    channel.consume("ORDER_DELETED", (msg) => __awaiter(void 0, void 0, void 0, function* () {
        if (msg !== null) {
            try {
                // 1. Parse the message data
                const eventData = JSON.parse(msg.content.toString());
                console.log(`Received order deleted event for Order ID: ${eventData.orderId}`);
                // 2. Loop through the products in the order
                if (eventData.products && Array.isArray(eventData.products)) {
                    for (const item of eventData.products) {
                        // 3. Increment the stock in the MongoDB database to refund
                        yield product_1.Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
                        // Invalidate the cache for this product and the master list
                        yield redis_1.redisClient.del(`product:${item.productId}`);
                        yield redis_1.redisClient.del('products:all');
                        console.log(`Refunded stock for product ${item.productId} by ${item.quantity}`);
                    }
                }
                // 4. Acknowledge (ack) the message so RabbitMQ removes it from the queue
                channel.ack(msg);
            }
            catch (error) {
                console.error("Error processing ORDER_DELETED event:", error);
            }
        }
    }));
});
exports.consumeOrderDeletedEvents = consumeOrderDeletedEvents;
