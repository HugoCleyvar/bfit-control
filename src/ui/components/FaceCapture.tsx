import { useEffect, useRef, useState } from 'react';
import {
    ensureModelsLoaded,
    getFaceDescriptorFromVideo,
    detectFaceBox,
    evaluateFacePosition,
    type FacePositionResult
} from '../../logic/api/faceService';
import { Camera, CheckCircle, RefreshCw, ScanFace } from 'lucide-react';

interface FaceCaptureProps {
    hasExistingFace?: boolean;
    onCapture: (descriptor: number[]) => void;
}

type Status = 'idle' | 'loading-models' | 'starting-camera' | 'ready' | 'detecting' | 'captured' | 'error';

const GUIDE_COLORS: Record<FacePositionResult['status'], string> = {
    none: 'var(--color-border)',
    'too-small': 'var(--color-warning)',
    'too-large': 'var(--color-warning)',
    'off-center': 'var(--color-warning)',
    good: 'var(--color-success)'
};

export function FaceCapture({ hasExistingFace, onCapture }: FaceCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const guideBusyRef = useRef(false);

    const [consent, setConsent] = useState(false);
    const [status, setStatus] = useState<Status>(hasExistingFace ? 'captured' : 'idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [guide, setGuide] = useState<FacePositionResult>({ status: 'none', hint: 'Coloca tu rostro dentro del círculo' });

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    };

    useEffect(() => stopCamera, []);

    // Live positioning guide: a bad enrollment capture (off-center, too close/far) is what
    // produced the first inaccurate match in real testing, so this gives visual feedback
    // before the person commits to "Capturar Rostro" instead of finding out after the fact.
    useEffect(() => {
        if (status !== 'ready') return;

        const tick = async () => {
            if (guideBusyRef.current || !videoRef.current) return;
            guideBusyRef.current = true;
            try {
                const detection = await detectFaceBox(videoRef.current);
                setGuide(evaluateFacePosition(detection, videoRef.current.videoWidth, videoRef.current.videoHeight));
            } finally {
                guideBusyRef.current = false;
            }
        };

        const interval = setInterval(tick, 400);
        return () => clearInterval(interval);
    }, [status]);

    const startCamera = async () => {
        setErrorMsg('');
        setStatus('loading-models');
        try {
            await ensureModelsLoaded();

            setStatus('starting-camera');
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setStatus('ready');
        } catch (err) {
            console.error('Error starting camera for face capture:', err);
            setErrorMsg('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
            setStatus('error');
        }
    };

    const handleCapture = async () => {
        if (!videoRef.current) return;
        setStatus('detecting');
        setErrorMsg('');

        const descriptor = await getFaceDescriptorFromVideo(videoRef.current);
        if (!descriptor) {
            setErrorMsg('No se detectó ningún rostro. Acércate más y asegúrate de tener buena iluminación.');
            setStatus('ready');
            return;
        }

        stopCamera();
        setStatus('captured');
        onCapture(Array.from(descriptor));
    };

    const handleRetry = () => {
        setStatus('idle');
        setErrorMsg('');
        setGuide({ status: 'none', hint: 'Coloca tu rostro dentro del círculo' });
    };

    return (
        <div style={{ padding: '12px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: 'var(--font-size-sm)' }}>
                <ScanFace size={16} /> Reconocimiento Facial (Opcional)
            </label>

            {status === 'captured' ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-success)', fontSize: '14px' }}>
                        <CheckCircle size={16} /> Rostro registrado
                    </span>
                    <button type="button" onClick={handleRetry} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                        <RefreshCw size={14} /> Volver a capturar
                    </button>
                </div>
            ) : (
                <>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '10px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: '3px' }} />
                        Autorizo el uso de reconocimiento facial para el acceso de este socio. Solo se guarda una representación matemática del rostro, no la fotografía.
                    </label>

                    {status === 'idle' && (
                        <button
                            type="button"
                            disabled={!consent}
                            onClick={startCamera}
                            style={{
                                width: '100%', padding: '10px', borderRadius: '6px', border: 'none',
                                background: consent ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
                                color: consent ? 'white' : 'var(--color-text-secondary)',
                                cursor: consent ? 'pointer' : 'not-allowed',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                            }}
                        >
                            <Camera size={16} /> Activar Cámara
                        </button>
                    )}

                    {(status === 'loading-models' || status === 'starting-camera') && (
                        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
                            {status === 'loading-models' ? 'Cargando modelo de reconocimiento (solo la primera vez)...' : 'Iniciando cámara...'}
                        </p>
                    )}

                    {/* Always mounted (just hidden via CSS) so the ref is already attached to a
                        real DOM node by the time startCamera() tries to assign srcObject to it -
                        mounting it only once status flips to 'ready' left it permanently blank. */}
                    <div style={{
                        position: 'relative', width: '100%', maxWidth: '280px', margin: '0 auto 10px',
                        display: (status === 'ready' || status === 'detecting') ? 'block' : 'none'
                    }}>
                        <video
                            ref={videoRef}
                            muted
                            playsInline
                            style={{ width: '100%', borderRadius: '8px', display: 'block', transform: 'scaleX(-1)' }}
                        />
                        <svg
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                        >
                            <ellipse
                                cx="50" cy="48" rx="30" ry="38"
                                fill="none"
                                stroke={GUIDE_COLORS[guide.status]}
                                strokeWidth="2"
                                vectorEffect="non-scaling-stroke"
                                style={{ transition: 'stroke 0.2s' }}
                            />
                        </svg>
                    </div>

                    {(status === 'ready' || status === 'detecting') && (
                        <>
                            <p style={{ textAlign: 'center', fontSize: '13px', color: GUIDE_COLORS[guide.status], margin: '0 0 10px' }}>
                                {guide.hint}
                            </p>
                            <button
                                type="button"
                                onClick={handleCapture}
                                disabled={status === 'detecting'}
                                style={{
                                    width: '100%', padding: '10px', borderRadius: '6px', border: 'none',
                                    background: 'var(--color-primary)', color: 'white', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                <ScanFace size={16} /> {status === 'detecting' ? 'Analizando...' : 'Capturar Rostro'}
                            </button>
                        </>
                    )}

                    {errorMsg && (
                        <p style={{ fontSize: '13px', color: 'var(--color-danger)', marginTop: '8px', marginBottom: 0 }}>{errorMsg}</p>
                    )}
                </>
            )}
        </div>
    );
}
