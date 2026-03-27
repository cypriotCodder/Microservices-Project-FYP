import { Router } from 'express';
import { TrafficGenerator } from '../utils/TrafficGenerator';

const router = Router();
const generator = new TrafficGenerator();

router.post('/start', (req, res) => {
    const { targetUrl, rps } = req.body;

    if (!targetUrl || typeof rps !== 'number' || rps <= 0) {
        return res.status(400).json({ error: 'Valid targetUrl and positive rps required' });
    }

    generator.start(targetUrl, rps);
    res.json({ message: 'Traffic generation started', config: generator.getStatus() });
});

router.post('/stop', (req, res) => {
    generator.stop();
    res.json({ message: 'Traffic generation stopped', config: generator.getStatus() });
});

router.get('/status', (req, res) => {
    res.json(generator.getStatus());
});

export default router;
