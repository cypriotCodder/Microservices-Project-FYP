import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { API_URL } from '../api/client';

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
            const response = await fetch(`${API_URL}/auth/register`, {
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
        <div className="min-h-[80vh] flex items-center justify-center px-6">
            <div className="w-full max-w-sm rounded-3xl bg-paper shadow-cardHi border border-line p-8 md:p-10 animate-slideIn">
                <div className="flex justify-center mb-6">
                    <span className="w-12 h-12 rounded-xl bg-ink text-paper grid place-items-center shadow-card">
                        <Icon name="logo" size={24} />
                    </span>
                </div>
                
                <h2 className="text-2xl font-medium tracking-tight text-center mb-2">Create Account</h2>
                <p className="text-sm text-mute text-center mb-8">Join the MicroShop community.</p>
                
                {error && (
                    <div className="mb-6 p-3 rounded-xl bg-coralBg text-coralHi text-sm text-center border border-coral/20">
                        {error}
                    </div>
                )}

                <form onSubmit={handleRegister} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-mute mb-1.5 ml-1">Email or Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="you@example.com"
                            required
                            className="focus-ring w-full h-11 px-4 rounded-full bg-paper border border-line text-sm placeholder:text-mute transition"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-mute mb-1.5 ml-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="focus-ring w-full h-11 px-4 rounded-full bg-paper border border-line text-sm placeholder:text-mute transition"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] uppercase tracking-wider text-mute mb-1.5 ml-1">Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="focus-ring w-full h-11 px-4 rounded-full bg-paper border border-line text-sm placeholder:text-mute transition"
                        />
                    </div>
                    
                    <button type="submit" className="mt-2 h-11 w-full rounded-full bg-ink text-paper text-sm font-medium hover:bg-coral transition shadow-card flex items-center justify-center gap-2">
                        Create Account <Icon name="right" size={14} />
                    </button>

                    <div className="mt-4 text-center text-sm text-mute">
                        Already have an account?{' '}
                        <Link to="/login" className="text-ink font-medium hover:text-coral transition">Sign In</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
