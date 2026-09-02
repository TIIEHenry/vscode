/**
 * S1 ObserveCandidate — sole production site allowed to use rejectUnauthorized:false.
 * Native tls.connect → peer leaf DER → immediate destroy; zero application bytes.
 */
import tls from 'node:tls'
import { deriveEngineLeafFingerprintHex } from './tls-pin.js'

export type ObserveCandidateLeafInput = {
	readonly host: string
	readonly port: number
	/** SNI when dialing by IP but routing name is required (Hub). Omit for IP-only direct. */
	readonly servername?: string
}

export type ObserveCandidateLeafDenialCode = 'observe_failed' | 'tls_pin_mismatch'

export type ObserveCandidateLeafResult =
	| {
			readonly ok: true
			readonly leafDer: Uint8Array
			readonly leafSha256Hex: string
		}
	| {
			readonly ok: false
			readonly code: ObserveCandidateLeafDenialCode
			readonly reason: string
		}

/**
 * Observe the Engine leaf certificate without sending application data.
 * Fail-closed on empty cert or handshake error.
 */
export function observeCandidateLeaf(
	input: ObserveCandidateLeafInput,
): Promise<ObserveCandidateLeafResult> {
	return new Promise((resolve) => {
		const options: tls.ConnectionOptions = {
			host: input.host,
			port: input.port,
			rejectUnauthorized: false,
			ALPNProtocols: ['h2'],
		}
		if (typeof input.servername === 'string' && input.servername.trim().length > 0) {
			options.servername = input.servername.trim()
		}

		const socket = tls.connect(options, () => {
			try {
				const peer = socket.getPeerCertificate(false)
				const raw = peer?.raw
				if (!raw || raw.length === 0) {
					socket.destroy()
					resolve({
						ok: false,
						code: 'observe_failed',
						reason: 'observe_failed: peer certificate missing after TLS handshake',
					})
					return
				}
				const leafDer = Uint8Array.from(raw)
				const leafSha256Hex = deriveEngineLeafFingerprintHex(leafDer)
				socket.destroy()
				resolve({ ok: true, leafDer, leafSha256Hex })
			} catch (err) {
				socket.destroy()
				resolve({
					ok: false,
					code: 'observe_failed',
					reason: `observe_failed: ${err instanceof Error ? err.message : String(err)}`,
				})
			}
		})

		socket.on('error', (err) => {
			resolve({
				ok: false,
				code: 'observe_failed',
				reason: `observe_failed: ${err.message}`,
			})
		})
	})
}
