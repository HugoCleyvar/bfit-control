import * as faceapi from '@vladmandic/face-api';
import { supabase } from './api/supabase';
import type { FrameMetrics } from './liveness';

// Euclidean distance under this value is considered the same person.
// 0.5 is stricter than face-api's default (0.6) to reduce false positives at the door.
export const MATCH_THRESHOLD = 0.5;

const MODELS_URL = '/models';
let modelsPromise: Promise<void> | null = null;

// Some phones/tablets/older GPUs cannot start WebGL; fall back to CPU so the feature still works.
type TfLike = { setBackend(name: string): Promise<boolean>; ready(): Promise<void> };

async function initBackend(): Promise<void> {
    const tf = faceapi.tf as unknown as TfLike;
    try {
        await tf.setBackend('webgl');
        await tf.ready();
    } catch (e) {
        console.warn('WebGL backend unavailable, using CPU', e);
        await tf.setBackend('cpu');
        await tf.ready();
    }
}

export function loadFaceModels(): Promise<void> {
    if (!modelsPromise) {
        modelsPromise = initBackend().then(() => Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
        ])).then(() => undefined).catch((err) => {
            modelsPromise = null; // allow retry
            throw err;
        });
    }
    return modelsPromise;
}

/** Returns the 128-number descriptor of the single face in the frame, or null. */
export async function detectDescriptor(video: HTMLVideoElement): Promise<number[] | null> {
    const result = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
    return result ? Array.from(result.descriptor) : null;
}

/** Head-pose measurements (yaw/pitch) for liveness (no descriptor, so it can run every frame). */
export async function detectMetrics(video: HTMLVideoElement): Promise<FrameMetrics | null> {
    const result = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
        .withFaceLandmarks();
    if (!result) return null;
    const pts = result.landmarks.positions;
    const jawW = pts[16].x - pts[0].x;
    const eyeY = pts.slice(36, 48).reduce((sum, p) => sum + p.y, 0) / 12;
    const noseToChin = pts[8].y - eyeY;
    if (jawW <= 0 || noseToChin <= 0) return null;
    return {
        yaw: (pts[30].x - pts[0].x) / jawW,
        pitch: (pts[30].y - eyeY) / noseToChin,
    };
}

export function distance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const d = a[i] - b[i];
        sum += d * d;
    }
    return Math.sqrt(sum);
}

export interface EnrolledFace {
    id: string;
    nombre: string;
    apellido: string;
    descriptor: number[];
}

/** Members who consented and have a stored descriptor. */
export async function getEnrolledFaces(): Promise<EnrolledFace[]> {
    const { data, error } = await supabase
        .from('members')
        .select('id, nombre, apellido, descriptor_facial')
        .eq('consentimiento_facial', true)
        .not('descriptor_facial', 'is', null);

    if (error) {
        console.error('Error loading face descriptors:', error);
        return [];
    }

    return (data || [])
        .filter((m) => Array.isArray(m.descriptor_facial) && m.descriptor_facial.length === 128)
        .map((m) => ({
            id: m.id,
            nombre: m.nombre,
            apellido: m.apellido,
            descriptor: m.descriptor_facial as number[],
        }));
}

/** Best match under the threshold, only if clearly better than the runner-up. */
export function findBestMatch(descriptor: number[], enrolled: EnrolledFace[]): { face: EnrolledFace; distance: number } | null {
    let best: { face: EnrolledFace; distance: number } | null = null;
    let second = Infinity;
    for (const face of enrolled) {
        const d = distance(descriptor, face.descriptor);
        if (!best || d < best.distance) {
            if (best) second = best.distance;
            best = { face, distance: d };
        } else if (d < second) {
            second = d;
        }
    }
    if (!best || best.distance > MATCH_THRESHOLD) return null;
    // Ambiguous: two people nearly equally close
    if (second - best.distance < 0.05) return null;
    return best;
}

export async function saveFaceDescriptor(memberId: string, descriptor: number[]): Promise<boolean> {
    const { error } = await supabase
        .from('members')
        .update({
            descriptor_facial: descriptor,
            consentimiento_facial: true,
            descriptor_facial_actualizado: new Date().toISOString(),
        })
        .eq('id', memberId);
    if (error) {
        console.error('Error saving face descriptor:', error);
        return false;
    }
    return true;
}

export async function removeFaceData(memberId: string): Promise<boolean> {
    const { error } = await supabase
        .from('members')
        .update({
            descriptor_facial: null,
            consentimiento_facial: false,
            descriptor_facial_actualizado: new Date().toISOString(),
        })
        .eq('id', memberId);
    if (error) {
        console.error('Error removing face data:', error);
        return false;
    }
    return true;
}
