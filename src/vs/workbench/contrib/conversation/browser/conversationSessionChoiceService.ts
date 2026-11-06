/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';

export interface ConversationSessionConfigSelection {
	agentIndex: number;
	permissionIndex: number;
}

export interface SessionChoiceEpochWait {
	inFlight: boolean;
	waiters: Array<() => void>;
}

export interface SessionPermissionEpoch extends SessionChoiceEpochWait {
	generation: number;
	targetIndex: number;
	/** Last mode the engine accepted. Not the optimistic index of an in-flight choice. */
	confirmedIndex: number;
}

export interface SessionModelEpoch extends SessionChoiceEpochWait {
	generation: number;
	targetIndex: number;
	targetModelId: string;
	/** Index and id captured when the current target was accepted. */
	rollbackIndex: number;
	rollbackId: string;
	/** Last model the engine accepted. Not the optimistic index of an in-flight choice. */
	confirmedIndex: number;
	confirmedId: string;
}

export const IConversationSessionChoiceService = createDecorator<IConversationSessionChoiceService>('conversationSessionChoiceService');

/**
 * Permission and model choice per session id, shared by every lens bound to
 * that session. One in-flight setPermissionMode / switchModel per session.
 * Cleared when the published engine link changes; epochs from the old link stop
 * being current, so their late results write nothing.
 */
export interface IConversationSessionChoiceService {
	readonly _serviceBrand: undefined;
	/** Fires with the session id after a choice settles. Views repaint their own selects. */
	readonly onDidChangeSessionChoice: Event<string>;
	readonly sessionConfigBySessionId: Map<string, ConversationSessionConfigSelection>;
	/** Session id → model profile id. Not part of {@link ConversationSessionConfigSelection}. */
	readonly modelProfileIdBySessionId: Map<string, string>;
	/** Existing epoch, or a new one starting from `confirmedIndex`. */
	permissionEpoch(sessionId: string, confirmedIndex: number): SessionPermissionEpoch;
	/** Existing epoch, or a new one starting from the caller's accepted index and id. */
	modelEpoch(sessionId: string, confirmedIndex: number, confirmedId: string): SessionModelEpoch;
	isModelChoiceInFlight(sessionId: string): boolean;
	/** False once the link changed after this epoch was handed out. */
	isCurrentPermissionEpoch(sessionId: string, epoch: SessionPermissionEpoch): boolean;
	isCurrentModelEpoch(sessionId: string, epoch: SessionModelEpoch): boolean;
	fireSessionChoiceChanged(sessionId: string): void;
}

export class ConversationSessionChoiceService extends Disposable implements IConversationSessionChoiceService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeSessionChoice = this._register(new Emitter<string>());
	readonly onDidChangeSessionChoice = this._onDidChangeSessionChoice.event;

	readonly sessionConfigBySessionId = new Map<string, ConversationSessionConfigSelection>();
	readonly modelProfileIdBySessionId = new Map<string, string>();
	private readonly permissionEpochs = new Map<string, SessionPermissionEpoch>();
	private readonly modelEpochs = new Map<string, SessionModelEpoch>();
	private linkId: number | undefined;

	constructor(
		@IUniverseAgentConnection uaConnection: IUniverseAgentConnection,
	) {
		super();
		this.linkId = uaConnection.getConnectionSnapshot().linkId;
		this._register(uaConnection.onDidChangeConnection(snapshot => {
			if (snapshot.linkId === this.linkId) {
				return;
			}
			this.linkId = snapshot.linkId;
			const sessionIds = new Set([...this.sessionConfigBySessionId.keys(), ...this.modelProfileIdBySessionId.keys()]);
			this.sessionConfigBySessionId.clear();
			this.modelProfileIdBySessionId.clear();
			this.permissionEpochs.clear();
			this.modelEpochs.clear();
			for (const sessionId of sessionIds) {
				this._onDidChangeSessionChoice.fire(sessionId);
			}
		}));
	}

	permissionEpoch(sessionId: string, confirmedIndex: number): SessionPermissionEpoch {
		let epoch = this.permissionEpochs.get(sessionId);
		if (!epoch) {
			epoch = {
				generation: 0,
				targetIndex: confirmedIndex,
				confirmedIndex,
				inFlight: false,
				waiters: [],
			};
			this.permissionEpochs.set(sessionId, epoch);
		}
		return epoch;
	}

	modelEpoch(sessionId: string, confirmedIndex: number, confirmedId: string): SessionModelEpoch {
		let epoch = this.modelEpochs.get(sessionId);
		if (!epoch) {
			epoch = {
				generation: 0,
				targetIndex: confirmedIndex,
				targetModelId: confirmedId,
				rollbackIndex: confirmedIndex,
				rollbackId: confirmedId,
				confirmedIndex,
				confirmedId,
				inFlight: false,
				waiters: [],
			};
			this.modelEpochs.set(sessionId, epoch);
		}
		return epoch;
	}

	isModelChoiceInFlight(sessionId: string): boolean {
		return this.modelEpochs.get(sessionId)?.inFlight === true;
	}

	isCurrentPermissionEpoch(sessionId: string, epoch: SessionPermissionEpoch): boolean {
		return this.permissionEpochs.get(sessionId) === epoch;
	}

	isCurrentModelEpoch(sessionId: string, epoch: SessionModelEpoch): boolean {
		return this.modelEpochs.get(sessionId) === epoch;
	}

	fireSessionChoiceChanged(sessionId: string): void {
		this._onDidChangeSessionChoice.fire(sessionId);
	}
}
