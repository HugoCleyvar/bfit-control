import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../logic/authContext';
import { LogIn } from 'lucide-react';

import { supabase, isConfigured } from '../../logic/api/supabase'; // Import check and supabase client

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Warn if env vars are missing
    if (!isConfigured) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexDirection: 'column', gap: '20px' }}>
                <h1>⚠️ Error de Configuración</h1>
                <p>No se detectaron las variables de entorno (.env)</p>
                <p>Asegúrate de que el archivo `.env` existe y reinicia el servidor.</p>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Login: Start');
        setLoading(true);
        setError(null);

        try {
            console.log('Login: Calling context login...');
            const err = await login(email, password);
            console.log('Login: Returned from context login', err);

            if (err) {
                setError(err);
            } else {
                console.log('Login: Success, navigating...');
                navigate('/');
            }
        } catch (e: any) {
            console.error('Login: Exception detected', e);
            setError('Error inesperado: ' + e.message);
        } finally {
            console.log('Login: Setting loading false');
            setLoading(false);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-bg)',
            padding: 'var(--spacing-md)'
        }}>
            <div style={{
                backgroundColor: 'var(--color-card)',
                padding: 'var(--spacing-xl)',
                borderRadius: 'var(--radius-lg)',
                width: '100%',
                maxWidth: '400px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
                    <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--spacing-xs)' }}>
                        BFIT<span style={{ color: 'var(--color-accent)' }}>control</span>
                    </h1>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Inicia sesión para continuar</p>
                </div>

                {error && (
                    <div style={{
                        backgroundColor: 'rgba(255, 77, 77, 0.1)',
                        color: 'var(--color-danger)',
                        padding: 'var(--spacing-md)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--spacing-md)',
                        textAlign: 'center',
                        fontSize: 'var(--font-size-sm)'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="admin@bfit.com" // Hint for testing
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'rgba(0,0,0,0.2)',
                                color: 'var(--color-text-primary)'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••"
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'rgba(0,0,0,0.2)',
                                color: 'var(--color-text-primary)'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: 'var(--spacing-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--spacing-sm)'
                        }}
                    >
                        {loading ? 'Entrando...' : (
                            <>
                                <LogIn size={18} /> Entrar
                            </>
                        )}
                    </button>
                </form>

                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <button
                        type="button"
                        onClick={async () => {
                            try {
                                alert('Probando conexión...');
                                const start = Date.now();
                                const { error } = await supabase.from('plans').select('count').limit(1).single();
                                const time = Date.now() - start;
                                if (error) alert('❌ Error Conexión: ' + error.message);
                                else alert(`✅ Conexión Exitosa (${time}ms)`);
                            } catch (e: any) {
                                alert('❌ Excepción: ' + e.message);
                            }
                        }}
                        style={{
                            background: 'transparent',
                            border: '1px solid #666',
                            color: '#666',
                            padding: '5px 10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        🛠️ Probar SDK (Supabase)
                    </button>

                    <button
                        type="button"
                        onClick={async () => {
                            try {
                                alert('Probando conexión directa (Fetch)...');
                                const start = Date.now();
                                // Try fetching the health check or just the base URL
                                const res = await fetch('https://bpsbwwnxonesjtsmuzjb.supabase.co/rest/v1/', {
                                    method: 'HEAD',
                                    headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY }
                                });
                                const time = Date.now() - start;
                                if (res.ok || res.status === 200 || res.status === 404) alert(`✅ Internet OK (${res.status} - ${time}ms)`);
                                else alert(`⚠️ Internet Raro: Status ${res.status}`);
                            } catch (e: any) {
                                alert('❌ ERROR RED: ' + e.message);
                            }
                        }}
                        style={{
                            background: 'transparent',
                            border: '1px solid #666',
                            color: '#666',
                            padding: '5px 10px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            marginLeft: '10px'
                        }}
                    >
                        🌐 Probar Internet
                    </button>
                </div>

                <div style={{ marginTop: 'var(--spacing-lg)', textAlign: 'center', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    <p>Prueba: admin@bfit.com</p>
                </div>
            </div>
        </div>
    );
}
