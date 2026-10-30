/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { readPublishedEngineIdentityId, readPublishedLinkId } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';

export type EngineWriteLink = { readonly engineIdentityId: string; readonly linkId: number };

export function captureEngineWriteLink(connection: IUniverseAgentConnection): EngineWriteLink | undefined {
	const snapshot = connection.getConnectionSnapshot();
	const engineIdentityId = readPublishedEngineIdentityId(snapshot);
	const linkId = readPublishedLinkId(snapshot);
	return engineIdentityId && linkId !== undefined ? { engineIdentityId, linkId } : undefined;
}

export function isSameEngineWriteLink(connection: IUniverseAgentConnection, link: EngineWriteLink): boolean {
	const current = captureEngineWriteLink(connection);
	return current?.engineIdentityId === link.engineIdentityId && current.linkId === link.linkId;
}

export type EngineWriteDisposition = 'current' | 'disposed' | 'changed';

/** Result checks must not consult catalog mode. A refresh sets mode to loading and would look like a link change. */
export function classifyEngineWrite(store: DisposableStore, connection: IUniverseAgentConnection, link: EngineWriteLink): EngineWriteDisposition {
	if (store.isDisposed) {
		return 'disposed';
	}
	return isSameEngineWriteLink(connection, link) ? 'current' : 'changed';
}

export function engineWriteNotSentCopy(): string {
	return localize('ua.engineWriteNotSent', "The connection changed before this was sent. Try again.");
}

export function engineWriteUnconfirmedCopy(): string {
	return localize('ua.engineWriteUnconfirmed', "The connection changed. The result was not confirmed. Check the list.");
}

export function engineWriteSelectionNotSentCopy(): string {
	return localize('ua.engineWriteSelectionNotSent', "The selection changed before this was sent. Try again.");
}

export function engineWriteSelectionUnconfirmedCopy(): string {
	return localize('ua.engineWriteSelectionUnconfirmed', "The selection changed. The result is not shown on the current item.");
}

export type EngineWriteEvaluation = {
	readonly link: EngineWriteLink;
	readonly sent: boolean;
	/** Omit after this write has cleared the selection. */
	readonly targetId?: string;
	readonly currentTargetId?: string;
	/** This write's own in-flight generation. A mismatch reuses the connection copy. */
	readonly generation?: number;
	readonly currentGeneration?: number;
};

export type EngineWriteEvaluationResult =
	| { readonly kind: 'current' }
	| { readonly kind: 'disposed' }
	| { readonly kind: 'rejected'; readonly message: string };

/** Link, then a target this write has not cleared, then its in-flight generation. Catalog mode is not consulted. */
export function evaluateEngineWrite(store: DisposableStore, connection: IUniverseAgentConnection, evaluation: EngineWriteEvaluation): EngineWriteEvaluationResult {
	if (store.isDisposed) {
		return { kind: 'disposed' };
	}
	if (!isSameEngineWriteLink(connection, evaluation.link)) {
		return { kind: 'rejected', message: evaluation.sent ? engineWriteUnconfirmedCopy() : engineWriteNotSentCopy() };
	}
	if (evaluation.targetId !== undefined && evaluation.currentTargetId !== evaluation.targetId) {
		return { kind: 'rejected', message: evaluation.sent ? engineWriteSelectionUnconfirmedCopy() : engineWriteSelectionNotSentCopy() };
	}
	if (evaluation.generation !== undefined && evaluation.currentGeneration !== evaluation.generation) {
		return { kind: 'rejected', message: evaluation.sent ? engineWriteUnconfirmedCopy() : engineWriteNotSentCopy() };
	}
	return { kind: 'current' };
}

/**
 * List refresh token. A token dies when a newer refresh starts, the view is
 * disposed, or the published engine link is no longer the one captured at begin.
 */
export class EngineRefreshGate {
	private generation = 0;
	private link: EngineWriteLink | undefined;

	constructor(
		private readonly connection: IUniverseAgentConnection,
		private readonly store: DisposableStore,
	) { }

	begin(): number {
		this.generation++;
		this.link = captureEngineWriteLink(this.connection);
		return this.generation;
	}

	isCurrent(token: number): boolean {
		if (this.store.isDisposed || token !== this.generation) {
			return false;
		}
		const current = captureEngineWriteLink(this.connection);
		return current?.engineIdentityId === this.link?.engineIdentityId && current?.linkId === this.link?.linkId;
	}

	invalidate(): void {
		this.generation++;
	}
}
