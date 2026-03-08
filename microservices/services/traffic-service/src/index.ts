import express from 'express';
import cors from 'cors';
import { TrafficGenerator } from './TrafficGenerator';

const app = express();
const PORT = process.env.PORT || 3007;

app.use(express.json());
app.use(cors());

// Initialize the single generator engine for the service
const generator = new TrafficGenerator();

// Expose control APIs
app.post('/start', (req, res) => {
    const { targetUrl, rps } = req.body;

    if (!targetUrl || typeof rps !== 'number' || rps <= 0) {
        return res.status(400).json({ error: 'Valid targetUrl and positive rps required' });
    }

    generator.start(targetUrl, rps);
    res.json({ message: 'Traffic generation started', config: generator.getStatus() });
});

app.post('/stop', (req, res) => {
    generator.stop();
    res.json({ message: 'Traffic generation stopped', config: generator.getStatus() });
});

app.get('/status', (req, res) => {
    res.json(generator.getStatus());
});

app.get('/health', (req, res) => {
    res.json({ status: 'Traffic Service is running' });
});

app.listen(PORT, () => {
    console.log(`Traffic Service running on port ${PORT}`);
});
