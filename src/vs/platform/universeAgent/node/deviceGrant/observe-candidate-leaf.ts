/**
 * S1 ObserveCandidate — sole production site allowed to use rejectUnauthorized:false.
 * Native tls.connect → peer leaf DER → immediate destroy; zero application bytes.
 */
import net from 'node:net'
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

export const OBSERVE_CANDIDATE_LEAF_TIMEOUT_MS = 8_000

/** Placeholder SNI when dialing an IP. Pin check ignores hostname; Node forbids IP SNI. */
export const DIRECT_ADDRESS_SNI_PLACEHOLDER = 'universe-agent.direct'

/**
 * RFC 6066 SNI is a hostname. Node ≥20 throws `ERR_INVALID_ARG_VALUE` if
 * `options.servername` is an IP — Direct Address `127.0.0.1` must omit it.
 */
export function tlsServernameForObserve(servername: string | undefined): string | undefined {
	const trimmed = servername?.trim()
	if (!trimmed) {
		return undefined
	}
	if (net.isIP(trimmed)) {
		return undefined
	}
	return trimmed
}

/** gRPC still needs a non-IP override, otherwise @grpc/grpc-js copies the IP from the target. */
export function grpcSslTargetNameOverride(servername: string | undefined): string {
	return tlsServernameForObserve(servername) ?? DIRECT_ADDRESS_SNI_PLACEHOLDER
}

export function buildObserveTlsOptions(input: ObserveCandidateLeafInput): tls.ConnectionOptions {
	const options: tls.ConnectionOptions = {
		host: input.host,
		port: input.port,
		rejectUnauthorized: false,
		ALPNProtocols: ['h2'],
	}
	const servername = tlsServernameForObserve(input.servername)
	if (servername) {
		options.servername = servername
	}
	return options
}

/**
 * Observe the Engine leaf certificate without sending application data.
 * Fail-closed on empty cert, handshake error, or timeout. Never rejects.
 */
export function observeCandidateLeaf(
	input: ObserveCandidateLeafInput,
	options: { readonly timeoutMs?: number } = {},
): Promise<ObserveCandidateLeafResult> {
	const timeoutMs = options.timeoutMs ?? OBSERVE_CANDIDATE_LEAF_TIMEOUT_MS
	return new Promise((resolve) => {
		let settled = false
		let timer: ReturnType<typeof setTimeout> | undefined
		const finish = (result: ObserveCandidateLeafResult): void => {
			if (settled) {
				return
			}
			settled = true
			if (timer !== undefined) {
				clearTimeout(timer)
			}
			resolve(result)
		}

		const fail = (reason: string): void => {
			finish({ ok: false, code: 'observe_failed', reason })
		}

		let socket: tls.TLSSocket
		try {
			socket = tls.connect(buildObserveTlsOptions(input), () => {
				try {
					const peer = socket.getPeerCertificate(false)
					const raw = peer?.raw
					if (!raw || raw.length === 0) {
						socket.destroy()
						fail('observe_failed: peer certificate missing after TLS handshake')
						return
					}
					const leafDer = Uint8Array.from(raw)
					const leafSha256Hex = deriveEngineLeafFingerprintHex(leafDer)
					socket.destroy()
					finish({ ok: true, leafDer, leafSha256Hex })
				} catch (err) {
					socket.destroy()
					fail(`observe_failed: ${err instanceof Error ? err.message : String(err)}`)
				}
			})
		} catch (err) {
			fail(`observe_failed: ${err instanceof Error ? err.message : String(err)}`)
			return
		}

		timer = setTimeout(() => {
			socket.destroy()
			fail(`observe_failed: TLS observe timed out after ${timeoutMs}ms`)
		}, timeoutMs)

		socket.on('error', (err) => {
			fail(`observe_failed: ${err.message}`)
		})
	})
}
