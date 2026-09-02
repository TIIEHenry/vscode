/**
 * ADR-261 Device Grant transcript and SAS primitives (Main-only).
 * Identity and fingerprint fields enter as UTF-8 bytes in the upstream-defined
 * order; there are no separators and no normalization at this boundary.
 */
import { createHash, createPrivateKey, sign as signBytes } from 'node:crypto'

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CROCKFORD_EXCLUDED = new Set(['I', 'L', 'O', 'U'])
const SAS_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

/** ADR-261 auth protocol version — independent from Connect protocolMajor (E11). */
export const DEVICE_GRANT_AUTH_PROTOCOL_VERSION = '1' as const

export type DeviceAuthTranscriptInput = {
	readonly engineIdentityId: string
	readonly engineCertFingerprint: string
	readonly authNonce: Uint8Array
	readonly clientIdentityId: string
	readonly protocolVersion: string
}

export function buildDeviceAuthTranscript(input: DeviceAuthTranscriptInput): Uint8Array {
	const encoder = new TextEncoder()
	return concat(
		encoder.encode(input.engineIdentityId),
		encoder.encode(input.engineCertFingerprint),
		input.authNonce,
		encoder.encode(input.clientIdentityId),
		encoder.encode(input.protocolVersion),
	)
}

export type PairingSasInput = {
	readonly engineIdentityId: string
	readonly engineCertFingerprint: string
	readonly clientPublicKey: Uint8Array
	readonly pairingNonce: Uint8Array
	readonly protocolVersion: string
}

export function derivePairingSasCode(input: PairingSasInput): string {
	const encoder = new TextEncoder()
	const digest = createHash('sha256')
		.update(
			concat(
				encoder.encode(input.engineIdentityId),
				encoder.encode(input.engineCertFingerprint),
				input.clientPublicKey,
				input.pairingNonce,
				encoder.encode(input.protocolVersion),
			),
		)
		.digest()
	let value = BigInt(0)
	for (const byte of digest.subarray(0, 5)) {
		value = (value << BigInt(8)) | BigInt(byte)
	}
	let encoded = ''
	for (let position = 0; position < 8; position += 1) {
		encoded = CROCKFORD_ALPHABET[Number(value & BigInt(31))] + encoded
		value >>= BigInt(5)
	}
	return `${encoded.slice(0, 4)}-${encoded.slice(4)}`
}

export function isPairingSasCode(value: unknown): value is string {
	if (typeof value !== 'string' || !SAS_CODE_PATTERN.test(value)) return false
	return !Array.from(value).some((character) => CROCKFORD_EXCLUDED.has(character))
}

export function verifyPairingSas(input: PairingSasInput, presentedSasCode: string): boolean {
	return isPairingSasCode(presentedSasCode) && presentedSasCode === derivePairingSasCode(input)
}

export type Ed25519PrivateKeyMaterial = string | Uint8Array

export function createEd25519DeviceAuthSigner(
	privateKeyMaterial: Ed25519PrivateKeyMaterial,
): (input: DeviceAuthTranscriptInput) => Uint8Array {
	const privateKey = createPrivateKey(
		typeof privateKeyMaterial === 'string'
			? privateKeyMaterial
			: {
					key: Buffer.from(privateKeyMaterial),
					format: 'der',
					type: 'pkcs8',
				},
	)
	if (privateKey.asymmetricKeyType !== 'ed25519') {
		throw new Error('Device Grant signer requires an Ed25519 private key')
	}
	return (input) => new Uint8Array(signBytes(null, buildDeviceAuthTranscript(input), privateKey))
}

function concat(...parts: readonly Uint8Array[]): Uint8Array {
	const total = parts.reduce((sum, part) => sum + part.byteLength, 0)
	const output = new Uint8Array(total)
	let offset = 0
	for (const part of parts) {
		output.set(part, offset)
		offset += part.byteLength
	}
	return output
}
