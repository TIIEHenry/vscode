/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { ConversationChatInput, getDefaultConversationChatResource } from '../../../conversation/common/conversationChatInput.js';

/**
 * One session leaf: default chat root plus a side group `findGroup` returns.
 * Conversation open must land on that side group, not `IEditorService.openEditor`.
 */
export function createSourcesConversationOpenHarness(store: Pick<DisposableStore, 'add'>, options: {
	readonly sessionId?: string;
	readonly openEditor: (input: EditorInput) => Promise<unknown>;
}): {
	readonly editorGroupsService: IEditorGroupsService;
	readonly session: IAgentSessionContext;
	readonly opened: EditorInput[];
} {
	const sessionId = options.sessionId ?? 'session-1';
	const chat = store.add(new ConversationChatInput(getDefaultConversationChatResource(sessionId)));
	const opened: EditorInput[] = [];
	const chatGroup = {
		id: 1,
		editors: [chat],
		openEditor: async () => {
			throw new Error('chat root must not receive the diff');
		},
	};
	const sideGroup = {
		id: 2,
		editors: opened,
		openEditor: async (input: EditorInput) => {
			opened.push(input);
			return options.openEditor(input);
		},
	};
	const part = {
		sessionKey: sessionId,
		groups: [chatGroup, sideGroup],
		findGroup: () => sideGroup,
		isGroupHidden: () => false,
		setGroupHidden: () => { },
		addGroup: () => {
			throw new Error('side group must be reused');
		},
	};
	return {
		opened,
		session: {
			getActiveSessionId: () => sessionId,
		} as IAgentSessionContext,
		editorGroupsService: {
			conversationParts: [part],
		} as unknown as IEditorGroupsService,
	};
}
