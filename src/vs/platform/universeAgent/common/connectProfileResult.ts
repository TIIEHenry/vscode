/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentConnectProfileResult } from './connectionHubTypes.js';

const SAS_PLACEHOLDER = 'XXXX-XXXX';

/** Handshake sasCode only — placeholder `XXXX-XXXX` is not a verifiable code. */
export function readConnectProfileSasCode(source: unknown): string | undefined {
	if (!source || typeof source !== 'object') {
		return undefined;
	}
	const sasCode = (source as { readonly sasCode?: unknown }).sasCode;
	if (typeof sasCode !== 'string') {
		return undefined;
	}
	const trimmed = sasCode.trim();
	if (!trimmed || trimmed === SAS_PLACEHOLDER) {
		return undefined;
	}
	return trimmed;
}

export function readConnectProfileLeafFingerprint(source: unknown): string | undefined {
	if (!source || typeof source !== 'object') {
		return undefined;
	}
	const leaf = (source as { readonly leafSha256Hex?: unknown }).leafSha256Hex;
	if (typeof leaf !== 'string') {
		return undefined;
	}
	const trimmed = leaf.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * IPC-safe connectProfile contract: renderer always sees a concrete pairing
 * payload (`sasCode` or `recoverTrust` + fingerprint) when `pairingPending`.
 * Empty SAS still marked ok is rejected here — JSON IPC would drop `undefined`.
 */
export function finalizeConnectProfileResult(result: UniverseAgentConnectProfileResult): UniverseAgentConnectProfileResult {
	if (!result.ok) {
		return { ok: false, code: result.code, reason: result.reason };
	}
	if (result.pairingPending !== true) {
		return {
			ok: true,
			path: result.path,
			sessionToken: result.sessionToken,
			workDir: result.workDir,
			pairingPending: false,
		};
	}
	if (result.recoverTrust === true) {
		const leafSha256Hex = readConnectProfileLeafFingerprint(result);
		if (!leafSha256Hex) {
			return {
				ok: false,
				code: 'trust_missing',
				reason: 'recoverTrust missing observed leaf fingerprint',
			};
		}
		return {
			ok: true,
			path: result.path,
			pairingPending: true,
			recoverTrust: true,
			engineIdentityId: result.engineIdentityId,
			leafSha256Hex,
		};
	}
	const sasCode = readConnectProfileSasCode(result);
	if (!sasCode) {
		return {
			ok: false,
			code: 'pairing_required',
			reason: 'pairing pending without handshake sasCode or recoverTrust fingerprint',
		};
	}
	return {
		ok: true,
		path: result.path,
		workDir: result.workDir,
		pairingPending: true,
		sasCode,
		engineIdentityId: result.engineIdentityId,
	};
}
