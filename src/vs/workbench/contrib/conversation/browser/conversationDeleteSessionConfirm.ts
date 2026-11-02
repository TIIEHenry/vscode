/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from '../../../../base/common/lifecycle.js';
import type { Event } from '../../../../base/common/event.js';
import type { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { readPublishedEngineIdentityId, readPublishedLinkId } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { localize } from '../../../../nls.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';

/**
 * Shared delete confirmation for SessionBar, its More menu, the Sessions view, and Navigator Projects session rows.
 * Callers resolve an empty title with the same session-title lookup the SessionBar shows.
 */
export async function confirmDeleteConversationSession(dialogService: IDialogService, title: string): Promise<boolean> {
	const result = await dialogService.confirm({
		type: 'warning',
		message: localize('conversationLens.deleteSessionConfirm', "Delete session \"{0}\"?", title),
		detail: localize('conversationLens.deleteSessionConfirmDetail', "This permanently deletes the session and its messages. This cannot be undone."),
		primaryButton: localize('conversationLens.deleteSessionConfirmPrimary', "&&Delete"),
	});
	return result.confirmed;
}

/** Local fixtures and live Engine sessions have separate deletion authority. */
export type ConversationDeleteOwner = { readonly kind: 'local' } | {
	readonly kind: 'engine';
	readonly engineIdentityId: string | undefined;
	readonly linkId: number;
};

interface IConversationDeleteRoster {
	isEngineConnected(): boolean;
	hasEngineConnectionHistory(): boolean;
	readonly onDidChangeEngineConnection: Event<boolean>;
}

export function captureConversationDeleteOwner(roster: IConversationDeleteRoster, connection: IUniverseAgentConnection): ConversationDeleteOwner | undefined {
	if (!roster.isEngineConnected()) {
		return roster.hasEngineConnectionHistory() ? undefined : { kind: 'local' };
	}
	const snapshot = connection.getConnectionSnapshot();
	const linkId = readPublishedLinkId(snapshot);
	return linkId === undefined ? undefined : { kind: 'engine', linkId, engineIdentityId: readPublishedEngineIdentityId(snapshot) };
}

/** A phase-only disconnect invalidates the authority even if the same link returns. */
export function conversationDeleteOwnerSurvivesSnapshot(owner: ConversationDeleteOwner, snapshot: UniverseAgentConnectionSnapshot): boolean {
	if (owner.kind === 'local') {
		return snapshot.phase?.kind !== 'connected';
	}
	return !snapshot.pairingPending
		&& (snapshot.phase === undefined || snapshot.phase.kind === 'connected')
		&& readPublishedLinkId(snapshot) === owner.linkId
		&& readPublishedEngineIdentityId(snapshot) === owner.engineIdentityId;
}

export function sameConversationDeleteOwner(owner: ConversationDeleteOwner, roster: IConversationDeleteRoster, connection: IUniverseAgentConnection): boolean {
	const current = captureConversationDeleteOwner(roster, connection);
	if (!conversationDeleteOwnerSurvivesSnapshot(owner, connection.getConnectionSnapshot())) {
		return false;
	}
	return owner.kind === 'local'
		? current?.kind === 'local'
		: current?.kind === 'engine' && current.linkId === owner.linkId && current.engineIdentityId === owner.engineIdentityId;
}

/** Scoped to one confirmation; invalidation is permanent until the caller disposes it. */
export function guardConversationDeleteConfirmation(owner: ConversationDeleteOwner, roster: IConversationDeleteRoster, connection: IUniverseAgentConnection): { isCurrent(): boolean; dispose(): void } {
	const store = new DisposableStore();
	let invalidated = false;
	store.add(connection.onDidChangeConnection(snapshot => {
		if (!conversationDeleteOwnerSurvivesSnapshot(owner, snapshot) || !sameConversationDeleteOwner(owner, roster, connection)) {
			invalidated = true;
		}
	}));
	store.add(roster.onDidChangeEngineConnection(connected => {
		if ((owner.kind === 'engine' && !connected) || (owner.kind === 'local' && connected) || !sameConversationDeleteOwner(owner, roster, connection)) {
			invalidated = true;
		}
	}));
	return {
		isCurrent: () => !invalidated && sameConversationDeleteOwner(owner, roster, connection),
		dispose: () => store.dispose(),
	};
}
