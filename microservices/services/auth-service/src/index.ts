import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'Auth Service is running' });
});

app.post('/login', (req, res) => {
    // TODO: Implement login logic
    const { username, password } = req.body;
    res.json({ message: 'Login endpoint', user: username });
});

app.post('/register', (req, res) => {
    // TODO: Implement register logic
    const { username, password } = req.body;
    res.json({ message: 'Register endpoint', user: username });
});

app.listen(PORT, () => {
    console.log(`Auth Service running on port ${PORT}`);
});
