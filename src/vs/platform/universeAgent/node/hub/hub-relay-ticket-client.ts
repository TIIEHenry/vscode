/**
 * Hub relay ticket control-plane client (ADR-025).
 * POST /api/v1/relay-tickets with Hub AuthSession Bearer; WebPKI HTTPS only.
 */
import { normalizeHttpsUrl } from './host-normalize.js'

export type HubRelayTicketDenialCode =
	| 'hub_session_required'
	| 'hub_ticket_http_failed'
	| 'hub_ticket_contract_invalid'
	| 'hub_ticket_expired'
	| 'hub_rate_limited'
	| 'hub_forbidden'

export type IssueHubRelayTicketInput = {
	readonly hubBaseUrl: string
	readonly hubDeviceId: string
	readonly clientIdentityId: string
	readonly accessToken: string
	readonly nowMs: number
}

export type IssueHubRelayTicketResult =
	| {
			readonly ok: true
			readonly ticketId: string
			readonly authority: string
			readonly expiresAtMs: number
		}
	| {
			readonly ok: false
			readonly code: HubRelayTicketDenialCode
			readonly reason: string
		}

export type HubRelayTicketHttp = {
	readonly fetch: (
		url: string,
		init: {
			readonly method: 'POST'
			readonly headers: Readonly<Record<string, string>>
			readonly body: string
			readonly signal?: AbortSignal
		},
	) => Promise<{
		readonly status: number
		readonly json: () => Promise<unknown>
	}>
}

const HUB_RELAY_TICKET_TIMEOUT_MS = 10_000

const RELAY_NONCE_LABEL_RE = /^[a-z0-9]{14,52}$/
const DNS_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

function isExactNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value === value.trim()
}

function isDnsLabel(label: string): boolean {
	return label.length > 0 && label.length <= 63 && DNS_LABEL_RE.test(label)
}

/** Relay authority domain: r-<base32 nonce>.<dns suffix with ≥2 labels>. */
export function isHubRelayAuthority(value: string): boolean {
	if (typeof value !== 'string' || value !== value.trim() || value.length === 0) {
		return false
	}
	if (!value.startsWith('r-')) return false
	const dotIndex = value.indexOf('.')
	if (dotIndex <= 2) return false
	const nonce = value.slice(2, dotIndex)
	if (!RELAY_NONCE_LABEL_RE.test(nonce)) return false
	const suffix = value.slice(dotIndex + 1)
	const labels = suffix.split('.')
	if (labels.length < 2) return false
	return labels.every(isDnsLabel)
}

function contractInvalid(reason: string): IssueHubRelayTicketResult {
	return { ok: false, code: 'hub_ticket_contract_invalid', reason }
}

export function parseHubRelayTicketResponse(
	raw: unknown,
	nowMs: number,
): IssueHubRelayTicketResult {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return contractInvalid('relay ticket response must be an object')
	}
	const record = raw as object
	if (Object.hasOwn(record, 'ticket_id') || Object.hasOwn(record, 'expires_at')) {
		return contractInvalid('relay ticket response must use camelCase own-data keys')
	}

	const ticketId = readOwnDataValue(record, 'ticketId')
	const authority = readOwnDataValue(record, 'authority')
	const expiresAt = readOwnDataValue(record, 'expiresAt')

	if (!isExactNonEmptyString(ticketId)) {
		return contractInvalid('ticketId must be a non-empty exact string')
	}
	if (!isExactNonEmptyString(authority) || !isHubRelayAuthority(authority)) {
		return contractInvalid('authority must be a validated relay routing domain')
	}
	if (!isExactNonEmptyString(expiresAt)) {
		return contractInvalid('expiresAt must be a non-empty exact RFC3339 string')
	}

	const expiresAtMs = Date.parse(expiresAt)
	if (!Number.isFinite(expiresAtMs)) {
		return contractInvalid('expiresAt is not a parseable timestamp')
	}
	if (expiresAtMs <= nowMs) {
		return {
			ok: false,
			code: 'hub_ticket_expired',
			reason: 'relay ticket expiresAt is not in the future',
		}
	}

	return {
		ok: true,
		ticketId,
		authority,
		expiresAtMs,
	}
}

function createFetchAbortSignal(): AbortSignal {
	if (typeof AbortSignal.timeout === 'function') {
		return AbortSignal.timeout(HUB_RELAY_TICKET_TIMEOUT_MS)
	}
	const controller = new AbortController()
	setTimeout(() => controller.abort(), HUB_RELAY_TICKET_TIMEOUT_MS)
	return controller.signal
}

function defaultHttp(): HubRelayTicketHttp {
	return { fetch: globalThis.fetch.bind(globalThis) }
}

function mapHttpStatus(status: number): HubRelayTicketDenialCode {
	if (status === 401) return 'hub_session_required'
	if (status === 403) return 'hub_forbidden'
	if (status === 429) return 'hub_rate_limited'
	return 'hub_ticket_http_failed'
}

export async function issueHubRelayTicket(
	input: IssueHubRelayTicketInput,
	http: HubRelayTicketHttp = defaultHttp(),
): Promise<IssueHubRelayTicketResult> {
	const token = input.accessToken.trim()
	if (token.length === 0) {
		return {
			ok: false,
			code: 'hub_session_required',
			reason: 'hub access token is required to issue a relay ticket',
		}
	}
	if (!isExactNonEmptyString(input.clientIdentityId)) {
		return contractInvalid('clientIdentityId must be a non-empty exact string')
	}
	if (input.hubDeviceId.trim().length === 0) {
		return contractInvalid('hubDeviceId must be a non-empty string')
	}

	const hubUrl = normalizeHttpsUrl(input.hubBaseUrl)
	if (!hubUrl.ok) {
		return contractInvalid(`hubBaseUrl is invalid: ${hubUrl.reason}`)
	}

	const requestUrl = new URL('/api/v1/relay-tickets', hubUrl.url)
	const body = JSON.stringify({
		hubDeviceId: input.hubDeviceId.trim(),
		clientIdentityId: input.clientIdentityId,
	})

	try {
		const response = await http.fetch(String(requestUrl), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body,
			signal: createFetchAbortSignal(),
		})

		if (response.status !== 200) {
			const code = mapHttpStatus(response.status)
			return {
				ok: false,
				code,
				reason:
					code === 'hub_ticket_http_failed'
						? `relay ticket HTTP ${response.status}`
						: `relay ticket request denied with HTTP ${response.status}`,
			}
		}

		const raw = await response.json()
		return parseHubRelayTicketResponse(raw, input.nowMs)
	} catch (err) {
		return {
			ok: false,
			code: 'hub_ticket_http_failed',
			reason: `relay ticket request failed: ${err instanceof Error ? err.message : String(err)}`,
		}
	}
}
