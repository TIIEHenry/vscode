/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { URI } from '../../../../../../base/common/uri.js';
import { mock } from '../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { AgentSession } from '../../../../../../platform/agentHost/common/agent.js';
import { ICloudSandboxApiService } from '../../../../../../platform/agentHost/common/cloudSandboxAgentHost.js';
import type { IReplayedSession, IReplayedTaskHistory } from '../../../../../../platform/agentHost/common/taskEventReplay.js';
import { MessageKind, ResponsePartKind, ToolCallConfirmationReason, ToolCallStatus, ToolResultContentType, type ActiveTurn, type ChatState, type ToolCallState } from '../../../../../../platform/agentHost/common/state/sessionState.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../../../../platform/log/common/log.js';
import type { IChatProgress } from '../../../../../../workbench/contrib/chat/common/chatService/chatService.js';
import { isToolResultInputOutputDetails } from '../../../../../../workbench/contrib/chat/common/tools/languageModelToolsService.js';
import { CloudSandboxReadOnlySessionHandler } from '../../browser/cloudSandboxReadOnlySessionHandler.js';

suite('CloudSandboxReadOnlySessionHandler', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('a dead sandbox shows tool results and file edits from the turn that was still running', async () => {
		const sessionResource = AgentSession.uri('copilotcli', 'sess-1');
		const replayed = replayedHistory(activeTurn());
		const instantiationService = store.add(new TestInstantiationService());
		instantiationService.stub(ICloudSandboxApiService, new class extends mock<ICloudSandboxApiService>() {
			override getSessionHistory(): Promise<IReplayedTaskHistory> {
				return Promise.resolve(replayed);
			}
		}());
		instantiationService.stub(ILogService, new NullLogService());
		const handler = store.add(instantiationService.createInstance(CloudSandboxReadOnlySessionHandler, {
			taskId: 'task-1',
			agentId: 'copilotcli',
			connectionAuthority: 'sandbox-host',
			prefetchedHistory: Promise.resolve(replayed),
		}));

		const session = await handler.provideChatSessionContent(sessionResource, CancellationToken.None);
		store.add(session);

		const activeResponse = session.history.find((item, index) => {
			const previous = session.history[index - 1];
			return item.type === 'response' && previous?.type === 'request' && previous.prompt === 'keep going';
		});
		assert.ok(activeResponse && activeResponse.type === 'response');
		const parts = activeResponse.parts;

		assert.deepStrictEqual({
			liveInvocations: parts.filter(part => part.kind === 'toolInvocation').length,
			editedFiles: parts.flatMap(part => part.kind === 'externalEdit' ? [fileName(part.uri.path)] : []),
			settledResults: parts.flatMap(part => part.kind === 'toolInvocationSerialized' ? [{
				id: part.toolCallId,
				complete: part.isComplete,
				output: embeddedOutput(part),
			}] : []),
			earlier: session.history.some(item => item.type === 'response' && item.parts.some(part => part.kind === 'markdownContent' && part.content.value === 'earlier reply')),
		}, {
			liveInvocations: 0,
			editedFiles: ['notes.md', 'extra.md'],
			settledResults: [
				{ id: 'edit-done', complete: true, output: [] },
				{ id: 'awaiting-accept', complete: true, output: ['landed the patch'] },
				{ id: 'awaiting-edit', complete: true, output: [] },
				{ id: 'still-running', complete: true, output: ['partial stdout'] },
			],
			earlier: true,
		});
	});
});

function fileName(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash >= 0 ? path.slice(slash + 1) : path;
}

function embeddedOutput(part: IChatProgress & { kind: 'toolInvocationSerialized' }): string[] {
	const details = part.resultDetails;
	if (!isToolResultInputOutputDetails(details)) {
		return [];
	}
	return details.output.flatMap(entry => entry.type === 'embed' && entry.isText ? [entry.value] : []);
}

function replayedHistory(active: ActiveTurn): IReplayedTaskHistory {
	const chatUri = 'ahp-session:/sess-1/chat';
	const chat = {
		resource: chatUri,
		title: 'Sandbox',
		modifiedAt: '2026-01-01T00:00:00.000Z',
		turns: [{
			id: 'turn-done',
			message: { text: 'hello', origin: { kind: MessageKind.User } },
			responseParts: [{ kind: ResponsePartKind.Markdown, id: 'md-1', content: 'earlier reply' }],
			usage: undefined,
			state: 'complete',
		}],
		activeTurn: active,
	} as unknown as ChatState;
	const replayedSession: IReplayedSession = {
		session: 'ahp-session:/sess-1',
		state: { title: 'Sandbox' } as IReplayedSession['state'],
		chats: new Map([[chatUri, chat]]),
		defaultChat: chatUri,
		modifiedAt: '2026-01-01T00:00:00.000Z',
	};
	return { sessions: [replayedSession], truncated: false };
}

function activeTurn(): ActiveTurn {
	return {
		id: 'turn-open',
		startedAt: '2026-01-01T00:00:01.000Z',
		message: { text: 'keep going', origin: { kind: MessageKind.User } },
		usage: undefined,
		responseParts: [
			{ kind: ResponsePartKind.ToolCall, toolCall: completedEdit('edit-done', '/home/user/notes.md') },
			{ kind: ResponsePartKind.ToolCall, toolCall: pendingResultText('awaiting-accept', 'landed the patch') },
			{ kind: ResponsePartKind.ToolCall, toolCall: pendingResultEdit('awaiting-edit', '/home/user/extra.md') },
			{ kind: ResponsePartKind.ToolCall, toolCall: runningWithText('still-running', 'partial stdout') },
		],
	};
}

function completedEdit(toolCallId: string, path: string): ToolCallState {
	return {
		toolCallId,
		toolName: 'edit_file',
		displayName: 'Edit File',
		invocationMessage: 'Editing file',
		status: ToolCallStatus.Completed,
		confirmed: ToolCallConfirmationReason.NotNeeded,
		success: true,
		pastTenseMessage: 'Edited file',
		toolInput: JSON.stringify({ path }),
		content: [{
			type: ToolResultContentType.FileEdit,
			after: {
				uri: URI.file(path).toString(),
				content: { uri: 'agenthost-content:///snap/after' },
			},
		}],
	};
}

function pendingResultText(toolCallId: string, text: string): ToolCallState {
	return {
		toolCallId,
		toolName: 'apply_patch',
		displayName: 'Apply Patch',
		invocationMessage: 'Applying patch',
		status: ToolCallStatus.PendingResultConfirmation,
		confirmed: ToolCallConfirmationReason.NotNeeded,
		success: true,
		pastTenseMessage: 'Applied patch',
		toolInput: JSON.stringify({ summary: text }),
		content: [{ type: ToolResultContentType.Text, text }],
	};
}

function pendingResultEdit(toolCallId: string, path: string): ToolCallState {
	return {
		toolCallId,
		toolName: 'edit_file',
		displayName: 'Edit File',
		invocationMessage: 'Editing extra file',
		status: ToolCallStatus.PendingResultConfirmation,
		confirmed: ToolCallConfirmationReason.NotNeeded,
		success: true,
		pastTenseMessage: 'Edited extra file',
		toolInput: JSON.stringify({ path }),
		content: [{
			type: ToolResultContentType.FileEdit,
			after: {
				uri: URI.file(path).toString(),
				content: { uri: 'agenthost-content:///snap/extra' },
			},
		}],
	};
}

function runningWithText(toolCallId: string, text: string): ToolCallState {
	return {
		toolCallId,
		toolName: 'bash',
		displayName: 'Bash',
		invocationMessage: 'Running command',
		status: ToolCallStatus.Running,
		confirmed: ToolCallConfirmationReason.NotNeeded,
		toolInput: JSON.stringify({ command: 'echo' }),
		content: [{ type: ToolResultContentType.Text, text }],
	};
}
