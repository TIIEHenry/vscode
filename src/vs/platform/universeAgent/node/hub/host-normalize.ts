import { domainToASCII, domainToUnicode } from 'node:url'
import type { NormalizedHost, NormalizedUrl } from './hubTypes.js'

export type HostNormalizeResult =
	| { readonly ok: true; readonly host: NormalizedHost }
	| { readonly ok: false; readonly reason: string }

export type UrlNormalizeResult =
	| { readonly ok: true; readonly url: NormalizedUrl; readonly host: NormalizedHost }
	| { readonly ok: false; readonly reason: string }

export type PortNormalizeResult =
	{ readonly ok: true; readonly port: number } | { readonly ok: false; readonly reason: string }

/** Reject userinfo, empty, whitespace, and path-like smuggling. */
function rejectRawHostShape(raw: string): string | undefined {
	if (typeof raw !== 'string') return 'host must be a string'
	const trimmed = raw.trim()
	if (trimmed.length === 0) return 'host is empty'
	if (trimmed !== raw) return 'host has leading or trailing whitespace'
	if (/[\s<>"']/.test(trimmed)) return 'host contains forbidden characters'
	if (trimmed.includes('@')) return 'host must not include userinfo'
	if (
		trimmed.includes('/') ||
		trimmed.includes('\\') ||
		trimmed.includes('?') ||
		trimmed.includes('#')
	) {
		return 'host must not include path, query, or fragment'
	}
	if (trimmed.includes(':') && !trimmed.startsWith('[')) {
		// bare IPv6 without brackets, or host:port smuggling — reject; callers pass port separately
		if (!isLikelyBareIpv6(trimmed)) return 'host must not include a port'
	}
	return undefined
}

function isLikelyBareIpv6(value: string): boolean {
	return value.includes(':') && !value.includes('.') && /^[0-9a-fA-F:]+$/.test(value)
}

function stripIpv6Brackets(host: string): { inner: string; wasBracketed: boolean } {
	if (host.startsWith('[') && host.endsWith(']')) {
		return { inner: host.slice(1, -1), wasBracketed: true }
	}
	return { inner: host, wasBracketed: false }
}

/**
 * Canonicalize host to lowercase ASCII (IDNA / punycode via domainToASCII).
 * IPv6 becomes a compressed lowercase form without brackets.
 */
export function normalizeHost(raw: string): HostNormalizeResult {
	const shapeError = rejectRawHostShape(raw)
	if (shapeError !== undefined) return { ok: false, reason: shapeError }

	const { inner, wasBracketed } = stripIpv6Brackets(raw)

	if (isIpv4Literal(inner)) {
		return { ok: true, host: canonicalizeIpv4(inner) as NormalizedHost }
	}

	if (isLikelyBareIpv6(inner) || wasBracketed) {
		const ipv6 = canonicalizeIpv6(inner)
		if (ipv6 === undefined) return { ok: false, reason: 'invalid IPv6 address' }
		return { ok: true, host: ipv6 as NormalizedHost }
	}

	// DNS name → IDNA ASCII lowercase
	let ascii: string
	try {
		ascii = domainToASCII(inner)
	} catch {
		return { ok: false, reason: 'host failed IDNA conversion' }
	}
	if (!ascii) return { ok: false, reason: 'host failed IDNA conversion' }
	const lower = ascii.toLowerCase()
	// Round-trip sanity: reject if Unicode form is empty for non-ASCII labels
	try {
		domainToUnicode(lower)
	} catch {
		return { ok: false, reason: 'host failed IDNA round-trip' }
	}
	if (lower.includes(':') || lower.includes('@')) {
		return { ok: false, reason: 'normalized host still contains forbidden characters' }
	}
	return { ok: true, host: lower as NormalizedHost }
}

export function normalizePort(port: number): PortNormalizeResult {
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		return { ok: false, reason: 'port must be an integer in 1..65535' }
	}
	return { ok: true, port }
}

// eslint-disable-next-line no-control-regex -- INV-HNU-SHP-1 raw shape gate (C0 + space + DEL + backslash)
const HTTPS_URL_FORBIDDEN_SHAPE = /[\u0000-\u0020\u007f\\]/

// INV-HNU-UWS-1: Unicode whitespace beyond SHP-1 ASCII (not C0; no no-control-regex)
const HTTPS_URL_UNICODE_WHITESPACE =
	/[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/

/** INV-HNU-SHP-1: reject ASCII whitespace / C0 / DEL / backslash before WHATWG parse. */
/** INV-HNU-UWS-1: after ASCII SHP-1, reject Unicode whitespace before WHATWG parse. */
function rejectRawHttpsUrlShape(raw: unknown): string | undefined {
	if (typeof raw !== 'string') return 'url must be a string'
	if (raw.length === 0) return 'url is empty'
	if (HTTPS_URL_FORBIDDEN_SHAPE.test(raw)) {
		return 'url contains whitespace, control, or backslash characters'
	}
	// INV-HNU-UWS-1: after ASCII SHP-1, before parse
	if (HTTPS_URL_UNICODE_WHITESPACE.test(raw)) {
		return 'url contains unicode whitespace'
	}
	return undefined
}

/** https URL only; host extracted and normalized; reject userinfo. */
export function normalizeHttpsUrl(raw: string): UrlNormalizeResult {
	const shapeError = rejectRawHttpsUrlShape(raw)
	if (shapeError !== undefined) return { ok: false, reason: shapeError }
	let parsed: URL
	try {
		parsed = new URL(raw)
	} catch {
		return { ok: false, reason: 'url is not parseable' }
	}
	if (parsed.protocol !== 'https:') {
		return { ok: false, reason: 'url must use https' }
	}
	if (parsed.username !== '' || parsed.password !== '') {
		return { ok: false, reason: 'url must not include userinfo' }
	}
	const hostResult = normalizeHost(parsed.hostname)
	if (!hostResult.ok) return { ok: false, reason: hostResult.reason }
	const portPart = parsed.port === '' || parsed.port === '443' ? '' : `:${parsed.port}`
	const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '')
	if (parsed.search !== '' || parsed.hash !== '') {
		return { ok: false, reason: 'url must not include query or fragment' }
	}
	const canonical =
		`https://${formatHostForUrl(hostResult.host)}${portPart}${path}` as NormalizedUrl
	return { ok: true, url: canonical, host: hostResult.host }
}

function formatHostForUrl(host: NormalizedHost): string {
	return host.includes(':') ? `[${host}]` : host
}

function isIpv4Literal(value: string): boolean {
	const parts = value.split('.')
	if (parts.length !== 4) return false
	return parts.every((p) => {
		if (!/^\d{1,3}$/.test(p)) return false
		const n = Number(p)
		return n >= 0 && n <= 255 && String(n) === p
	})
}

function canonicalizeIpv4(value: string): string {
	return value
		.split('.')
		.map((p) => String(Number(p)))
		.join('.')
}

/** Compress IPv6 to RFC 5952-ish lowercase form; returns undefined if invalid. */
export function canonicalizeIpv6(raw: string): string | undefined {
	const expanded = expandIpv6(raw)
	if (expanded === undefined) return undefined
	const hex = expanded.map((n) => n.toString(16))
	// find longest zero run
	let bestStart = -1
	let bestLen = 0
	let i = 0
	while (i < 8) {
		if (hex[i] !== '0') {
			i += 1
			continue
		}
		let j = i
		while (j < 8 && hex[j] === '0') j += 1
		const len = j - i
		if (len > bestLen) {
			bestStart = i
			bestLen = len
		}
		i = j
	}
	if (bestLen < 2) return hex.join(':')
	const head = hex.slice(0, bestStart).join(':')
	const tail = hex.slice(bestStart + bestLen).join(':')
	if (bestStart === 0 && bestStart + bestLen === 8) return '::'
	if (bestStart === 0) return `::${tail}`
	if (bestStart + bestLen === 8) return `${head}::`
	return `${head}::${tail}`
}

function expandIpv6(raw: string): number[] | undefined {
	if (raw.includes('.')) return undefined // reject v4-mapped for dial hosts
	const sides = raw.split('::')
	if (sides.length > 2) return undefined
	const parseSide = (side: string): number[] | undefined => {
		if (side === '') return []
		const parts = side.split(':')
		const out: number[] = []
		for (const p of parts) {
			if (!/^[0-9a-fA-F]{1,4}$/.test(p)) return undefined
			out.push(parseInt(p, 16))
		}
		return out
	}
	if (sides.length === 1) {
		const parts = parseSide(sides[0]!)
		if (parts === undefined || parts.length !== 8) return undefined
		return parts
	}
	const left = parseSide(sides[0]!)
	const right = parseSide(sides[1]!)
	if (left === undefined || right === undefined) return undefined
	const missing = 8 - left.length - right.length
	if (missing < 1) return undefined
	return [...left, ...Array.from({ length: missing }, () => 0), ...right]
}
