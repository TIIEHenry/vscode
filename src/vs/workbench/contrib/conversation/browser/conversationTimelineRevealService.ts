/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import type { ConversationLens } from './conversationLens.js';

export const IConversationTimelineRevealService = createDecorator<IConversationTimelineRevealService>('conversationTimelineRevealService');

export interface IConversationTimelineRevealService {
	readonly _serviceBrand: undefined;
	registerLens(lens: ConversationLens): { dispose(): void };
	revealItem(itemId: string): void;
	getAccessibleTurnContent(): string | undefined;
	focusAccessibleTurn(): void;
	scrollToFirstPendingConfirmation(): void;
}

export class ConversationTimelineRevealService extends Disposable implements IConversationTimelineRevealService {

	declare readonly _serviceBrand: undefined;

	private primaryLens: ConversationLens | undefined;
	private pendingConfirmationScrollScheduled = false;

	constructor(
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();
	}

	registerLens(lens: ConversationLens): { dispose(): void } {
		this.primaryLens = lens;
		return {
			dispose: () => {
				if (this.primaryLens === lens) {
					this.primaryLens = undefined;
				}
			},
		};
	}

	revealItem(itemId: string): void {
		try {
			this.primaryLens?.revealTimelineItem(itemId);
		} catch (error) {
			this.notificationService.error(getErrorMessage(error));
		}
	}

	getAccessibleTurnContent(): string | undefined {
		try {
			return this.primaryLens?.getAccessibleTurnContent();
		} catch (error) {
			this.notificationService.error(getErrorMessage(error));
			return undefined;
		}
	}

	focusAccessibleTurn(): void {
		try {
			this.primaryLens?.focusAccessibleTurn();
		} catch (error) {
			this.notificationService.error(getErrorMessage(error));
		}
	}

	scrollToFirstPendingConfirmation(): void {
		if (this.pendingConfirmationScrollScheduled) {
			return;
		}
		this.pendingConfirmationScrollScheduled = true;
		queueMicrotask(() => {
			this.pendingConfirmationScrollScheduled = false;
			try {
				this.primaryLens?.scrollToFirstPendingConfirmation();
			} catch (error) {
				this.notificationService.error(getErrorMessage(error));
			}
		});
	}
}

registerSingleton(IConversationTimelineRevealService, ConversationTimelineRevealService, InstantiationType.Delayed);
