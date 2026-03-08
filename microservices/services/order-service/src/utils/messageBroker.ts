import amqp, { Channel, ChannelModel } from "amqplib";

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
            await channel.assertQueue("ORDER_CREATED", { durable: true });

            console.log("Connected to RabbitMQ successfully");

            // Handle connection close events
            connection.on("close", () => {
                console.error("RabbitMQ connection closed. Retrying...");
                setTimeout(connectToRabbitMQ, 5000);
            });
            return;
        } catch (error) {
            console.error(`Failed to connect to RabbitMQ. Retries left: ${retries - 1}`, error);
            retries -= 1;
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    console.error("Could not connect to RabbitMQ after several attempts.");
};

// Helper to access the channel from other files
export const getChannel = (): Channel | null => {
    return channel;
};