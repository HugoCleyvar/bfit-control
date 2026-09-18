import { useEffect, useRef, useState, useCallback } from 'react';
import {
    ensureModelsLoaded,
    getFaceDescriptorFromVideo,
    getEnrolledFaceDescriptors,
    findBestMatch,
    type EnrolledFace
} from '../../logic/api/faceService';
import { RefreshCw, ScanFace } from 'lucide-react';

interface FaceCheckInProps {
    onMatch: (memberId: string) => void;
    // Pauses scanning while a check-in triggered by a previous match is still being processed.
    paused?: boolean;
}

type Status = 'loading-models' | 'starting-camera' | 'scanning' | 'error';

const SCAN_INTERVAL_MS = 1000;
// How long the same member is ignored after a match, so a person standing in front of the
// tablet doesn't get checked in again every second while they walk away.
const MEMBER_COOLDOWN_MS = 15000;

export function FaceCheckIn({ onMatch, paused }: FaceCheckInProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const enrolledRef = useRef<EnrolledFace[]>([]);
    const lastMatchRef = useRef<{ id: string; at: number } | null>(null);
    const scanningRef = useRef(false);

    const [status, setStatus] = useState<Status>('loading-models');
    const [errorMsg, setErrorMsg] = useState('');
    const [hint, setHint] = useState('');
    const [enrolledCount, setEnrolledCount] = useState(0);

    const loadEnrolled = useCallback(async () => {
        const faces = await getEnrolledFaceDescriptors();
        enrolledRef.current = faces;
        setEnrolledCount(faces.length);
    }, []);

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    };

    useEffect(() => {
        let cancelled = false;

        const start = async () => {
            setErrorMsg('');
            setStatus('loading-models');
            try {
                await Promise.all([ensureModelsLoaded(), loadEnrolled()]);
                if (cancelled) return;

                setStatus('starting-camera');
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                if (cancelled) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
                setStatus('scanning');
            } catch (err) {
                console.error('Error starting facial check-in camera:', err);
                if (!cancelled) {
                    setErrorMsg('No se pudo acceder a la cámara. Usa la búsqueda manual o revisa los permisos del navegador.');
                    setStatus('error');
                }
            }
        };

        start();

        return () => {
            cancelled = true;
            stopCamera();
        };
    }, [loadEnrolled]);

    useEffect(() => {
        if (status !== 'scanning') return;

        const tick = async () => {
            if (paused || scanningRef.current || !videoRef.current) return;
            scanningRef.current = true;
            try {
                const descriptor = await getFaceDescriptorFromVideo(videoRef.current);
                if (!descriptor) {
                    setHint('Buscando rostro...');
                    return;
                }

                if (enrolledRef.current.length === 0) {
                    setHint('Ningún socio tiene rostro registrado todavía.');
                    return;
                }

                const match = findBestMatch(descriptor, enrolledRef.current);
                if (!match) {
                    setHint('Rostro no reconocido. Usa la búsqueda manual si el problema persiste.');
                    return;
                }

                const last = lastMatchRef.current;
                if (last && last.id === match.id && Date.now() - last.at < MEMBER_COOLDOWN_MS) {
                    setHint(`Hola de nuevo, ${match.nombre} (ya registrado)`);
                    return;
                }

                lastMatchRef.current = { id: match.id, at: Date.now() };
                setHint(`¡Reconocido! ${match.nombre} ${match.apellido}`);
                onMatch(match.id);
            } finally {
                scanningRef.current = false;
            }
        };

        const interval = setInterval(tick, SCAN_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [status, paused, onMatch]);

    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
                <video
                    ref={videoRef}
                    muted
                    playsInline
                    style={{
                        width: '100%', maxWidth: '360px', borderRadius: '12px',
                        display: status === 'scanning' ? 'block' : 'none',
                        transform: 'scaleX(-1)',
                        border: paused ? '3px solid var(--color-warning)' : '3px solid var(--color-success)'
                    }}
                />
            </div>

            {(status === 'loading-models' || status === 'starting-camera') && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                    {status === 'loading-models' ? 'Cargando modelo de reconocimiento...' : 'Iniciando cámara...'}
                </p>
            )}

            {status === 'error' && (
                <p style={{ color: 'var(--color-danger)', fontSize: '14px' }}>{errorMsg}</p>
            )}

            {status === 'scanning' && (
                <>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <ScanFace size={14} /> {paused ? 'Procesando...' : hint || 'Escaneando...'}
                    </p>
                    <button
                        type="button"
                        onClick={loadEnrolled}
                        style={{ marginTop: '4px', background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                        <RefreshCw size={12} /> {enrolledCount} rostro(s) registrados · actualizar
                    </button>
                </>
            )}
        </div>
    );
}
