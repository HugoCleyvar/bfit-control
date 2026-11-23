/**
 * Liveness challenge: asks the person to blink twice or turn their head, and verifies it
 * from facial landmark measurements. Pure logic (no DOM / no face-api) so it can be tested.
 *
 * Metrics per frame:
 *  - ear: eye aspect ratio (drops sharply when the eye closes)
 *  - yaw: nose position between the jaw ends (0..1, ~0.5 when facing the camera).
 *         It changes when a real 3D head turns; a flat photo/screen barely changes it.
 *
 * This stops a still photo. It does NOT reliably stop a pre-recorded video of the member
 * performing the same movement; supervision by staff is still required.
 */

export type ChallengeType = 'blink' | 'turn';
export type ChallengeResult = 'pending' | 'passed' | 'failed';

export interface FrameMetrics {
    ear: number;
    yaw: number;
}

export const CHALLENGE_TIMEOUT_MS = 10000;
const CALIBRATION_FRAMES = 5;
const FRONTAL_TOLERANCE = 0.1;
const LOST_RESET_MS = 1500;
const BLINKS_REQUIRED = 2;
const TURN_DELTA = 0.1;
const TURN_RETURN = 0.06;

const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
};

export function randomChallengeType(rand: () => number = Math.random): ChallengeType {
    return rand() < 0.5 ? 'blink' : 'turn';
}

export function instructionFor(type: ChallengeType): string {
    return type === 'blink'
        ? 'Parpadea dos veces'
        : 'Gira la cabeza hacia un lado y regresa al frente';
}

export class LivenessChallenge {
    readonly type: ChallengeType;
    private calib: FrameMetrics[] = [];
    private baseEar = 0;
    private baseYaw = 0.5;
    private startedAt: number | null = null;
    private lostSince: number | null = null;
    private closed = false;
    private blinks = 0;
    private turned = false;

    constructor(type: ChallengeType) {
        this.type = type;
    }

    get calibrated(): boolean {
        return this.startedAt !== null;
    }

    private resetState() {
        this.calib = [];
        this.startedAt = null;
        this.closed = false;
        this.blinks = 0;
        this.turned = false;
    }

    /** t = timestamp in ms. m = null when no face was detected in the frame. */
    feed(m: FrameMetrics | null, t: number): ChallengeResult {
        if (!m) {
            if (this.lostSince === null) this.lostSince = t;
            if (t - this.lostSince > LOST_RESET_MS) this.resetState();
            return this.checkTimeout(t);
        }
        this.lostSince = null;

        // Calibration: need several frontal frames to learn the person's neutral values
        if (this.startedAt === null) {
            if (Math.abs(m.yaw - 0.5) <= FRONTAL_TOLERANCE && m.ear > 0.15) {
                this.calib.push(m);
            } else {
                this.calib = [];
            }
            if (this.calib.length >= CALIBRATION_FRAMES) {
                this.baseEar = median(this.calib.map(c => c.ear));
                this.baseYaw = median(this.calib.map(c => c.yaw));
                this.startedAt = t;
            }
            return 'pending';
        }

        if (this.type === 'blink') {
            if (!this.closed && m.ear < this.baseEar * 0.7) {
                this.closed = true;
            } else if (this.closed && m.ear > this.baseEar * 0.85) {
                this.closed = false;
                this.blinks++;
            }
            if (this.blinks >= BLINKS_REQUIRED) return 'passed';
        } else {
            const delta = Math.abs(m.yaw - this.baseYaw);
            if (!this.turned && delta > TURN_DELTA) {
                this.turned = true;
            } else if (this.turned && delta < TURN_RETURN) {
                return 'passed';
            }
        }
        return this.checkTimeout(t);
    }

    private checkTimeout(t: number): ChallengeResult {
        if (this.startedAt !== null && t - this.startedAt > CHALLENGE_TIMEOUT_MS) return 'failed';
        return 'pending';
    }
}
