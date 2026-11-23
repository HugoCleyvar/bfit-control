import { useEffect, useRef, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { loadFaceModels, detectDescriptor } from '../../logic/faceService';

/** getUserMedia can hang forever on some drivers/browsers; give each try a deadline. */
function getStreamWithTimeout(constraints: MediaStreamConstraints, ms: number): Promise<MediaStream> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            const err = new Error('timeout');
            err.name = 'CameraTimeout';
            reject(err);
        }, ms);
        navigator.mediaDevices.getUserMedia(constraints).then(
            (stream) => {
                if (settled) { stream.getTracks().forEach(t => t.stop()); return; } // arrived too late
                settled = true; clearTimeout(timer); resolve(stream);
            },
            (err) => {
                if (settled) return;
                settled = true; clearTimeout(timer); reject(err);
            }
        );
    });
}

/** Tries progressively looser constraints so laptops, phones and tablets all work. */
async function openCamera(deviceId?: string): Promise<MediaStream> {
    const tries: MediaStreamConstraints[] = [];
    if (deviceId) tries.push({ video: { deviceId: { exact: deviceId } }, audio: false });
    tries.push({ video: { facingMode: 'user' }, audio: false });
    tries.push({ video: true, audio: false });
    let lastErr: unknown;
    for (const c of tries) {
        try {
            return await getStreamWithTimeout(c, 7000);
        } catch (e) {
            lastErr = e;
            const name = e instanceof Error ? e.name : '';
            // Permission problems won't be fixed by looser constraints
            if (name === 'NotAllowedError' || name === 'SecurityError') break;
        }
    }
    throw lastErr;
}

function describeError(e: unknown): string {
    if (!window.isSecureContext) {
        return 'La cámara solo funciona en una conexión segura (HTTPS). Abre la app con la dirección https://.';
    }
    const name = e instanceof Error ? e.name : '';
    switch (name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return 'Permiso de cámara denegado. Toca el candado/ícono de cámara junto a la dirección del sitio, permite la cámara y pulsa Reintentar.';
        case 'NotFoundError':
        case 'OverconstrainedError':
            return 'No se encontró ninguna cámara en este dispositivo.';
        case 'CameraTimeout':
            return 'La cámara no responde aunque el permiso está concedido. Cierra otras apps o pestañas que la usen (Zoom, Meet, Teams, otra pestaña de esta app), desconecta y vuelve a conectar la cámara si es externa, y pulsa Reintentar. Si persiste, reinicia el navegador o prueba con otro (Chrome, Edge, Firefox).';
        case 'NotReadableError':
        case 'AbortError':
            return 'La cámara está en uso por otra app o pestaña. Ciérrala y pulsa Reintentar.';
        default:
            return e instanceof Error && e.message ? e.message : 'No se pudo iniciar la cámara.';
    }
}

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
    const [stage, setStage] = useState<'camera' | 'models'>('camera');
    const [slow, setSlow] = useState(false);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
    const [attempt, setAttempt] = useState(0); // bump to retry
    const handlerRef = useRef(onDescriptor);
    handlerRef.current = onDescriptor;

    useEffect(() => {
        let cancelled = false;
        let stream: MediaStream | null = null;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let busy = false;
        let slowTimer: ReturnType<typeof setTimeout> | undefined;

        const tick = async () => {
            if (cancelled) return;
            const video = videoRef.current;
            let stop = false;
            if (video && video.readyState >= 2 && !busy) {
                busy = true;
                try {
                    const d = await detectDescriptor(video);
                    if (d && !cancelled) stop = !!(await handlerRef.current(d));
                } catch (e) {
                    console.error('Face detection error', e);
                } finally {
                    busy = false;
                }
            }
            if (!cancelled && !stop) timer = setTimeout(tick, 600);
        };

        (async () => {
            setPhase('loading');
            setStage('camera');
            setSlow(false);
            setError('');
            slowTimer = setTimeout(() => setSlow(true), 6000);
            try {
                if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
                    throw new Error('insecure');
                }
                // Fail fast if the browser already blocked the camera for this site
                try {
                    const perm = await navigator.permissions?.query({ name: 'camera' as PermissionName });
                    if (perm?.state === 'denied') {
                        const err = new Error('denied');
                        err.name = 'NotAllowedError';
                        throw err;
                    }
                } catch (pe) {
                    if (pe instanceof Error && pe.name === 'NotAllowedError') throw pe;
                    /* Permissions API unsupported (e.g. Safari): continue */
                }
                stream = await openCamera(deviceId);
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    try { await videoRef.current.play(); } catch { /* autoplay quirks: user gesture already happened */ }
                }
                // Labels/devices are only available after permission is granted
                try {
                    const all = await navigator.mediaDevices.enumerateDevices();
                    if (!cancelled) setDevices(all.filter(d => d.kind === 'videoinput'));
                } catch { /* ignore */ }
            } catch (e) {
                console.error('Camera error', e);
                if (!cancelled) { setError(describeError(e)); setPhase('error'); }
                return;
            }
            setStage('models');
            try {
                await loadFaceModels();
            } catch (e) {
                console.error('Model load error', e);
                if (!cancelled) { setError('No se pudieron cargar los modelos de reconocimiento. Revisa tu conexión y pulsa Reintentar.'); setPhase('error'); }
                return;
            }
            if (cancelled) return;
            if (slowTimer) clearTimeout(slowTimer);
            setPhase('ready');
            tick();
        })();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            if (slowTimer) clearTimeout(slowTimer);
            stream?.getTracks().forEach(t => t.stop());
        };
    }, [deviceId, attempt]);

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
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: '16px', textAlign: 'center', gap: '8px' }}>
                            <div>{stage === 'camera' ? 'Solicitando acceso a la cámara...' : 'Cargando modelos de reconocimiento...'}</div>
                            {slow && stage === 'camera' && (
                                <div style={{ fontSize: '13px', opacity: 0.85 }}>
                                    Tu navegador debe mostrar un aviso para permitir la cámara (arriba a la izquierda, junto a la dirección). Pulsa "Permitir". Si no aparece, toca el candado de la barra de direcciones → Cámara → Permitir, y pulsa Reintentar.
                                </div>
                            )}
                            {slow && stage === 'models' && (
                                <div style={{ fontSize: '13px', opacity: 0.85 }}>Descargando unos 7 MB la primera vez; puede tardar con conexión lenta.</div>
                            )}
                        </div>
                    )}
                </div>

                {phase === 'error' && (
                    <div style={{ marginTop: '12px' }}>
                        <div style={{ color: 'var(--color-danger)', marginBottom: '8px' }}>{error}</div>
                        <button onClick={() => setAttempt(a => a + 1)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <RefreshCw size={16} /> Reintentar
                        </button>
                    </div>
                )}
                {devices.length > 1 && (
                    <select
                        value={deviceId ?? ''}
                        onChange={(e) => setDeviceId(e.target.value || undefined)}
                        style={{ marginTop: '10px', width: '100%', padding: '8px' }}
                    >
                        <option value="">Cámara automática</option>
                        {devices.map((d, i) => (
                            <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Cámara ${i + 1}`}</option>
                        ))}
                    </select>
                )}
                {phase === 'loading' && slow && (
                    <button onClick={() => setAttempt(a => a + 1)} style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <RefreshCw size={16} /> Reintentar
                    </button>
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
