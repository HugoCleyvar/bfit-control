import * as faceapi from '@vladmandic/face-api';
import { supabase } from './supabase';

const MODEL_URL = '/models';

// face-api.js's usual "same person" cutoff is ~0.6. This gates gym access, so we use a
// stricter value to favor false rejects (falls back to manual search) over false accepts.
export const MATCH_THRESHOLD = 0.5;

let modelsLoadedPromise: Promise<void> | null = null;

// Idempotent - safe to call from every component that needs the models; the actual
// network fetch only happens once per page load.
export function ensureModelsLoaded(): Promise<void> {
    if (!modelsLoadedPromise) {
        modelsLoadedPromise = Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]).then(() => undefined);
    }
    return modelsLoadedPromise;
}

// Requires ensureModelsLoaded() to have resolved already. Returns null if no face was
// found in the current frame (normal while a person is still walking into view).
export async function getFaceDescriptorFromVideo(video: HTMLVideoElement): Promise<Float32Array | null> {
    const result = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

    return result?.descriptor ?? null;
}

export interface EnrolledFace {
    id: string;
    nombre: string;
    apellido: string;
    descriptor: number[];
}

// Lean, dedicated query for the check-in scanner - only the fields it needs to match and
// greet, not the full member/subscription shape getMembers() pulls for the roster view.
export async function getEnrolledFaceDescriptors(): Promise<EnrolledFace[]> {
    const { data, error } = await supabase
        .from('members')
        .select('id, nombre, apellido, descriptor_facial')
        .not('descriptor_facial', 'is', null);

    if (error) {
        console.error('Error fetching face descriptors:', error);
        return [];
    }

    return (data || [])
        .filter((m): m is { id: string; nombre: string; apellido: string; descriptor_facial: number[] } =>
            Array.isArray(m.descriptor_facial) && m.descriptor_facial.length > 0)
        .map(m => ({ id: m.id, nombre: m.nombre, apellido: m.apellido, descriptor: m.descriptor_facial }));
}

export interface FaceMatch {
    id: string;
    nombre: string;
    apellido: string;
    distance: number;
}

// Closest enrolled face under the threshold, or null if nobody matches closely enough.
export function findBestMatch(descriptor: Float32Array, candidates: EnrolledFace[], threshold = MATCH_THRESHOLD): FaceMatch | null {
    let best: FaceMatch | null = null;

    for (const candidate of candidates) {
        const distance = faceapi.euclideanDistance(descriptor, candidate.descriptor);
        if (distance <= threshold && (!best || distance < best.distance)) {
            best = { id: candidate.id, nombre: candidate.nombre, apellido: candidate.apellido, distance };
        }
    }

    return best;
}
