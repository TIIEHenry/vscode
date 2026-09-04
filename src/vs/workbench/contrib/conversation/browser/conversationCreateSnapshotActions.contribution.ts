/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { localize, localize2 } from '../../../../nls.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { isDefaultCodeWindow } from '../../chat/browser/chatShellRouting.js';
import { IConversationRosterService } from './conversationStubService.js';

export const CONVERSATION_CREATE_SNAPSHOT_COMMAND_ID = 'workbench.action.conversation.createSnapshot';

export const CONVERSATION_CREATE_SNAPSHOT_DEFAULT_TITLE = localize('conversationCreateSnapshotDefaultTitle', "Snapshot");

export interface ConversationCreateSnapshotArgs {
	readonly title?: string;
	readonly description?: string;
}

/**
 * Honest gate for the Conversation Create Snapshot action.
 * Disconnected / no hook / empty sessionId → do not send.
 */
export function canCreateEngineSnapshot(
	connected: boolean,
	hasCreateSnapshot: boolean,
	sessionId: string | undefined,
): boolean {
	return connected && hasCreateSnapshot && !!sessionId?.trim();
}

/**
 * Omitted title uses the default. Cleared / empty title is kept as-is
 * (match transport). Callers must not invoke this for a cancelled prompt.
 */
export function resolveCreateSnapshotTitle(input: string | undefined): string {
	return input !== undefined ? input : CONVERSATION_CREATE_SNAPSHOT_DEFAULT_TITLE;
}

/**
 * Connected user Create Snapshot → AgentService.CreateSnapshot for the
 * active session. Does not list, restore, or delete snapshots, and does
 * not replace SessionBar History. Disconnected / no hook / empty
 * sessionId / cancelled prompt no-op.
 */
registerAction2(class ConversationCreateSnapshotAction extends Action2 {

	constructor() {
		super({
			id: CONVERSATION_CREATE_SNAPSHOT_COMMAND_ID,
			title: localize2('conversationCreateSnapshot', 'Create Conversation Snapshot'),
			category: localize2('conversation', 'Conversation'),
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor, args?: ConversationCreateSnapshotArgs): Promise<void> {
		if (!isDefaultCodeWindow(accessor)) {
			return;
		}
		const roster = accessor.get(IConversationRosterService);
		const connection = accessor.get(IUniverseAgentConnection);
		const sessionId = roster.getActiveSessionId();
		if (!canCreateEngineSnapshot(roster.isEngineConnected(), !!connection.createSnapshot, sessionId)) {
			return;
		}
		let title = args?.title;
		if (title === undefined) {
			const next = await accessor.get(IQuickInputService).input({
				title: localize('conversationCreateSnapshotPromptTitle', "Create snapshot"),
				prompt: localize('conversationCreateSnapshotPrompt', "Snapshot title"),
				value: CONVERSATION_CREATE_SNAPSHOT_DEFAULT_TITLE,
			});
			if (next === undefined) {
				return;
			}
			title = resolveCreateSnapshotTitle(next);
		}
		roster.createSnapshot(sessionId, {
			title,
			...(args?.description !== undefined ? { description: args.description } : {}),
		});
	}
});
