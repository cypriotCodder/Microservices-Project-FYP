import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
    res.json({ status: 'Auth Module is running' });
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Stubbed logic same as microservice
    res.json({ message: 'Login endpoint', user: username || 'test-user' });
});

router.post('/register', (req, res) => {
    const { username, password } = req.body;
    res.json({ message: 'Register endpoint', user: username || 'test-user' });
});

export const authRouter = router;
