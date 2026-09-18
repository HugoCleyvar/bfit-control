import { useEffect, useRef, useState, useCallback } from 'react';
import {
    ensureModelsLoaded,
    getFaceDescriptorFromVideo,
    detectFaceLandmarks,
    eyeAspectRatio,
    EAR_CLOSED_THRESHOLD,
    getEnrolledFaceDescriptors,
    findBestMatch,
    closestMatch,
    type EnrolledFace,
    type FaceMatch
} from '../../logic/api/faceService';
import { RefreshCw, ScanFace, Eye } from 'lucide-react';

interface FaceCheckInProps {
    onMatch: (memberId: string) => void;
    // Pauses scanning while a check-in triggered by a previous match is still being processed.
    paused?: boolean;
}

type Status = 'loading-models' | 'starting-camera' | 'scanning' | 'verifying' | 'error';

const SCAN_INTERVAL_MS = 1000;
// A blink only lasts ~100-300ms total - sampling too slowly can step right over the
// fully-closed frame and never see it at all. Fast enough to catch it, still cheap since
// this phase only runs the landmarks model, not the full recognition pipeline.
const VERIFY_INTERVAL_MS = 120;
// A static photo held up to the camera can't blink - if nobody blinks within this window,
// the candidate match is rejected instead of checked in.
const VERIFY_TIMEOUT_MS = 5000;
// How long the same member is ignored after a match, so a person standing in front of the
// tablet doesn't get checked in again every second while they walk away.
const MEMBER_COOLDOWN_MS = 15000;

export function FaceCheckIn({ onMatch, paused }: FaceCheckInProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const enrolledRef = useRef<EnrolledFace[]>([]);
    const lastMatchRef = useRef<{ id: string; at: number } | null>(null);
    const scanningRef = useRef(false);

    // Liveness verification state for the candidate found while 'scanning' - lives in refs
    // since the tick interval closures shouldn't depend on React re-renders to stay current.
    const pendingMatchRef = useRef<FaceMatch | null>(null);
    const verifyStartRef = useRef(0);
    const sawClosedRef = useRef(false);
    const sawOpenAfterClosedRef = useRef(false);
    const noFaceStreakRef = useRef(0);
    const verifyBusyRef = useRef(false);
    // Lowest EAR seen so far this verification attempt - shown live so we can calibrate
    // EAR_CLOSED_THRESHOLD from real numbers instead of the textbook default, same as we
    // did for MATCH_THRESHOLD.
    const minEarRef = useRef(1);

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

    // Phase 1: look for a candidate match against the enrolled roster.
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
                    // Show the closest miss (with its distance) even though it didn't pass the
                    // threshold - this number is what we need to calibrate MATCH_THRESHOLD.
                    const closest = closestMatch(descriptor, enrolledRef.current);
                    setHint(closest
                        ? `No reconocido (más cercano: ${closest.nombre}, dist. ${closest.distance.toFixed(3)}). Usa la búsqueda manual.`
                        : 'Rostro no reconocido. Usa la búsqueda manual si el problema persiste.');
                    return;
                }

                const last = lastMatchRef.current;
                if (last && last.id === match.id && Date.now() - last.at < MEMBER_COOLDOWN_MS) {
                    setHint(`Hola de nuevo, ${match.nombre} (ya registrado)`);
                    return;
                }

                // Candidate found - don't check in yet. Confirm it's a live face, not a photo,
                // before handing it to onMatch.
                pendingMatchRef.current = match;
                sawClosedRef.current = false;
                sawOpenAfterClosedRef.current = false;
                noFaceStreakRef.current = 0;
                minEarRef.current = 1;
                verifyStartRef.current = Date.now();
                setHint(`${match.nombre}, parpadea para confirmar...`);
                setStatus('verifying');
            } finally {
                scanningRef.current = false;
            }
        };

        const interval = setInterval(tick, SCAN_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [status, paused]);

    // Phase 2: liveness check - require a blink (eyes open -> closed -> open again) within
    // the time window before actually checking the candidate in. Defeats holding up a static
    // photo of an enrolled member's face; doesn't defend against a played-back video.
    useEffect(() => {
        if (status !== 'verifying') return;

        const finishVerification = (confirmed: boolean) => {
            const candidate = pendingMatchRef.current;
            const minEar = minEarRef.current.toFixed(3);
            if (confirmed && candidate) {
                lastMatchRef.current = { id: candidate.id, at: Date.now() };
                setHint(`¡Reconocido! ${candidate.nombre} ${candidate.apellido} (EAR mín. ${minEar})`);
                onMatch(candidate.id);
            } else {
                setHint(`No se detectó parpadeo (EAR mín. visto: ${minEar}). Intenta de nuevo.`);
            }
            pendingMatchRef.current = null;
            setStatus('scanning');
        };

        const tick = async () => {
            if (paused || verifyBusyRef.current || !videoRef.current) return;
            verifyBusyRef.current = true;
            try {
                if (Date.now() - verifyStartRef.current > VERIFY_TIMEOUT_MS) {
                    finishVerification(false);
                    return;
                }

                const result = await detectFaceLandmarks(videoRef.current);
                if (!result) {
                    noFaceStreakRef.current += 1;
                    // ~1s of no face - they likely stepped away, stop waiting on this candidate.
                    if (noFaceStreakRef.current >= 4) finishVerification(false);
                    return;
                }
                noFaceStreakRef.current = 0;

                const ear = (eyeAspectRatio(result.landmarks.getLeftEye()) + eyeAspectRatio(result.landmarks.getRightEye())) / 2;
                minEarRef.current = Math.min(minEarRef.current, ear);
                setHint(`${pendingMatchRef.current?.nombre}, parpadea para confirmar... (EAR mín. ${minEarRef.current.toFixed(3)})`);

                if (ear < EAR_CLOSED_THRESHOLD) {
                    sawClosedRef.current = true;
                } else if (sawClosedRef.current) {
                    sawOpenAfterClosedRef.current = true;
                }

                if (sawClosedRef.current && sawOpenAfterClosedRef.current) {
                    finishVerification(true);
                }
            } finally {
                verifyBusyRef.current = false;
            }
        };

        const interval = setInterval(tick, VERIFY_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [status, paused, onMatch]);

    const isLive = status === 'scanning' || status === 'verifying';
    const borderColor = paused
        ? 'var(--color-warning)'
        : status === 'verifying' ? 'var(--color-accent)' : 'var(--color-success)';

    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
                <video
                    ref={videoRef}
                    muted
                    playsInline
                    style={{
                        width: '100%', maxWidth: '360px', borderRadius: '12px',
                        display: isLive ? 'block' : 'none',
                        transform: 'scaleX(-1)',
                        border: `3px solid ${borderColor}`,
                        transition: 'border-color 0.2s'
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

            {isLive && (
                <>
                    <p style={{ color: status === 'verifying' ? 'var(--color-accent)' : 'var(--color-text-secondary)', fontSize: '13px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: status === 'verifying' ? 600 : 400 }}>
                        {status === 'verifying' ? <Eye size={14} /> : <ScanFace size={14} />}
                        {paused ? 'Procesando...' : hint || 'Escaneando...'}
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
