/**
 * Hub AuthSession control-plane client (ADR-026).
 * POST /api/v1/auth/login and /change-password; WebPKI HTTPS only; no cookies.
 */
import { normalizeHttpsUrl } from './host-normalize.js'

export type HubAuthDenialCode =
	| 'hub_auth_http_failed'
	| 'hub_auth_invalid_credentials'
	| 'hub_auth_contract_invalid'
	| 'hub_auth_session_required'

export type ParsedAuthSessionV1 = {
	readonly accessToken: string
	readonly expiresIn: number
	readonly csrfToken: string
	readonly mustChangePassword: boolean
	readonly user: {
		readonly id: string
		readonly email: string
		readonly role: string
		readonly status: string
	}
}

export type HubAuthHttp = {
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

const HUB_AUTH_TIMEOUT_MS = 10_000

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

function isPositiveFiniteInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
}

function contractInvalid(reason: string): {
	readonly ok: false
	readonly code: 'hub_auth_contract_invalid'
	readonly reason: string
} {
	return { ok: false, code: 'hub_auth_contract_invalid', reason }
}

export function parseAuthSessionV1(
	raw: unknown,
):
	| { readonly ok: true; readonly session: ParsedAuthSessionV1 }
	| { readonly ok: false; readonly code: 'hub_auth_contract_invalid'; readonly reason: string } {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return contractInvalid('auth session response must be an object')
	}
	const record = raw as object
	if (
		Object.hasOwn(record, 'access_token') ||
		Object.hasOwn(record, 'expires_in') ||
		Object.hasOwn(record, 'csrf_token') ||
		Object.hasOwn(record, 'must_change_password')
	) {
		return contractInvalid('auth session response must use camelCase own-data keys')
	}

	const accessToken = readOwnDataValue(record, 'accessToken')
	const expiresIn = readOwnDataValue(record, 'expiresIn')
	const csrfToken = readOwnDataValue(record, 'csrfToken')
	const mustChangePassword = readOwnDataValue(record, 'mustChangePassword')
	const userRaw = readOwnDataValue(record, 'user')

	if (!isExactNonEmptyString(accessToken)) {
		return contractInvalid('accessToken must be a non-empty exact string')
	}
	if (!isPositiveFiniteInteger(expiresIn)) {
		return contractInvalid('expiresIn must be a positive integer')
	}
	if (!isExactNonEmptyString(csrfToken)) {
		return contractInvalid('csrfToken must be a non-empty exact string')
	}
	if (typeof mustChangePassword !== 'boolean') {
		return contractInvalid('mustChangePassword must be a boolean')
	}
	if (typeof userRaw !== 'object' || userRaw === null || Array.isArray(userRaw)) {
		return contractInvalid('user must be an object')
	}
	const userRecord = userRaw as object
	if (Object.hasOwn(userRecord, 'user_id') || Object.hasOwn(userRecord, 'must_change_password')) {
		return contractInvalid('user must use camelCase own-data keys')
	}
	const id = readOwnDataValue(userRecord, 'id')
	const email = readOwnDataValue(userRecord, 'email')
	const role = readOwnDataValue(userRecord, 'role')
	const status = readOwnDataValue(userRecord, 'status')
	if (!isExactNonEmptyString(id)) {
		return contractInvalid('user.id must be a non-empty exact string')
	}
	if (!isExactNonEmptyString(email)) {
		return contractInvalid('user.email must be a non-empty exact string')
	}
	if (!isExactNonEmptyString(role)) {
		return contractInvalid('user.role must be a non-empty exact string')
	}
	if (!isExactNonEmptyString(status)) {
		return contractInvalid('user.status must be a non-empty exact string')
	}

	return {
		ok: true,
		session: {
			accessToken,
			expiresIn,
			csrfToken,
			mustChangePassword,
			user: { id, email, role, status },
		},
	}
}

function createFetchAbortSignal(): AbortSignal {
	if (typeof AbortSignal.timeout === 'function') {
		return AbortSignal.timeout(HUB_AUTH_TIMEOUT_MS)
	}
	const controller = new AbortController()
	setTimeout(() => controller.abort(), HUB_AUTH_TIMEOUT_MS)
	return controller.signal
}

function defaultHttp(): HubAuthHttp {
	return { fetch: globalThis.fetch.bind(globalThis) }
}

export type LoginHubInput = {
	readonly hubBaseUrl: string
	readonly email: string
	readonly password: string
}

export type LoginHubResult =
	| { readonly ok: true; readonly session: ParsedAuthSessionV1 }
	| { readonly ok: false; readonly code: HubAuthDenialCode; readonly reason: string }

export async function loginHub(
	input: LoginHubInput,
	http: HubAuthHttp = defaultHttp(),
): Promise<LoginHubResult> {
	if (!isExactNonEmptyString(input.email)) {
		return contractInvalid('email must be a non-empty exact string')
	}
	if (typeof input.password !== 'string' || input.password.length === 0) {
		return contractInvalid('password must be a non-empty string')
	}

	const hubUrl = normalizeHttpsUrl(input.hubBaseUrl)
	if (!hubUrl.ok) {
		return contractInvalid(`hubBaseUrl is invalid: ${hubUrl.reason}`)
	}

	const requestUrl = new URL('/api/v1/auth/login', hubUrl.url)
	const body = JSON.stringify({
		email: input.email,
		password: input.password,
	})

	try {
		const response = await http.fetch(String(requestUrl), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body,
			signal: createFetchAbortSignal(),
		})

		if (response.status === 401) {
			return {
				ok: false,
				code: 'hub_auth_invalid_credentials',
				reason: 'hub login denied with HTTP 401',
			}
		}

		if (response.status !== 200 && response.status !== 403) {
			return {
				ok: false,
				code: 'hub_auth_http_failed',
				reason: `hub login HTTP ${response.status}`,
			}
		}

		const raw = await response.json()
		const parsed = parseAuthSessionV1(raw)
		if (!parsed.ok) {
			return parsed
		}
		return { ok: true, session: parsed.session }
	} catch (err) {
		return {
			ok: false,
			code: 'hub_auth_http_failed',
			reason: `hub login request failed: ${err instanceof Error ? err.message : String(err)}`,
		}
	}
}

export type ChangeHubPasswordInput = {
	readonly hubBaseUrl: string
	readonly accessToken: string
	readonly oldPassword: string
	readonly newPassword: string
}

export type ChangeHubPasswordResult =
	| { readonly ok: true; readonly session: ParsedAuthSessionV1 }
	| { readonly ok: false; readonly code: HubAuthDenialCode; readonly reason: string }

export async function changeHubPassword(
	input: ChangeHubPasswordInput,
	http: HubAuthHttp = defaultHttp(),
): Promise<ChangeHubPasswordResult> {
	const token = input.accessToken.trim()
	if (token.length === 0) {
		return {
			ok: false,
			code: 'hub_auth_session_required',
			reason: 'hub access token is required to change password',
		}
	}
	if (typeof input.oldPassword !== 'string' || input.oldPassword.length === 0) {
		return contractInvalid('oldPassword must be a non-empty string')
	}
	if (typeof input.newPassword !== 'string' || input.newPassword.length === 0) {
		return contractInvalid('newPassword must be a non-empty string')
	}

	const hubUrl = normalizeHttpsUrl(input.hubBaseUrl)
	if (!hubUrl.ok) {
		return contractInvalid(`hubBaseUrl is invalid: ${hubUrl.reason}`)
	}

	const requestUrl = new URL('/api/v1/auth/change-password', hubUrl.url)
	const body = JSON.stringify({
		oldPassword: input.oldPassword,
		newPassword: input.newPassword,
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

		if (response.status === 401) {
			return {
				ok: false,
				code: 'hub_auth_invalid_credentials',
				reason: 'hub change-password denied with HTTP 401',
			}
		}

		if (response.status !== 200 && response.status !== 403) {
			return {
				ok: false,
				code: 'hub_auth_http_failed',
				reason: `hub change-password HTTP ${response.status}`,
			}
		}

		const raw = await response.json()
		const parsed = parseAuthSessionV1(raw)
		if (!parsed.ok) {
			return parsed
		}
		return { ok: true, session: parsed.session }
	} catch (err) {
		return {
			ok: false,
			code: 'hub_auth_http_failed',
			reason: `hub change-password request failed: ${err instanceof Error ? err.message : String(err)}`,
		}
	}
}

export type LogoutHubInput = {
	readonly hubBaseUrl: string
	readonly accessToken: string
}

export async function logoutHub(
	input: LogoutHubInput,
	http: HubAuthHttp = defaultHttp(),
): Promise<void> {
	const token = input.accessToken.trim()
	if (token.length === 0) {
		return
	}
	const hubUrl = normalizeHttpsUrl(input.hubBaseUrl)
	if (!hubUrl.ok) {
		return
	}
	const requestUrl = new URL('/api/v1/auth/logout', hubUrl.url)
	try {
		await http.fetch(String(requestUrl), {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/json',
			},
			body: '',
			signal: createFetchAbortSignal(),
		})
	} catch {
		// ADR-318 path 2: Hub logout is idempotent; local clear is authoritative.
	}
}
