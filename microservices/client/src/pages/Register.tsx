import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/main.css';

export function Register() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        try {
            const response = await fetch('http://localhost:8080/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                alert('Registration Successful! Please login.');
                navigate('/login');
            } else {
                const data = await response.json();
                setError(data.message || 'Registration Failed');
            }
        } catch (err) {
            setError('Could not connect to the authentication service.');
        }
    };

    return (
        <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <h2 className="page-title" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Create Account</h2>

                {error && <div style={{ color: '#f44336', marginBottom: '1rem', textAlign: 'center', padding: '0.5rem', background: 'rgba(244, 67, 54, 0.1)', borderRadius: '4px' }}>{error}</div>}

                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Username</label>
                        <input
                            type="text"
                            className="input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Choose a username"
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Password</label>
                        <input
                            type="password"
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Choose a password"
                            required
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Confirm Password</label>
                        <input
                            type="password"
                            className="input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your password"
                            required
                        />
                    </div>
                    <button type="submit" className="btn" style={{ marginTop: '1rem' }}>Register</button>

                    <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Already have an account? </span>
                        <Link to="/login" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 'bold' }}>Login here</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
