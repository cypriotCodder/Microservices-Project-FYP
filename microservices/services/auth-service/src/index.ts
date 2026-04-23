import './tracing';
import express from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'Auth Service is running' });
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { username, password: hashedPassword },
        });

        res.status(201).json({ message: 'User created successfully', userId: user.id, role: user.role });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ sub: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, userId: user.id, username: user.username, role: user.role });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/admin/users/count', async (req, res) => {
    try {
        const count = await prisma.user.count();
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// POST /seed-users — create 50 k6 test accounts
// curl -X POST http://localhost:8080/auth/seed-users
app.post('/seed-users', async (req, res) => {
    try {
        const hash = await bcrypt.hash('password123', 10);
        let created = 0;
        let skipped = 0;
        for (let i = 0; i < 50; i++) {
            const username = `user${i}@test.com`;
            const existing = await prisma.user.findUnique({ where: { username } });
            if (existing) { skipped++; continue; }
            await prisma.user.create({ data: { username, password: hash } });
            created++;
        }
        res.json({ message: `Seeded ${created} users (${skipped} already existed)` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to seed users', details: String(error) });
    }
});

app.listen(PORT, () => {
    console.log(`Auth Service running on port ${PORT}`);
});
