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
exports.getChannel = exports.connectToRabbitMQ = void 0;
const amqplib_1 = __importDefault(require("amqplib"));
let connection = null;
let channel = null;
// Docker service name for RabbitMQ is usually 'rabbitmq'
const RABBITMQ_URL = "amqp://rabbitmq:5672";
const connectToRabbitMQ = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. Connect to the RabbitMQ Server
        connection = yield amqplib_1.default.connect(RABBITMQ_URL);
        // 2. Create a Channel (This is where we publish/consume messages)
        channel = yield connection.createChannel();
        // 3. Define the Queue (idempotent: only creates if it doesn't exist)
        // "durable: true" means the queue survives if RabbitMQ crashes
        yield channel.assertQueue("ORDER_CREATED", { durable: true });
        console.log("Connected to RabbitMQ successfully");
        // Handle connection close events
        connection.on("close", () => {
            console.error("RabbitMQ connection closed. Retrying...");
            setTimeout(exports.connectToRabbitMQ, 5000);
        });
    }
    catch (error) {
        console.error("Failed to connect to RabbitMQ:", error);
        // Retry logic: try again in 5 seconds if connection fails
        setTimeout(exports.connectToRabbitMQ, 5000);
    }
});
exports.connectToRabbitMQ = connectToRabbitMQ;
// Helper to access the channel from other files
const getChannel = () => {
    return channel;
};
exports.getChannel = getChannel;
