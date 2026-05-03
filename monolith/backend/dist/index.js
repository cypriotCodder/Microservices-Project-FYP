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
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = require("./routes/auth");
const products_1 = __importDefault(require("./routes/products"));
const orders_1 = __importDefault(require("./routes/orders"));
const recommendations_1 = __importDefault(require("./routes/recommendations"));
const llm_1 = __importDefault(require("./routes/llm"));
const content_1 = __importDefault(require("./routes/content"));
const product_1 = require("./controllers/product");
const telemetry_1 = require("./middleware/telemetry");
const admin_1 = __importDefault(require("./routes/admin"));
const traffic_1 = __importDefault(require("./routes/traffic"));
const redis_1 = require("./config/redis");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
app.use(telemetry_1.telemetryMiddleware);
// Routes
app.use('/auth', auth_1.authRouter);
app.use('/products', products_1.default);
app.use('/orders', orders_1.default);
app.use('/recommendations', recommendations_1.default);
app.use('/llm', llm_1.default);
app.use('/content', content_1.default);
app.post('/seed', product_1.seedProducts);
app.use('/admin', admin_1.default);
app.use('/traffic', traffic_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'Monolith Backend is running', db: 'PostgreSQL' });
});
app.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, redis_1.connectRedis)();
    console.log(`🚀 Monolith Backend running on port ${PORT}`);
    console.log(`🐘 Database: PostgreSQL (Prisma)`);
}));
