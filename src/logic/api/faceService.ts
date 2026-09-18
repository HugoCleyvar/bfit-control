import * as faceapi from '@vladmandic/face-api';
import { supabase } from './supabase';

const MODEL_URL = '/models';

// face-api.js's usual "same person" cutoff is ~0.6. This gates gym access, so we use a
// stricter value to favor false rejects (falls back to manual search) over false accepts.
// Tightened after real-world testing showed 0.5 could match two different people - tune
// this further using the distance shown live in FaceCheckIn once more test data comes in.
export const MATCH_THRESHOLD = 0.4;

let modelsLoadedPromise: Promise<void> | null = null;

// Idempotent - safe to call from every component that needs the models; the actual
// network fetch only happens once per page load.
export function ensureModelsLoaded(): Promise<void> {
    if (!modelsLoadedPromise) {
        modelsLoadedPromise = Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
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

// Lightweight - just the face box, no landmarks/descriptor. Cheap enough to poll on every
// tick of a live positioning guide, unlike getFaceDescriptorFromVideo's full pipeline.
export async function detectFaceBox(video: HTMLVideoElement) {
    return faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions());
}

// Landmarks without the recognition descriptor, using the tiny landmark net - cheaper than
// getFaceDescriptorFromVideo's full pipeline. Used to track eye state during liveness
// verification (see eyeAspectRatio below) once we already know who we're checking, where
// polling many frames quickly matters more than landmark precision.
export async function detectFaceLandmarks(video: HTMLVideoElement) {
    return faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(true);
}

// Eye Aspect Ratio (Soukupova & Cech, 2016): stays roughly constant (~0.25-0.35) while an
// eye is open and drops sharply on a blink. Used as a liveness check - a static photo held
// up to the camera can't blink, so requiring one before check-in defeats that specific
// spoof (though not a played-back video of the person).
export function eyeAspectRatio(eye: { x: number; y: number }[]): number {
    if (eye.length < 6) return 1; // malformed input - treat as "open" rather than throw
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const vertical = dist(eye[1], eye[5]) + dist(eye[2], eye[4]);
    const horizontal = dist(eye[0], eye[3]);
    return horizontal === 0 ? 1 : vertical / (2 * horizontal);
}

// Below this, an eye is considered closed. Started at the literature default (0.21), but a
// real blink test only reached 0.219 - just short of it - so raised to give real blinks
// margin to cross. Keep tuning from the live "EAR mín." shown in FaceCheckIn if it still
// times out on genuine blinks, or triggers without one.
export const EAR_CLOSED_THRESHOLD = 0.25;

export interface FacePositionResult {
    status: 'none' | 'too-small' | 'too-large' | 'off-center' | 'good';
    hint: string;
}

// A face that's too small/large/off-center in the frame tends to produce a worse-quality
// descriptor (see MATCH_THRESHOLD comment - a bad enrollment capture is what caused the
// first real false-match report). These ratios are estimates, not measured - tune them if
// the guide keeps rejecting reasonable framing or accepting bad framing.
const MIN_FACE_WIDTH_RATIO = 0.32;
const MAX_FACE_WIDTH_RATIO = 0.68;
const MAX_CENTER_OFFSET_RATIO = 0.18;

export function evaluateFacePosition(
    detection: { box: { x: number; y: number; width: number; height: number } } | undefined,
    videoWidth: number,
    videoHeight: number
): FacePositionResult {
    if (!detection || !videoWidth || !videoHeight) {
        return { status: 'none', hint: 'Coloca tu rostro dentro del círculo' };
    }

    const { box } = detection;
    const widthRatio = box.width / videoWidth;
    const centerOffsetX = Math.abs((box.x + box.width / 2) / videoWidth - 0.5);
    const centerOffsetY = Math.abs((box.y + box.height / 2) / videoHeight - 0.5);

    if (widthRatio < MIN_FACE_WIDTH_RATIO) {
        return { status: 'too-small', hint: 'Acércate un poco más' };
    }
    if (widthRatio > MAX_FACE_WIDTH_RATIO) {
        return { status: 'too-large', hint: 'Aléjate un poco' };
    }
    if (centerOffsetX > MAX_CENTER_OFFSET_RATIO || centerOffsetY > MAX_CENTER_OFFSET_RATIO) {
        return { status: 'off-center', hint: 'Céntrate en el círculo' };
    }
    return { status: 'good', hint: '¡Buena posición! Puedes capturar' };
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
    const closest = closestMatch(descriptor, candidates);
    return closest && closest.distance <= threshold ? closest : null;
}

// Closest enrolled face regardless of threshold - lets the UI show real distance numbers
// (including near-misses) so MATCH_THRESHOLD can be calibrated from real data instead of
// guessed blind.
export function closestMatch(descriptor: Float32Array, candidates: EnrolledFace[]): FaceMatch | null {
    let best: FaceMatch | null = null;

    for (const candidate of candidates) {
        const distance = faceapi.euclideanDistance(descriptor, candidate.descriptor);
        if (!best || distance < best.distance) {
            best = { id: candidate.id, nombre: candidate.nombre, apellido: candidate.apellido, distance };
        }
    }

    return best;
}
