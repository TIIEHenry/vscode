/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IDisposable } from '../../../../../base/common/lifecycle.js';
import { ConversationComposerModel, type ComposerPolicy } from '../../browser/conversationComposerModel.js';

export interface ITestComposerModelState {
	readonly policy?: ComposerPolicy;
	readonly editingTurnId?: string;
	readonly editingQueueItemId?: string;
	readonly composeDraftSnapshot?: string;
	readonly queueEditSettlementItemId?: string;
}

/** Composer model seeded through its public methods, registered on `store`. */
export function createTestComposerModel(store: { add<T extends IDisposable>(disposable: T): T }, state: ITestComposerModelState = {}): ConversationComposerModel {
	const model = store.add(new ConversationComposerModel());
	const snapshot = state.composeDraftSnapshot ?? '';
	if (state.policy === 'turnEdit') {
		model.beginTurnEdit(state.editingTurnId ?? '', snapshot);
	} else if (state.policy === 'queueEdit') {
		model.beginQueueEdit(state.editingQueueItemId ?? '', snapshot);
	} else if (snapshot) {
		model.beginTurnEdit('', snapshot);
		model.exitEdit();
	}
	if (state.queueEditSettlementItemId !== undefined) {
		model.setQueueEditSettlementItemId(state.queueEditSettlementItemId);
	}
	return model;
}
