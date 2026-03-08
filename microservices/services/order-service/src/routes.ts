import express from "express";
import { createOrder, getOrders, deleteOrder } from "./controllers/orderController";

const router = express.Router();

router.post("/", createOrder); // POST /api/orders
router.get("/", getOrders); // GET /api/orders
router.delete("/:id", deleteOrder); // DELETE /api/orders/:id

export default router;