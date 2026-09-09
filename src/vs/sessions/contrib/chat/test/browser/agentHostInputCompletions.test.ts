/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock, upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { OffsetRange } from '../../../../../editor/common/core/ranges/offsetRange.js';
import { createTextModel } from '../../../../../editor/test/common/testTextModel.js';
import { withTestCodeEditor } from '../../../../../editor/test/browser/testCodeEditor.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IChatRequestVariableEntry, toAgentHostCompletionVariableEntry, AgentHostCompletionReferenceKind } from '../../../../../workbench/contrib/chat/common/attachments/chatVariableEntries.js';
import { IChatSessionsService } from '../../../../../workbench/contrib/chat/common/chatSessionsService.js';
import { IActiveSession } from '../../../../services/sessions/common/sessionsManagement.js';
import { ISessionContext } from '../../../../services/sessions/browser/sessionContext.js';
import { AgentHostInputCompletionHandler, getAgentHostCompletionAttachmentRange, getCommandArgumentHintPlaceholder } from '../../browser/agentHostInputCompletions.js';
import { INewChatAttachments } from '../../browser/newChatContextAttachments.js';

suite('AgentHostInputCompletions', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('uses the accepted occurrence when duplicate slash tokens exist', () => {
		const text = 'first /rename then accepted /rename';
		const acceptedStart = text.lastIndexOf('/rename');

		assert.deepStrictEqual(
			getAgentHostCompletionAttachmentRange(
				text,
				'/rename',
				new OffsetRange(acceptedStart, acceptedStart + '/rename'.length),
				0,
				text.length
			),
			new OffsetRange(acceptedStart, acceptedStart + '/rename'.length)
		);
	});

	test('does not resolve a numbered reference inside a higher-numbered sibling', () => {
		const text = 'see #attachment:Pasted text #10 here';

		assert.deepStrictEqual({
			prefixOfSibling: getAgentHostCompletionAttachmentRange(text, '#attachment:Pasted text #1', undefined, 0, text.length),
			exactSibling: getAgentHostCompletionAttachmentRange(text, '#attachment:Pasted text #10', undefined, 0, text.length),
		}, {
			prefixOfSibling: undefined,
			exactSibling: new OffsetRange(4, 31),
		});
	});

	test('converts accepted occurrence ranges to trimmed message offsets', () => {
		const rawText = '  /rename  ';
		const messageText = rawText.trim();
		const messageOffset = rawText.length - rawText.trimStart().length;

		assert.deepStrictEqual(
			getAgentHostCompletionAttachmentRange(
				rawText,
				'/rename',
				new OffsetRange(2, 9),
				messageOffset,
				messageText.length
			),
			new OffsetRange(0, '/rename'.length)
		);
	});

	suite('getCommandArgumentHintPlaceholder', () => {
		function commandEntry(argumentHint: string | undefined): IChatRequestVariableEntry {
			return toAgentHostCompletionVariableEntry(AgentHostCompletionReferenceKind.Command, '/plan', 'plan', { command: 'plan', ...(argumentHint !== undefined ? { argumentHint } : {}) });
		}

		test('returns the hint and end offset when the command is the sole content with a trailing space', () => {
			const entry = commandEntry('task');
			const references = new Map([[entry.id, { text: '/plan', range: new OffsetRange(0, 5) }]]);
			assert.deepStrictEqual(
				getCommandArgumentHintPlaceholder('/plan ', [entry], references),
				{ argumentHint: 'task', endOffset: 5 }
			);
		});

		test('returns undefined without a hint, once an argument is typed, or with leading text', () => {
			const withHint = commandEntry('task');
			const withoutHint = commandEntry(undefined);
			const refs = (entry: IChatRequestVariableEntry, start: number) => new Map([[entry.id, { text: '/plan', range: new OffsetRange(start, start + 5) }]]);

			assert.strictEqual(getCommandArgumentHintPlaceholder('/plan ', [withoutHint], refs(withoutHint, 0)), undefined);
			assert.strictEqual(getCommandArgumentHintPlaceholder('/plan task', [withHint], refs(withHint, 0)), undefined);
			assert.strictEqual(getCommandArgumentHintPlaceholder('hi /plan ', [withHint], refs(withHint, 3)), undefined);
			assert.strictEqual(getCommandArgumentHintPlaceholder('/plan ', [withHint], new Map()), undefined);
		});
	});

	test('does not leak unhandled rejection when getChatInputCompletionTriggerCharacters rejects', async () => {
		const session = observableValue<IActiveSession | undefined>('session', upcastPartial<IActiveSession>({
			resource: URI.from({ scheme: 'agent-host-copilot', path: '/reject-triggers' }),
		}));
		const services = new ServiceCollection(
			[ISessionContext, { _serviceBrand: undefined, session }],
			[IChatSessionsService, new class extends mock<IChatSessionsService>() {
				override getChatInputCompletionTriggerCharacters(): Promise<readonly string[] | undefined> {
					return Promise.reject(new Error('boom'));
				}
			}],
		);
		const attachments: INewChatAttachments = {
			onDidChangeContext: Event.None,
			attachments: [],
			setAttachments() { },
			addAttachments() { },
			removeAttachment() { },
		};
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(() => { });
		try {
			const model = store.add(createTextModel(''));
			await withTestCodeEditor(model, { serviceCollection: services }, async (editor, _viewModel, instantiationService) => {
				const local = new DisposableStore();
				try {
					local.add(instantiationService.createInstance(AgentHostInputCompletionHandler, editor, attachments));
					await timeout(0);
				} finally {
					local.dispose();
				}
			});
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});
});
