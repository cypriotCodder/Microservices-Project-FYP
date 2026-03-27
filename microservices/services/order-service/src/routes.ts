import express from "express";
import { createOrder, getOrders, deleteOrder, deleteAllOrders, getAdminMetrics, buyOrder } from "./controllers/orderController";

const router = express.Router();

router.get("/admin/metrics", getAdminMetrics); // GET /api/orders/admin/metrics
router.post("/", createOrder); // POST /api/orders
router.get("/:userId", getOrders); // GET /api/orders/:userId
router.delete("/all/:userId", deleteAllOrders); // DELETE /api/orders/all/:userId
router.delete("/:id", deleteOrder); // DELETE /api/orders/:id
router.post("/:id/buy", buyOrder);

export default router;