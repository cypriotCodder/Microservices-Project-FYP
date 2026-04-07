"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Comment = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const commentSchema = new mongoose_1.default.Schema({
    productId: { type: String, required: true },
    userId: { type: String, required: true },
    content: { type: String, required: true }
}, { timestamps: true });
exports.Comment = mongoose_1.default.model('Comment', commentSchema);
