/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import type { IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { createInputHistoryBrowseState, type InputHistoryBrowseState } from './conversationInputHistory.js';

export type ComposerPolicy = 'compose' | 'turnEdit' | 'queueEdit';

/**
 * Edit state of one lens's composer. Each lens owns its own model; session
 * permission / model choices are not here.
 */
export class ConversationComposerModel extends Disposable {

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	private _policy: ComposerPolicy = 'compose';
	private _editingTurnId: string | undefined;
	private _editingQueueItemId: string | undefined;
	private _queueEditSettlementItemId: string | undefined;
	private _composeDraftSnapshot = '';
	private _inputHistoryBrowse: InputHistoryBrowseState = createInputHistoryBrowseState();
	private _tuneContextView: IOpenContextView | undefined;
	private _moreContextView: IOpenContextView | undefined;
	private _postFailureVisible = false;
	private _sendFailureTimeout: ReturnType<typeof setTimeout> | undefined;

	get policy(): ComposerPolicy { return this._policy; }
	get editingTurnId(): string | undefined { return this._editingTurnId; }
	get editingQueueItemId(): string | undefined { return this._editingQueueItemId; }
	/** Item whose Hold, Edit, or Release is still waiting for an explicit engine answer. */
	get queueEditSettlementItemId(): string | undefined { return this._queueEditSettlementItemId; }
	get composeDraftSnapshot(): string { return this._composeDraftSnapshot; }
	get inputHistoryBrowse(): InputHistoryBrowseState { return this._inputHistoryBrowse; }
	get tuneContextView(): IOpenContextView | undefined { return this._tuneContextView; }
	get moreContextView(): IOpenContextView | undefined { return this._moreContextView; }
	get postFailureVisible(): boolean { return this._postFailureVisible; }
	get sendFailureTimeout(): ReturnType<typeof setTimeout> | undefined { return this._sendFailureTimeout; }

	beginTurnEdit(turnId: string, composeDraftSnapshot: string): void {
		this._composeDraftSnapshot = composeDraftSnapshot;
		this._policy = 'turnEdit';
		this._editingTurnId = turnId;
		this._editingQueueItemId = undefined;
		this._onDidChange.fire();
	}

	beginQueueEdit(itemId: string, composeDraftSnapshot: string): void {
		this._composeDraftSnapshot = composeDraftSnapshot;
		this._policy = 'queueEdit';
		this._editingQueueItemId = itemId;
		this._editingTurnId = undefined;
		this._onDidChange.fire();
	}

	/** Back to compose. The draft snapshot stays until {@link clearComposeDraftSnapshot}. */
	exitEdit(): void {
		this._policy = 'compose';
		this._editingTurnId = undefined;
		this._editingQueueItemId = undefined;
		this._onDidChange.fire();
	}

	clearComposeDraftSnapshot(): void {
		this._composeDraftSnapshot = '';
		this._onDidChange.fire();
	}

	setQueueEditSettlementItemId(itemId: string | undefined): void {
		this._queueEditSettlementItemId = itemId;
		this._onDidChange.fire();
	}

	resetInputHistoryBrowse(): void {
		this._inputHistoryBrowse = createInputHistoryBrowseState();
		this._onDidChange.fire();
	}

	setInputHistoryBrowse(state: InputHistoryBrowseState): void {
		this._inputHistoryBrowse = state;
		this._onDidChange.fire();
	}

	setTuneContextView(view: IOpenContextView | undefined): void {
		this._tuneContextView = view;
		this._onDidChange.fire();
	}

	setMoreContextView(view: IOpenContextView | undefined): void {
		this._moreContextView = view;
		this._onDidChange.fire();
	}

	showPostFailure(): void {
		this._postFailureVisible = true;
		if (this._sendFailureTimeout) {
			clearTimeout(this._sendFailureTimeout);
			this._sendFailureTimeout = undefined;
		}
		this._onDidChange.fire();
	}
}
