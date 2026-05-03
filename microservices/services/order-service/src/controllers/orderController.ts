import { Request, Response } from "express";
import { Order } from "../model/Order";
import { getChannel } from "../utils/messageBroker"; // Importing the tool we just built

export const createOrder = async (req: Request, res: Response) => {
  // 1. Get data from the user
  const { products, totalAmount } = req.body;
  const userId = req.headers['x-user-id'] as string;
  // Expecting body like: { totalAmount: 100, products: [{ productId: "abc", quantity: 1 }] }

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // 2. Save Order to DB (Initially PENDING)
    // We don't know if there is stock yet, so we mark it PENDING.
    const newOrder = await Order.create({
      userId,
      products,
      totalAmount,
      status: 'PENDING'
    });

    // PENDING orders act as the "Shopping Cart".
    // We intentionally SKIP sending the RabbitMQ stock decrement event here 
    // because the user has not clicked 'Buy' yet.


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
  const userId = req.params.userId;
  const currentUserId = req.headers['x-user-id'] as string;

  if (userId !== currentUserId) {
    return res.status(403).json({ error: "Forbidden: Cannot fetch orders for another user" });
  }

  try {
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const deleteOrder = async (req: Request, res: Response) => {
  const orderId = req.params.id;
  const currentUserId = req.headers['x-user-id'] as string;

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.userId !== currentUserId) {
      return res.status(403).json({ error: "Forbidden: You do not own this order" });
    }

    // Send Event to RabbitMQ fully refunding stock ONLY if the order was completed
    const channel = getChannel();

    if (channel && order.status === 'COMPLETED') {
        const eventData = JSON.stringify({
            orderId: order._id,
            products: order.products,
            userId: order.userId
        });

        // Send to the 'ORDER_DELETED' queue
        channel.sendToQueue("ORDER_DELETED", Buffer.from(eventData));
        console.log(`🗑️ Event Sent: ORDER_DELETED for Order ${order._id}`);
    } else if (!channel) {
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

export const deleteAllOrders = async (req: Request, res: Response) => {
  const userId = req.params.userId;
  const currentUserId = req.headers['x-user-id'] as string;

  if (userId !== currentUserId) {
    return res.status(403).json({ error: "Forbidden: Cannot delete orders for another user" });
  }

  try {
    const orders = await Order.find({ userId });

    // Send Events to RabbitMQ fully refunding stock for all orders
    const channel = getChannel();

    if (channel) {
      for (const order of orders) {
        if (order.status === 'COMPLETED') {
            const eventData = JSON.stringify({
                orderId: order._id,
                products: order.products,
                userId: order.userId
            });

            // Send to the 'ORDER_DELETED' queue
            channel.sendToQueue("ORDER_DELETED", Buffer.from(eventData));
            console.log(`🗑️ Event Sent: ORDER_DELETED for Order ${order._id}`);
        }
      }
    } else {
      console.warn("⚠️ RabbitMQ not connected! Orders deleted but stock not refunded.");
    }

    // Delete all user orders
    await Order.deleteMany({ userId });

    res.status(200).json({ message: "All orders deleted successfully" });
  } catch (error) {
    console.error("Failed to delete all orders:", error);
    res.status(500).json({ error: "Failed to delete all orders" });
  }
};

export const getAdminMetrics = async (req: Request, res: Response) => {
  try {
    const totalOrders = await Order.countDocuments();

    const revenueAgg = await Order.aggregate([{ $group: { _id: null, total: { $sum: "$totalAmount" } } }]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    const topProducts = await Order.aggregate([
      { $unwind: "$products" },
      { $group: { _id: "$products.productId", totalSold: { $sum: "$products.quantity" } } },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    // Orders per minute for the last hour
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);
    const ordersPerMinute = await Order.aggregate([
      { $match: { createdAt: { $gte: lastHour } } },
      {
        $group: {
          _id: { $dateTrunc: { date: "$createdAt", unit: "minute" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      totalOrders,
      totalRevenue,
      topProducts,
      ordersPerMinute
    });
  } catch (error) {
    console.error("Failed to fetch admin metrics:", error);
    res.status(500).json({ error: "Failed to fetch admin metrics" });
  }
};

export const buyOrder = async (req: Request, res: Response) => {
  const orderId = req.params.id;
  const currentUserId = req.headers['x-user-id'] as string;

  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.userId !== currentUserId) {
      return res.status(403).json({ error: "Forbidden: You do not own this order" });
    }

    if (order.status === 'COMPLETED') {
      return res.status(400).json({ error: "Order is already completed" });
    }

    // Send Event to RabbitMQ fully deleting product records
    const channel = getChannel();

    if (channel) {
      const eventData = JSON.stringify({
        orderId: order._id,
        products: order.products,
        userId: order.userId
      });

      // Send to the 'ORDER_BOUGHT' queue which completely deletes Product records
      channel.sendToQueue("ORDER_BOUGHT", Buffer.from(eventData));
      console.log(`✅ Event Sent: ORDER_BOUGHT for Order ${order._id}`);
    } else {
      console.warn("⚠️ RabbitMQ not connected! Order completed but items not removed from marketplace.");
    }

    // Checkout complete 
    order.status = 'COMPLETED';
    await order.save();

    res.status(200).json({ message: "Order completed successfully", order });
  } catch (error) {
    console.error("Failed to complete order checkout:", error);
    res.status(500).json({ error: "Failed to complete order" });
  }
};