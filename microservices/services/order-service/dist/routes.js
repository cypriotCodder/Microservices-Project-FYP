"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const orderController_1 = require("./controllers/orderController");
const router = express_1.default.Router();
router.post("/", orderController_1.createOrder); // POST /api/orders
router.get("/", orderController_1.getOrders); // GET /api/orders
exports.default = router;
