/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import type { ConversationLens } from './conversationLens.js';

export const IConversationTimelineRevealService = createDecorator<IConversationTimelineRevealService>('conversationTimelineRevealService');

export interface IConversationTimelineRevealService {
	readonly _serviceBrand: undefined;
	registerLens(lens: ConversationLens): { dispose(): void };
	revealItem(itemId: string): void;
}

export class ConversationTimelineRevealService extends Disposable implements IConversationTimelineRevealService {

	declare readonly _serviceBrand: undefined;

	private primaryLens: ConversationLens | undefined;

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
		this.primaryLens?.revealTimelineItem(itemId);
	}
}

registerSingleton(IConversationTimelineRevealService, ConversationTimelineRevealService, InstantiationType.Delayed);
