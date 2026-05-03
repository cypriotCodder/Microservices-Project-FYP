"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../config/prisma");
const router = (0, express_1.Router)();
router.get('/health', (req, res) => {
    res.json({ status: 'Recommendation Module is running' });
});
router.get('/:userId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    try {
        // Simple logic: return recent recommendations for this user
        // In a real app, this would be complex ML model output stored in DB
        const recommendations = yield prisma_1.prisma.recommendation.findMany({
            where: { userId },
            orderBy: { score: 'desc' },
            take: 5
        });
        // If no specific recommendations, return default/fallback (mocked for now)
        if (recommendations.length === 0) {
            return res.json({
                userId,
                message: "No personalized recommendations yet, showing popular items",
                recommendations: [
                    { productId: '101', score: 0.9 },
                    { productId: '102', score: 0.8 }
                ]
            });
        }
        res.json({ userId, recommendations });
    }
    catch (error) {
        console.error("Error fetching recommendations:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}));
router.post('/click', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Endpoint to track user clicks/views on products
    const { userId, productId } = req.body;
    try {
        const uid = String(userId);
        const pid = String(productId);
        const existingRec = yield prisma_1.prisma.recommendation.findFirst({
            where: { userId: uid, productId: pid }
        });
        if (existingRec) {
            // Increment score by 1 for an additional click/view
            const updatedRec = yield prisma_1.prisma.recommendation.update({
                where: { id: existingRec.id },
                data: { score: existingRec.score + 1 }
            });
            return res.status(200).json(updatedRec);
        }
        else {
            // New interaction gets a score of 1
            const newRec = yield prisma_1.prisma.recommendation.create({
                data: { userId: uid, productId: pid, score: 1 }
            });
            return res.status(201).json(newRec);
        }
    }
    catch (error) {
        console.error("Error tracking product click:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}));
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Endpoint to seed/add recommendations (e.g. from Python ML service)
    const { userId, productId, score } = req.body;
    try {
        const rec = yield prisma_1.prisma.recommendation.create({
            data: { userId: String(userId), productId: String(productId), score }
        });
        res.status(201).json(rec);
    }
    catch (error) {
        console.error("Error creating recommendation:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}));
exports.default = router;
