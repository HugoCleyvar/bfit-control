/**
 * Liveness challenge: asks the person to move their head (horizontally or vertically) and
 * verifies it from facial landmark measurements. Pure logic (no DOM / no face-api) so it
 * can be tested.
 *
 * Metrics per frame (both ~0.5 / neutral when facing the camera):
 *  - yaw:   nose position between the jaw ends. Changes when the head turns left/right.
 *  - pitch: nose position between the eye line and the chin. Changes when the head tilts up/down.
 * A real 3D head changes these; a flat photo/screen barely changes them.
 *
 * This stops a still photo. It does NOT reliably stop a pre-recorded video of the member
 * performing the same movement; supervision by staff is still required.
 */

export type ChallengeType = 'horizontal' | 'vertical';
export type ChallengeResult = 'pending' | 'passed' | 'failed';

export interface FrameMetrics {
    yaw: number;
    pitch: number;
}

export const CHALLENGE_TIMEOUT_MS = 12000;
const CALIBRATION_FRAMES = 5;
const YAW_FRONTAL_TOLERANCE = 0.1;
const PITCH_SANE_RANGE: [number, number] = [0.2, 0.8];
const LOST_RESET_MS = 1500;
// Movement needed to count as "moved", and how close to neutral to count as "came back"
const MOVE = { horizontal: 0.08, vertical: 0.06 } as const;
const BACK = { horizontal: 0.05, vertical: 0.035 } as const;

const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
};

export function randomChallengeType(rand: () => number = Math.random): ChallengeType {
    return rand() < 0.5 ? 'horizontal' : 'vertical';
}

export function instructionFor(type: ChallengeType): string {
    return type === 'horizontal'
        ? 'Gira la cabeza hacia un lado y regresa al frente'
        : 'Sube o baja la cabeza y regresa al frente';
}

export class LivenessChallenge {
    readonly type: ChallengeType;
    private calib: FrameMetrics[] = [];
    private baseYaw = 0.5;
    private basePitch = 0.5;
    private startedAt: number | null = null;
    private lostSince: number | null = null;
    private moved = false;

    constructor(type: ChallengeType) {
        this.type = type;
    }

    get calibrated(): boolean {
        return this.startedAt !== null;
    }

    private resetState() {
        this.calib = [];
        this.startedAt = null;
        this.moved = false;
    }

    /** t = timestamp in ms. m = null when no face was detected in the frame. */
    feed(m: FrameMetrics | null, t: number): ChallengeResult {
        if (!m) {
            if (this.lostSince === null) this.lostSince = t;
            if (t - this.lostSince > LOST_RESET_MS) this.resetState();
            return this.checkTimeout(t);
        }
        this.lostSince = null;

        // Calibration: need several frontal frames to learn the person's neutral position
        if (this.startedAt === null) {
            const frontal = Math.abs(m.yaw - 0.5) <= YAW_FRONTAL_TOLERANCE
                && m.pitch >= PITCH_SANE_RANGE[0] && m.pitch <= PITCH_SANE_RANGE[1];
            if (frontal) this.calib.push(m); else this.calib = [];
            if (this.calib.length >= CALIBRATION_FRAMES) {
                this.baseYaw = median(this.calib.map(c => c.yaw));
                this.basePitch = median(this.calib.map(c => c.pitch));
                this.startedAt = t;
            }
            return 'pending';
        }

        const delta = this.type === 'horizontal'
            ? Math.abs(m.yaw - this.baseYaw)
            : Math.abs(m.pitch - this.basePitch);

        if (!this.moved && delta > MOVE[this.type]) {
            this.moved = true;
        } else if (this.moved && delta < BACK[this.type]) {
            // Came back to neutral on BOTH axes so the final capture is frontal
            if (Math.abs(m.yaw - this.baseYaw) < BACK.horizontal && Math.abs(m.pitch - this.basePitch) < BACK.vertical * 1.5) {
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
