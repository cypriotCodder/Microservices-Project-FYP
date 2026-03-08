import { Request, Response } from "express";
import { Order } from "../model/Order";
import { getChannel } from "../utils/messageBroker"; // Importing the tool we just built

export const createOrder = async (req: Request, res: Response) => {
  // 1. Get data from the user
  const { products, userId, totalAmount } = req.body;
  // Expecting body like: { userId: "123", totalAmount: 100, products: [{ productId: "abc", quantity: 1 }] }

  try {
    // 2. Save Order to DB (Initially PENDING)
    // We don't know if there is stock yet, so we mark it PENDING.
    const newOrder = await Order.create({
      userId,
      products,
      totalAmount,
      status: 'PENDING'
    });

    // 3. Send Event to RabbitMQ
    const channel = getChannel();

    if (channel) {
      const eventData = JSON.stringify({
        orderId: newOrder._id,
        products: products,
        userId: userId
      });

      // Send to the 'ORDER_CREATED' queue
      channel.sendToQueue("ORDER_CREATED", Buffer.from(eventData));
      console.log(`📤 Event Sent: ORDER_CREATED for Order ${newOrder._id}`);
    } else {
      // Critical for Dissertation: This logs a failure in your 'Fault Tolerance' test
      console.warn("⚠️ RabbitMQ not connected! Order saved but stock not updated.");
    }

    // 4. Return immediate response (Low Latency!)
    res.status(201).json({
      message: "Order placed successfully. Processing...",
      order: newOrder
    });

  } catch (error) {
    console.error("Order creation failed:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const deleteOrder = async (req: Request, res: Response) => {
  const orderId = req.params.id;

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Send Event to RabbitMQ fully refunding stock
    const channel = getChannel();

    if (channel) {
      const eventData = JSON.stringify({
        orderId: order._id,
        products: order.products,
        userId: order.userId
      });

      // Send to the 'ORDER_DELETED' queue
      channel.sendToQueue("ORDER_DELETED", Buffer.from(eventData));
      console.log(`🗑️ Event Sent: ORDER_DELETED for Order ${order._id}`);
    } else {
      console.warn("⚠️ RabbitMQ not connected! Order deleted but stock not refunded.");
    }

    // Delete the order 
    await Order.findByIdAndDelete(orderId);

    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Failed to delete order:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
};