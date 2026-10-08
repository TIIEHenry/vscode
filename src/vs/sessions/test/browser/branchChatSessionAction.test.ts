/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../base/common/uri.js';
import { upcastPartial } from '../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { ServicesAccessor } from '../../../platform/instantiation/common/instantiation.js';
import { TestInstantiationService } from '../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { BranchChatSessionAction, ACTION_ID_BRANCH_CHAT_SESSION } from '../../contrib/chat/browser/branchChatSessionAction.js';
import { ChatViewPaneTarget, IChatWidgetService } from '../../../workbench/contrib/chat/browser/chat.js';
import { IChatModelReference, IChatService } from '../../../workbench/contrib/chat/common/chatService/chatService.js';
import { IChatModel, ISerializableChatData } from '../../../workbench/contrib/chat/common/model/chatModel.js';
import { IChatRequestViewModel } from '../../../workbench/contrib/chat/common/model/chatViewModel.js';
import { IParsedChatRequest } from '../../../workbench/contrib/chat/common/requestParser/chatParserTypes.js';

suite('Sessions - BranchChatSessionAction', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('action has correct ID and registers properly', () => {
		const action = new BranchChatSessionAction();
		assert.strictEqual(action.desc.id, ACTION_ID_BRANCH_CHAT_SESSION);
		assert.strictEqual(BranchChatSessionAction.ID, ACTION_ID_BRANCH_CHAT_SESSION);
	});

	test('ignores non-checkpoint items gracefully', async () => {
		const instantiationService = disposables.add(new TestInstantiationService());
		const action = new BranchChatSessionAction();
		let loadCalled = false;
		instantiationService.stub(IChatService, upcastPartial<IChatService>({
			loadSessionFromData: () => {
				loadCalled = true;
				return undefined as unknown as IChatModelReference;
			}
		}));
		instantiationService.stub(IChatWidgetService, upcastPartial<IChatWidgetService>({}));

		await instantiationService.invokeFunction((accessor: ServicesAccessor) => action.run(accessor, undefined));
		await instantiationService.invokeFunction((accessor: ServicesAccessor) => action.run(accessor, { notAViewModel: true }));
		assert.strictEqual(loadCalled, false);
	});

	test('branches session up to checkpoint and opens new session in chat view pane', async () => {
		const instantiationService = disposables.add(new TestInstantiationService());
		const sourceSessionUri = URI.parse('test-chat://source-session');
		const forkedSessionUri = URI.parse('test-chat://forked-session');

		const serializedData: ISerializableChatData = {
			version: 3,
			sessionId: 'source-session',
			creationDate: 0,
			customTitle: 'Custom Title',
			initialLocation: undefined,
			responderUsername: 'test',
			requests: [
				{ requestId: 'req-1', message: 'First', variableData: { variables: [] }, response: [] },
				{ requestId: 'req-2', message: 'Second', variableData: { variables: [] }, response: [] },
				{ requestId: 'req-3', message: 'Third', variableData: { variables: [] }, response: [] },
			],
		};

		const mockModel = upcastPartial<IChatModel>({
			toJSON: () => serializedData,
		});

		let openedResource: URI | undefined;
		let openedTarget: any;
		let openedOptions: any;

		instantiationService.stub(IChatWidgetService, upcastPartial<IChatWidgetService>({
			getWidgetBySessionResource: (uri: URI) => {
				if (uri.toString() === sourceSessionUri.toString()) {
					return {
						viewModel: {
							model: mockModel,
						}
					} as any;
				}
				return undefined;
			},
			openSession: async (resource: URI, target: any, options: any) => {
				openedResource = resource;
				openedTarget = target;
				openedOptions = options;
				return undefined;
			}
		}));

		let modelDisposed = false;
		let loadedOwner: string | undefined;
		let loadedReason: string | undefined;
		let passedData: ISerializableChatData | undefined;

		const modelRef = upcastPartial<IChatModelReference>({
			object: upcastPartial<IChatModel>({
				sessionResource: forkedSessionUri,
			}),
			dispose: () => { modelDisposed = true; }
		});

		instantiationService.stub(IChatService, upcastPartial<IChatService>({
			loadSessionFromData: (data: any, owner?: string, reason?: string) => {
				passedData = data;
				loadedOwner = owner;
				loadedReason = reason;
				return modelRef;
			}
		}));

		const action = new BranchChatSessionAction();
		const checkpointItem = upcastPartial<IChatRequestViewModel>({
			sessionResource: sourceSessionUri,
			id: 'req-3',
			message: upcastPartial<IParsedChatRequest>({ text: 'Third', parts: [] }),
		});

		await instantiationService.invokeFunction((accessor: ServicesAccessor) => action.run(accessor, checkpointItem));

		assert.strictEqual(loadedOwner, 'BranchChatSessionAction');
		assert.strictEqual(loadedReason, 'currentSession');
		assert.strictEqual(modelDisposed, true);
		assert.strictEqual(openedResource?.toString(), forkedSessionUri.toString());
		assert.strictEqual(openedTarget, ChatViewPaneTarget);
		assert.deepStrictEqual(openedOptions, { sessionTypeSelectionReason: 'currentSession' });

		assert.ok(passedData);
		assert.strictEqual(passedData!.requests.length, 2);
		assert.strictEqual(passedData!.requests[0].requestId, 'req-1');
		assert.strictEqual(passedData!.requests[1].requestId, 'req-2');
		assert.strictEqual(passedData!.customTitle, undefined);
		assert.notStrictEqual(passedData!.sessionId, 'source-session');
	});
});
