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
const review_1 = require("./models/review");
const comment_1 = require("./models/comment");
const productController_1 = require("./controllers/productController");
const db_1 = __importDefault(require("./config/db"));
const redis_1 = require("./config/redis");
const messageBroker_1 = require("./utils/messageBroker");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3002;
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.json({ status: 'Product Service is running' });
});
app.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cachedProducts = yield redis_1.redisClient.get('products:all');
        if (cachedProducts) {
            return res.json(JSON.parse(cachedProducts));
        }
        const products = yield product_1.Product.find();
        yield redis_1.redisClient.setEx('products:all', 3600, JSON.stringify(products));
        res.json(products);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching products', error });
    }
}));
app.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cacheKey = `product:${req.params.id}`;
        const cachedProduct = yield redis_1.redisClient.get(cacheKey);
        if (cachedProduct) {
            return res.json(JSON.parse(cachedProduct));
        }
        const product = yield product_1.Product.findById(req.params.id);
        if (!product)
            return res.status(404).json({ message: 'Product not found' });
        yield redis_1.redisClient.setEx(cacheKey, 3600, JSON.stringify(product));
        res.json(product);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching product', error });
    }
}));
app.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const product = yield product_1.Product.create(req.body);
        yield redis_1.redisClient.del('products:all'); // Invalidate cache
        res.status(201).json({ message: 'Product created', product });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to create product', error });
    }
}));
app.delete('/all', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield product_1.Product.deleteMany({});
        yield review_1.Review.deleteMany({}); // Clean up orphaned reviews
        yield redis_1.redisClient.del('products:all'); // Invalidate cache
        res.json({ message: 'All products and reviews seamlessly wiped from database' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to delete products', error });
    }
}));
app.post('/:productId/reviews', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { productId } = req.params;
        const reviewData = Object.assign(Object.assign({}, req.body), { productId });
        const review = yield review_1.Review.create(reviewData);
        res.status(201).json({ message: 'Review created', review });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to create review', error });
    }
}));
app.post('/:productId/comments', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { productId } = req.params;
        const commentData = Object.assign(Object.assign({}, req.body), { productId });
        // Asynchronous publish, immediately return
        yield (0, messageBroker_1.publishCommentCreatedEvent)(commentData);
        res.status(202).json({ message: 'Comment creation accepted and placed in queue' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to queue comment', error });
    }
}));
app.get('/:productId/reviews', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const reviews = yield review_1.Review.find({ productId: req.params.productId }).sort({ createdAt: -1 });
        res.json(reviews);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching reviews', error });
    }
}));
app.get('/:productId/comments', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { productId } = req.params;
        // Check Redis list first (populated asynchronously by the COMMENT_CREATED consumer)
        const redisKey = `product:${productId}:comments:recent`;
        const cached = yield redis_1.redisClient.lRange(redisKey, 0, 49);
        if (cached.length > 0) {
            return res.json(cached.map(c => JSON.parse(c)));
        }
        // Cache miss — fall back to MongoDB
        const comments = yield comment_1.Comment.find({ productId }).sort({ createdAt: -1 }).limit(50);
        res.json(comments);
    }
    catch (error) {
        res.status(500).json({ message: 'Error fetching comments', error });
    }
}));
app.post('/seed', productController_1.seedProducts);
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    (0, db_1.default)();
    yield (0, redis_1.connectRedis)();
    // CONNECT TO RABBITMQ
    yield (0, messageBroker_1.connectToRabbitMQ)();
    // START CONSUMING MESSAGES
    // 2. Start listening to queues
    yield (0, messageBroker_1.consumeOrderBoughtEvents)();
    yield (0, messageBroker_1.consumeOrderDeletedEvents)();
    yield (0, messageBroker_1.consumeCommentCreatedEvents)();
    app.listen(PORT, () => {
        console.log(`Product Service running on port ${PORT}`);
    });
});
startServer();
