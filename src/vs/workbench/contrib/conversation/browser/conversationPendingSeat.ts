/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { PendingActionView } from '../../../../platform/universeAgent/common/sessionView/index.js';
import type { ConversationStubTurn } from './conversationStubModel.js';

/** Host surface for the shared pending-seat scroll helper (CS-3). */
export interface IConversationPendingSeatHost {
	readonly lensId: string;
	showConversationLens(): void;
	readonly inputMaximized: boolean;
	setInputMaximized(maximized: boolean): void;
	findFirstPendingConfirmationTurnId(): string | undefined;
	getConfirmationElement(turnId: string): HTMLElement | undefined;
}

/** §2 inactive-session rule: not the roster active id, or Conversation part hidden. */
export function isConversationSessionInactive(sessionId: string, activeSessionId: string, conversationPartVisible: boolean): boolean {
	return sessionId !== activeSessionId || !conversationPartVisible;
}

export function isPendingAttentionAction(action: PendingActionView): boolean {
	return action.summary.kind === 'permission' || action.summary.kind === 'question';
}

export function collectPendingAttentionRequestIds(actions: readonly PendingActionView[]): readonly string[] {
	return actions.filter(isPendingAttentionAction).map(action => String(action.requestId));
}

export function hasNewPendingAttention(previousIds: ReadonlySet<string>, nextIds: readonly string[]): boolean {
	return nextIds.some(id => !previousIds.has(id));
}

/** CS-3 keep confirmation-first; question pending is included so toast click can land on a question seat. */
export function findFirstPendingConfirmationTurnId(turns: readonly ConversationStubTurn[]): string | undefined {
	return turns.find(turn =>
		(turn.kind === 'confirmation' || turn.kind === 'question') && turn.status === 'pending'
	)?.id;
}

export function scrollToFirstPendingConfirmation(host: IConversationPendingSeatHost): void {
	if (host.lensId === 'trajectory') {
		host.showConversationLens();
	}
	if (host.inputMaximized) {
		host.setInputMaximized(false);
	}
	const pendingId = host.findFirstPendingConfirmationTurnId();
	if (!pendingId) {
		return;
	}
	host.getConfirmationElement(pendingId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
