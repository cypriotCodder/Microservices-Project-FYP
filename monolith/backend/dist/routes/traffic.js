"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const TrafficGenerator_1 = require("../utils/TrafficGenerator");
const router = (0, express_1.Router)();
const generator = new TrafficGenerator_1.TrafficGenerator();
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
exports.default = router;
