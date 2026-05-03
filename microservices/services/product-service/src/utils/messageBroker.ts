import amqp, { Channel, ChannelModel } from "amqplib";
import { Product } from "../models/product";
import { Comment } from "../models/comment";
import { redisClient } from "../config/redis";

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

// Docker service name for RabbitMQ is usually 'rabbitmq'
const RABBITMQ_URL = "amqp://rabbitmq:5672";

export const connectToRabbitMQ = async (): Promise<void> => {
  let retries = 5;
  while (retries > 0) {
    try {
      // 1. Connect to the RabbitMQ Server
      connection = await amqp.connect(RABBITMQ_URL);

      // 2. Create a Channel (This is where we publish/consume messages)
      channel = await connection.createChannel();

      // 3. Define the Queue (idempotent: only creates if it doesn't exist)
      // "durable: true" means the queue survives if RabbitMQ crashes
      await channel.assertQueue("ORDER_BOUGHT", { durable: true });

      console.log("Connected to RabbitMQ successfully");

      // Handle connection close events
      connection.on("close", () => {
        console.error("RabbitMQ connection closed. Retrying...");
        setTimeout(connectToRabbitMQ, 5000);
      });
      return; // Return immediately if successful
    } catch (error) {
      console.error(`Failed to connect to RabbitMQ. Retries left: ${retries - 1}`, error);
      retries -= 1;
      // Wait for 5 seconds before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  console.error("Could not connect to RabbitMQ after several attempts.");
};

// Helper to access the channel from other files
export const getChannel = (): Channel | null => {
  return channel;
};

export const consumeOrderBoughtEvents = async () => {
  if (!channel) {
    console.error("RabbitMQ channel not found. Cannot consume events.");
    return;
  }

  // Ensure the queue exists
  await channel.assertQueue("ORDER_BOUGHT", { durable: true });

  console.log("Listening for ORDER_BOUGHT events...");

  // Start consuming messages from the queue
  channel!.consume("ORDER_BOUGHT", async (msg) => {
    if (msg !== null) {
      try {
        // 1. Parse the message data
        const eventData = JSON.parse(msg.content.toString());
        console.log(`Received order event for Order ID: ${eventData.orderId}`);

        // 2. Loop through the products in the order
        if (eventData.products && Array.isArray(eventData.products)) {
          for (const item of eventData.products) {
            // Verify stock BEFORE decrementing
            const product = await Product.findById(item.productId);
            if (!product) {
              console.warn(`Product not found: ${item.productId}. Skipping.`);
              continue;
            }
            if (product.stock < item.quantity) {
              console.warn(`Insufficient stock for product ${item.productId}. Needed: ${item.quantity}, Available: ${product.stock}. Skipping decrement.`);
              // Note: Ideally we'd send an ORDER_FAILED event back here to cancel the order.
              continue;
            }

            // 3. Decrement the stock count in the MongoDB database
            await Product.updateOne(
              { _id: item.productId },
              { $inc: { stock: -item.quantity } }
            );
            
            // Invalidate the cache for this product and the master list
            await redisClient.del(`product:${item.productId}`);
            await redisClient.del('products:all');
            console.log(`Decremented stock for product ${item.productId} by ${item.quantity}`);
          }
        }

        // 4. Acknowledge (ack) the message so RabbitMQ removes it from the queue
        channel!.ack(msg);

      } catch (error) {
        console.error("Error processing ORDER_BOUGHT event:", error);
        // If it fails, we don't acknowledge, so RabbitMQ can requeue it or move it to a dead-letter queue
      }
    }
  });
};

// --- Comments Event Logic ---

export const publishCommentCreatedEvent = async (commentData: any) => {
  if (!channel) {
    console.error('Cannot publish CommentCreated: Channel is null');
    return;
  }
  channel.sendToQueue('COMMENT_CREATED', Buffer.from(JSON.stringify(commentData)), { persistent: true });
};

export const consumeCommentCreatedEvents = async () => {
  if (!channel) return;

  // Set up Dead Letter Exchange and Queue
  await channel.assertExchange('dlx_exchange', 'direct', { durable: true });
  await channel.assertQueue('COMMENT_DLQ', { durable: true });
  await channel.bindQueue('COMMENT_DLQ', 'dlx_exchange', 'dlq_routing_key');

  // Assert main queue pointing to DLX for rejects
  await channel.assertQueue('COMMENT_CREATED', {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'dlx_exchange',
      'x-dead-letter-routing-key': 'dlq_routing_key'
    }
  });

  console.log("Listening for COMMENT_CREATED events...");

  channel!.consume("COMMENT_CREATED", async (msg) => {
    if (msg !== null) {
      try {
        const data = JSON.parse(msg.content.toString());

        // 1. Insert into MongoDB
        const comment = await Comment.create({
          productId: data.productId,
          userId: data.userId,
          content: data.content
        });

        // 2. Add to Redis List for fast reads
        const redisKey = `product:${data.productId}:comments:recent`;
        await redisClient.lPush(redisKey, JSON.stringify(comment));
        await redisClient.lTrim(redisKey, 0, 49); // Keep top 50
        await redisClient.expire(redisKey, 3600); // 1 hr TTL

        // 3. Manual Ack
        channel!.ack(msg);
      } catch (error) {
        console.error("Error processing COMMENT_CREATED:", error);
        // NACK, send to DLQ instead of endlessly requeuing
        channel!.nack(msg, false, false);
      }
    }
  });
};

export const consumeOrderDeletedEvents = async () => {
  if (!channel) {
    console.error("RabbitMQ channel not found. Cannot consume events.");
    return;
  }

  // Ensure the queue exists
  await channel.assertQueue("ORDER_DELETED", { durable: true });

  console.log("Listening for ORDER_DELETED events...");

  // Start consuming messages from the queue
  channel!.consume("ORDER_DELETED", async (msg) => {
    if (msg !== null) {
      try {
        // 1. Parse the message data
        const eventData = JSON.parse(msg.content.toString());
        console.log(`Received order deleted event for Order ID: ${eventData.orderId}`);

        // 2. Loop through the products in the order
        if (eventData.products && Array.isArray(eventData.products)) {
          for (const item of eventData.products) {
            // 3. Increment the stock in the MongoDB database to refund
            await Product.updateOne(
              { _id: item.productId },
              { $inc: { stock: item.quantity } }
            );
            // Invalidate the cache for this product and the master list
            await redisClient.del(`product:${item.productId}`);
            await redisClient.del('products:all');
            console.log(`Refunded stock for product ${item.productId} by ${item.quantity}`);
          }
        }

        // 4. Acknowledge (ack) the message so RabbitMQ removes it from the queue
        channel!.ack(msg);

      } catch (error) {
        console.error("Error processing ORDER_DELETED event:", error);
      }
    }
  });
};