import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { loadFaceModels, detectDescriptor } from '../../logic/faceService';

interface Props {
    title: string;
    hint?: string;
    /** Called with each detected descriptor. Return true to stop scanning. */
    onDescriptor: (descriptor: number[]) => Promise<boolean | void> | boolean | void;
    onClose: () => void;
    status?: string;
}

export function FaceScanner({ title, hint, onDescriptor, onClose, status }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState('');
    const handlerRef = useRef(onDescriptor);
    handlerRef.current = onDescriptor;

    useEffect(() => {
        let cancelled = false;
        let stream: MediaStream | null = null;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const tick = async () => {
            if (cancelled) return;
            const video = videoRef.current;
            let stop = false;
            if (video && video.readyState >= 2) {
                try {
                    const d = await detectDescriptor(video);
                    if (d && !cancelled) stop = !!(await handlerRef.current(d));
                } catch (e) {
                    console.error('Face detection error', e);
                }
            }
            if (!cancelled && !stop) timer = setTimeout(tick, 600);
        };

        (async () => {
            try {
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error('Este navegador no permite usar la cámara (se requiere HTTPS).');
                }
                await loadFaceModels();
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                    audio: false,
                });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
                setPhase('ready');
                tick();
            } catch (e) {
                console.error(e);
                setError(e instanceof Error && e.name === 'NotAllowedError'
                    ? 'Permiso de cámara denegado. Habilítalo en los ajustes del navegador.'
                    : (e instanceof Error ? e.message : 'No se pudo iniciar la cámara.'));
                setPhase('error');
            }
        })();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            stream?.getTracks().forEach(t => t.stop());
        };
    }, []);

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
            <div style={{
                backgroundColor: 'var(--color-card)', borderRadius: 'var(--radius-lg)',
                padding: 'var(--spacing-lg)', width: '100%', maxWidth: '480px', position: 'relative'
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                    aria-label="Cerrar"
                >
                    <X size={20} />
                </button>
                <h3 style={{ marginTop: 0 }}>{title}</h3>
                {hint && <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{hint}</p>}

                <div style={{ position: 'relative', backgroundColor: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden', aspectRatio: '4 / 3' }}>
                    <video
                        ref={videoRef}
                        muted
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                    />
                    {phase === 'loading' && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                            Cargando cámara y modelos...
                        </div>
                    )}
                </div>

                {phase === 'error' && (
                    <div style={{ marginTop: '12px', color: 'var(--color-danger)' }}>{error}</div>
                )}
                {phase === 'ready' && (
                    <div style={{ marginTop: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                        {status || 'Buscando rostro...'}
                    </div>
                )}
            </div>
        </div>
    );
}
