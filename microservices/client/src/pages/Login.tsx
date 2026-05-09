import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { API_URL } from '../api/client';

export function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('user', JSON.stringify(data));
                navigate('/');
            } else {
                alert('Login Failed');
            }
        } catch (error) {
            alert('Login Failed');
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center px-6">
            <div className="w-full max-w-sm rounded-3xl bg-paper shadow-cardHi border border-line p-8 md:p-10 animate-slideIn">
                <div className="flex justify-center mb-6">
                    <span className="w-12 h-12 rounded-xl bg-ink text-paper grid place-items-center shadow-card">
                        <Icon name="logo" size={24} />
                    </span>
                </div>
                
                <h2 className="text-2xl font-medium tracking-tight text-center mb-2">Welcome back</h2>
                <p className="text-sm text-mute text-center mb-8">Sign in to your MicroShop account.</p>
                
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-mute mb-1.5 ml-1">Email or Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="you@example.com"
                            className="focus-ring w-full h-11 px-4 rounded-full bg-paper border border-line text-sm placeholder:text-mute transition"
                        />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1.5 mx-1">
                            <label className="text-[11px] uppercase tracking-wider text-mute">Password</label>
                            <a href="#" className="text-[11px] text-coral hover:text-coralHi">forgot?</a>
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="focus-ring w-full h-11 px-4 rounded-full bg-paper border border-line text-sm placeholder:text-mute transition"
                        />
                    </div>
                    <button type="submit" className="mt-2 h-11 w-full rounded-full bg-ink text-paper text-sm font-medium hover:bg-coral transition shadow-card flex items-center justify-center gap-2">
                        Sign In <Icon name="right" size={14} />
                    </button>

                    <div className="mt-4 text-center text-sm text-mute">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-ink font-medium hover:text-coral transition">Create one</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
