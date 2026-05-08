import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchFromAPI } from '../api/client';
import '../styles/main.css';

export function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const data = await fetchFromAPI('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password }),
            });
            localStorage.setItem('user', JSON.stringify(data));
            navigate('/');
        } catch (err: any) {
            alert(err.message || 'Login Failed');
        }
    };

    return (
        <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <h2 className="page-title" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>MicroShop Login</h2>
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Username</label>
                        <input
                            type="text"
                            className="input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Password</label>
                        <input
                            type="password"
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                        />
                    </div>
                    <button type="submit" className="btn" style={{ marginTop: '1rem' }}>Login</button>

                    <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Don't have an account? </span>
                        <Link to="/register" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 'bold' }}>Create one</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
