import type { SessionId, SessionViewSnapshot } from './types.js'

export function emptySessionViewSnapshot(sessionId: SessionId): SessionViewSnapshot {
	return {
		sessionId,
		sync: { kind: 'idle' },
		timeline: [],
		overlay: { blocks: [] },
		pendingActions: [],
		localPendingSends: [],
	}
}

/**
 * INV-ESS-SID-1: seed sessionId identity domain fail-closed via
 * emptySessionViewSnapshotWithRejects. Existing factory body unchanged.
 * File-private admit; trim is predicate-only; never written back.
 */
const EMPTY_SNAPSHOT_SESSION_ID_MAX = 256

export type EmptySnapshotSessionIdRejectReason = 'non_string' | 'non_canonical' | 'too_long'

export type EmptySnapshotSessionIdAdmission =
	| { readonly ok: true; readonly snapshot: SessionViewSnapshot }
	| { readonly ok: false; readonly reason: EmptySnapshotSessionIdRejectReason }

function admitEmptySnapshotSessionId(value: unknown):
	| { readonly ok: true; readonly sessionId: SessionId }
	| {
			readonly ok: false
			readonly reason: EmptySnapshotSessionIdRejectReason
		} {
	if (typeof value !== 'string') return { ok: false, reason: 'non_string' }
	if (value.length === 0 || value !== value.trim()) {
		return { ok: false, reason: 'non_canonical' }
	}
	if (value.length > EMPTY_SNAPSHOT_SESSION_ID_MAX) {
		return { ok: false, reason: 'too_long' }
	}
	return { ok: true, sessionId: value as SessionId }
}

export function emptySessionViewSnapshotWithRejects(
	sessionId: unknown,
): EmptySnapshotSessionIdAdmission {
	const admitted = admitEmptySnapshotSessionId(sessionId)
	if (!admitted.ok) return admitted
	return { ok: true, snapshot: emptySessionViewSnapshot(admitted.sessionId) }
}
