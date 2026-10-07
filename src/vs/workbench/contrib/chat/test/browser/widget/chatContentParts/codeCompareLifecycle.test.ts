/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationTokenSource } from '../../../../../../../base/common/cancellation.js';
import { Event } from '../../../../../../../base/common/event.js';
import { MutableDisposable } from '../../../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { MockContextKeyService } from '../../../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { CodeCompareModelService } from '../../../../browser/widget/chatContentParts/chatTextEditContentPart.js';
import { CodeCompareBlockPart, ICodeCompareBlockData } from '../../../../browser/widget/chatContentParts/codeBlockPart.js';
import { IChatResponseViewModel } from '../../../../common/model/chatViewModel.js';
import { IChatService } from '../../../../common/chatService/chatService.js';
import { IChatTextEditGroup } from '../../../../common/model/chatModel.js';
import { IModelService } from '../../../../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../../../../editor/common/services/resolverService.js';

suite('CodeCompare Lifecycle', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	suite('CodeCompareModelService', () => {
		test('disposes acquired original reference and temp model if chat session not found', async () => {
			let originalDisposed = false;
			let tempModelDisposed = false;

			const mockOriginalModel = {
				createSnapshot: () => ({ read: () => null }),
				getLanguageId: () => 'typescript',
			};

			const mockOriginalRef = {
				object: {
					textEditorModel: mockOriginalModel,
				},
				dispose: () => {
					originalDisposed = true;
				}
			};

			const mockTempModel = {
				uri: URI.parse('vscode-chat-code-block:/temp.ts'),
				isDisposed: () => tempModelDisposed,
				dispose: () => {
					tempModelDisposed = true;
				}
			};

			const mockModifiedRef = {
				object: {
					textEditorModel: {
						pushEditOperations: () => null,
					}
				},
				dispose: () => {
					mockTempModel.dispose();
				}
			};

			const textModelService = {
				createModelReference: async (uri: URI) => {
					if (uri.scheme === 'vscode-chat-code-block') {
						return mockModifiedRef;
					}
					return mockOriginalRef;
				}
			} as unknown as ITextModelService;

			const modelService = {
				createModel: () => mockTempModel,
			} as unknown as IModelService;

			const chatService = {
				getSession: () => undefined,
			} as unknown as IChatService;

			const service = new CodeCompareModelService(textModelService, modelService, chatService);

			const element = {
				sessionResource: URI.parse('chat-session:/1'),
				model: {},
			} as unknown as IChatResponseViewModel;

			const chatTextEdit: IChatTextEditGroup = {
				kind: 'textEditGroup',
				uri: URI.parse('file:///test.ts'),
				edits: [],
				done: true,
			};

			await assert.rejects(
				() => service.createModel(element, chatTextEdit),
				/Chat session not found/
			);

			assert.strictEqual(originalDisposed, true, 'Original model reference should be disposed on failure');
			assert.strictEqual(tempModelDisposed, true, 'Temporary model should be disposed on failure');
		});

		test('disposes acquired original reference and temp model if modified reference creation fails', async () => {
			let originalDisposed = false;
			let tempModelDisposed = false;

			const mockOriginalModel = {
				createSnapshot: () => ({ read: () => null }),
				getLanguageId: () => 'typescript',
			};

			const mockOriginalRef = {
				object: {
					textEditorModel: mockOriginalModel,
				},
				dispose: () => {
					originalDisposed = true;
				}
			};

			const mockTempModel = {
				uri: URI.parse('vscode-chat-code-block:/temp.ts'),
				isDisposed: () => tempModelDisposed,
				dispose: () => {
					tempModelDisposed = true;
				}
			};

			const textModelService = {
				createModelReference: async (uri: URI) => {
					if (uri.scheme === 'vscode-chat-code-block') {
						throw new Error('Failed to resolve modified model');
					}
					return mockOriginalRef;
				}
			} as unknown as ITextModelService;

			const modelService = {
				createModel: () => mockTempModel,
			} as unknown as IModelService;

			const chatService = {
				getSession: () => ({ getRequests: () => [] }),
			} as unknown as IChatService;

			const service = new CodeCompareModelService(textModelService, modelService, chatService);

			const element = {
				sessionResource: URI.parse('chat-session:/1'),
				model: {},
			} as unknown as IChatResponseViewModel;

			const chatTextEdit: IChatTextEditGroup = {
				kind: 'textEditGroup',
				uri: URI.parse('file:///test.ts'),
				edits: [],
				done: true,
			};

			await assert.rejects(
				() => service.createModel(element, chatTextEdit),
				/Failed to resolve modified model/
			);

			assert.strictEqual(originalDisposed, true, 'Original model reference should be disposed');
			assert.strictEqual(tempModelDisposed, true, 'Temporary model should be disposed');
		});
	});

	suite('CodeCompareBlockPart', () => {
		test('disposes viewModel when cancellation is requested after waitForDiff', async () => {
			let viewModelDisposed = false;
			const cts = store.add(new CancellationTokenSource());

			const mockViewModel = {
				waitForDiff: async () => {
					// cancel token during diff wait
					cts.cancel();
				},
				dispose: () => {
					viewModelDisposed = true;
				}
			};

			const part = Object.create(CodeCompareBlockPart.prototype);
			part.contextKeyService = new MockContextKeyService();
			part.element = document.createElement('div');
			part.messageElement = document.createElement('div');
			part._lastDiffEditorViewModel = store.add(new MutableDisposable());
			part.diffEditor = {
				createViewModel: () => mockViewModel,
				setModel: () => { },
			};
			part.toolbar = { context: undefined };

			const data: ICodeCompareBlockData = {
				element: { setVote: () => { } } as unknown as IChatResponseViewModel,
				edit: { kind: 'textEditGroup', uri: URI.parse('file:///test.ts'), edits: [], done: true },
				diffData: Promise.resolve({
					original: { onWillDispose: Event.None },
					modified: { onWillDispose: Event.None },
				}) as any,
			};

			await (part as any).updateEditor(data, cts.token);

			assert.strictEqual(viewModelDisposed, true, 'viewModel must be disposed when cancellation is requested');
		});

		test('disposes viewModel when waitForDiff throws an exception', async () => {
			let viewModelDisposed = false;
			const cts = store.add(new CancellationTokenSource());

			const mockViewModel = {
				waitForDiff: async () => {
					throw new Error('waitForDiff error');
				},
				dispose: () => {
					viewModelDisposed = true;
				}
			};

			const part = Object.create(CodeCompareBlockPart.prototype);
			part.contextKeyService = new MockContextKeyService();
			part.element = document.createElement('div');
			part.messageElement = document.createElement('div');
			part._lastDiffEditorViewModel = store.add(new MutableDisposable());
			part.diffEditor = {
				createViewModel: () => mockViewModel,
				setModel: () => { },
			};
			part.toolbar = { context: undefined };

			const data: ICodeCompareBlockData = {
				element: { setVote: () => { } } as unknown as IChatResponseViewModel,
				edit: { kind: 'textEditGroup', uri: URI.parse('file:///test.ts'), edits: [], done: true },
				diffData: Promise.resolve({
					original: { onWillDispose: Event.None },
					modified: { onWillDispose: Event.None },
				}) as any,
			};

			await assert.rejects(
				() => (part as any).updateEditor(data, cts.token),
				/waitForDiff error/
			);

			assert.strictEqual(viewModelDisposed, true, 'viewModel must be disposed when waitForDiff fails');
		});
	});
});
