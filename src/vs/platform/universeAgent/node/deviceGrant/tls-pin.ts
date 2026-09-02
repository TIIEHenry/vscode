/**
 * Pure ADR-261 certificate-pin checks. The gRPC Channel adapter remains the
 * sole @grpc/grpc-js import site and passes peer certificate bytes structurally.
 */
import { createHash } from 'node:crypto'

export const ENGINE_CERT_FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/

export type PinnedTlsPlanInput = {
	readonly trustAnchorLeafDer: Uint8Array
	readonly expectedLeafSha256Hex: string
	readonly hostnameVerification: 'replaced-by-pin'
}

export type ObservedPeerCertificate = {
	readonly raw: Uint8Array
}

export function deriveEngineLeafFingerprintHex(leafDer: Uint8Array): string {
	return createHash('sha256').update(leafDer).digest('hex')
}

export function verifyPinnedTlsPlan(
	plan: PinnedTlsPlanInput,
): { ok: true; observedFingerprintHex: string } | { ok: false; reason: string } {
	if (
		plan.trustAnchorLeafDer.byteLength === 0 ||
		!ENGINE_CERT_FINGERPRINT_PATTERN.test(plan.expectedLeafSha256Hex) ||
		plan.hostnameVerification !== 'replaced-by-pin'
	) {
		return { ok: false, reason: 'invalid Engine TLS pin plan' }
	}
	const observedFingerprintHex = deriveEngineLeafFingerprintHex(plan.trustAnchorLeafDer)
	if (observedFingerprintHex !== plan.expectedLeafSha256Hex) {
		return { ok: false, reason: 'Engine TLS pin digest mismatch' }
	}
	return { ok: true, observedFingerprintHex }
}

export function createPinnedServerIdentityCheck(
	expectedLeafSha256Hex: string,
): (certificate: ObservedPeerCertificate) => Error | undefined {
	return (certificate) => {
		const observed = certificate?.raw ? deriveEngineLeafFingerprintHex(certificate.raw) : ''
		if (observed !== expectedLeafSha256Hex) {
			return new Error('Engine TLS leaf fingerprint does not match pinned trust anchor')
		}
		return undefined
	}
}
