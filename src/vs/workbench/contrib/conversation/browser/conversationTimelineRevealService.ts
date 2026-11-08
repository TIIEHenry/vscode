/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { localize } from '../../../../nls.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import type { ConversationLens } from './conversationLens.js';

export const IConversationTimelineRevealService = createDecorator<IConversationTimelineRevealService>('conversationTimelineRevealService');

export interface IConversationTimelineRevealService {
	readonly _serviceBrand: undefined;
	/**
	 * Register an unfiltered lens under the session key the caller already has.
	 * A later registration for the same key replaces the earlier one as active.
	 * Disposing removes only that registration; an earlier live lens for the key is restored.
	 */
	registerLens(sessionKey: string, lens: ConversationLens): { dispose(): void };
	revealItem(itemId: string, sessionId: string): void;
	getAccessibleTurnContent(sessionId: string): string | undefined;
	focusAccessibleTurn(sessionId: string): void;
	scrollToFirstPendingConfirmation(sessionId: string): void;
}

export class ConversationTimelineRevealService extends Disposable implements IConversationTimelineRevealService {

	declare readonly _serviceBrand: undefined;

	/** Per session key, oldest first. The active lens is the last entry. */
	private readonly lensesBySession = new Map<string, { readonly lens: ConversationLens }[]>();
	private readonly pendingConfirmationScrollScheduled = new Set<string>();
	private readonly pendingConfirmationScrollDeferred = new Set<string>();

	constructor(
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();
	}

	registerLens(sessionKey: string, lens: ConversationLens): { dispose(): void } {
		const entry = { lens };
		const stack = this.lensesBySession.get(sessionKey);
		if (stack) {
			stack.push(entry);
		} else {
			this.lensesBySession.set(sessionKey, [entry]);
		}
		if (this.pendingConfirmationScrollDeferred.delete(sessionKey)) {
			this.scrollToFirstPendingConfirmation(sessionKey);
		}
		let disposed = false;
		return {
			dispose: () => {
				if (disposed) {
					return;
				}
				disposed = true;
				const current = this.lensesBySession.get(sessionKey);
				if (!current) {
					return;
				}
				const index = current.indexOf(entry);
				if (index >= 0) {
					current.splice(index, 1);
				}
				if (current.length === 0) {
					this.lensesBySession.delete(sessionKey);
				}
			},
		};
	}

	revealItem(itemId: string, sessionId: string): void {
		try {
			this.lensFor(sessionId)?.revealTimelineItem(itemId);
		} catch (error) {
			this.notifyFailure(localize('conversationTimelineReveal.revealFailed', "Could not show this item in the conversation."), error);
		}
	}

	getAccessibleTurnContent(sessionId: string): string | undefined {
		try {
			return this.lensFor(sessionId)?.getAccessibleTurnContent();
		} catch (error) {
			this.notifyFailure(localize('conversationTimelineReveal.readTurnFailed', "Could not read this turn for the accessible view."), error);
			return undefined;
		}
	}

	focusAccessibleTurn(sessionId: string): void {
		try {
			this.lensFor(sessionId)?.focusAccessibleTurn();
		} catch (error) {
			this.notifyFailure(localize('conversationTimelineReveal.focusTurnFailed', "Could not focus this turn."), error);
		}
	}

	scrollToFirstPendingConfirmation(sessionId: string): void {
		if (this.pendingConfirmationScrollScheduled.has(sessionId)) {
			return;
		}
		const scheduledLens = this.lensFor(sessionId);
		if (!scheduledLens) {
			this.pendingConfirmationScrollDeferred.add(sessionId);
			return;
		}
		this.pendingConfirmationScrollDeferred.delete(sessionId);
		this.pendingConfirmationScrollScheduled.add(sessionId);
		queueMicrotask(() => {
			this.pendingConfirmationScrollScheduled.delete(sessionId);
			try {
				if (this.lensFor(sessionId) === scheduledLens) {
					scheduledLens.scrollToFirstPendingConfirmation();
				}
			} catch (error) {
				this.notifyFailure(localize('conversationTimelineReveal.scrollFailed', "Could not scroll to the pending confirmation."), error);
			}
		});
	}

	private notifyFailure(message: string, error: unknown): void {
		this.notificationService.notify({ severity: Severity.Error, message, source: getErrorMessage(error) });
	}

	/** Active lens for this key, or nothing. Does not fall through to another column. */
	private lensFor(sessionId: string): ConversationLens | undefined {
		const stack = this.lensesBySession.get(sessionId);
		return stack && stack.length > 0 ? stack[stack.length - 1].lens : undefined;
	}
}

registerSingleton(IConversationTimelineRevealService, ConversationTimelineRevealService, InstantiationType.Delayed);
