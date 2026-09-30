/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { HubRefreshHttp, HubRefreshResult, IHubSessionStore } from './hubSessionStore.js';

export function isHubControlPlaneAuthDenial(code: string): boolean {
	return code === 'hub_session_required' || code === 'hub_forbidden';
}

export function isHubRefreshAuthFailure(result: HubRefreshResult): boolean {
	return !result.ok && result.code === 'hub_auth_http_failed' && /\bHTTP (401|403)\b/.test(result.reason);
}

export type HubAccessRetryOutcome<T, E extends { readonly ok: false; readonly code: string; readonly reason: string }> =
	| { readonly ok: true; readonly value: T }
	| E
	| { readonly ok: false; readonly authExpired: true }
	| { readonly ok: false; readonly code: 'hub_unreachable'; readonly reason: string };

export function isHubAccessAuthExpired<T, E extends { readonly ok: false; readonly code: string; readonly reason: string }>(
	result: HubAccessRetryOutcome<T, E>,
): result is { readonly ok: false; readonly authExpired: true } {
	return !result.ok && (result as { readonly authExpired?: true }).authExpired === true;
}

export type HubAccessRetryDeps = {
	readonly store: IHubSessionStore;
	readonly hubBaseUrl: string;
	readonly nowMs: number;
	readonly http: HubRefreshHttp;
};

async function resolveAccessToken(
	deps: HubAccessRetryDeps,
	options: { readonly forceRefresh?: boolean },
): Promise<
	| { readonly ok: true; readonly accessToken: string }
	| { readonly ok: false; readonly authExpired: true }
	| { readonly ok: false; readonly code: 'hub_unreachable'; readonly reason: string }
> {
	const refresh = await deps.store.refreshIfNeeded(
		deps.hubBaseUrl,
		deps.nowMs,
		deps.http,
		options.forceRefresh ? { force: true } : undefined,
	);
	if (!refresh.ok) {
		if (isHubRefreshAuthFailure(refresh)) {
			return { ok: false, authExpired: true };
		}
		return { ok: false, code: 'hub_unreachable', reason: refresh.reason };
	}
	const accessToken = deps.store.getAccessTokenForHub(deps.hubBaseUrl, deps.nowMs);
	if (!accessToken) {
		return { ok: false, authExpired: true };
	}
	return { ok: true, accessToken };
}

/**
 * Proactively refresh when access TTL expired; on control-plane 401/403 retry once after forced refresh.
 * Refresh HTTP 401/403 → authExpired. Any other refresh failure keeps its reason and is hub_unreachable.
 */
export async function withHubAccessRetry<T, E extends { readonly ok: false; readonly code: string; readonly reason: string }>(
	deps: HubAccessRetryDeps,
	request: (accessToken: string) => Promise<{ readonly ok: true; readonly value: T } | E>,
): Promise<HubAccessRetryOutcome<T, E>> {
	const initial = await resolveAccessToken(deps, {});
	if (!initial.ok) {
		return initial;
	}

	const first = await request(initial.accessToken);
	if (first.ok || !isHubControlPlaneAuthDenial(first.code)) {
		return first;
	}

	const afterRefresh = await resolveAccessToken(deps, { forceRefresh: true });
	if (!afterRefresh.ok) {
		return afterRefresh;
	}

	return request(afterRefresh.accessToken);
}
