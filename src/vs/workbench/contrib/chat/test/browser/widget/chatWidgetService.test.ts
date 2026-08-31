/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { ILogService, NullLogService } from '../../../../../../platform/log/common/log.js';
import { ILayoutService } from '../../../../../../platform/layout/browser/layoutService.js';
import { IViewsService } from '../../../../../services/views/common/viewsService.js';
import { IWorkbenchEnvironmentService } from '../../../../../services/environment/common/environmentService.js';
import { workbenchInstantiationService, TestEditorService, TestEditorGroupsService, TestViewsService } from '../../../../../test/browser/workbenchTestServices.js';
import { ChatViewId, IQuickChatService } from '../../../browser/chat.js';
import { IChatService } from '../../../common/chatService/chatService.js';
import { LocalChatSessionUri } from '../../../common/model/chatUri.js';
import { canOpenChatViewOrEditor, ChatWidgetService } from '../../../browser/widget/chatWidgetService.js';
import { ACTIVE_GROUP } from '../../../../../services/editor/common/editorService.js';

suite('ChatWidgetService - default window gating (INV-NO-COPILOT)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(isSessionsWindow: boolean): {
		service: ChatWidgetService;
		viewsService: TestViewsService & { openViewCalls: string[] };
		editorService: TestEditorService & { openEditorCalls: number };
	} {
		const openViewCalls: string[] = [];
		const viewsService = store.add(new class extends TestViewsService {
			override openView<T>(id: string): Promise<T | null> {
				openViewCalls.push(id);
				return Promise.resolve(null);
			}
		}());

		const editorService = store.add(new class extends TestEditorService {
			openEditorCalls = 0;
			override openEditor(): Promise<undefined> {
				this.openEditorCalls++;
				return Promise.resolve(undefined);
			}
		}());

		const instantiationService = workbenchInstantiationService({
			editorService: () => editorService,
			editorGroupService: () => store.add(new TestEditorGroupsService()),
		}, store);

		instantiationService.stub(IViewsService, viewsService);
		instantiationService.stub(ILogService, new NullLogService());
		instantiationService.stub(IQuickChatService, {
			_serviceBrand: undefined,
			sessionResource: undefined,
			focus: () => { },
		});
		instantiationService.stub(IChatService, {
			_serviceBrand: undefined,
			getSession: () => undefined,
		});
		instantiationService.stub(ILayoutService, {
			_serviceBrand: undefined,
			activeContainer: document.body,
			onDidChangeActiveContainer: { dispose: () => { } } as never,
		});
		instantiationService.stub(IWorkbenchEnvironmentService, {
			_serviceBrand: undefined,
			isSessionsWindow,
		} as IWorkbenchEnvironmentService);

		const service = instantiationService.createInstance(ChatWidgetService);
		return { service, viewsService: Object.assign(viewsService, { openViewCalls }), editorService };
	}

	test('canOpenChatViewOrEditor is false in default Code window', () => {
		assert.strictEqual(canOpenChatViewOrEditor(false), false);
		assert.strictEqual(canOpenChatViewOrEditor(true), true);
	});

	test('revealWidget does not open ChatView in default Code window', async () => {
		const { service, viewsService } = createService(false);
		const widget = await service.revealWidget();

		assert.strictEqual(widget, undefined);
		assert.deepStrictEqual(viewsService.openViewCalls, []);
	});

	test('openSession does not open ChatView or ChatEditor in default Code window', async () => {
		const { service, viewsService, editorService } = createService(false);
		const sessionResource = LocalChatSessionUri.forSession('default-window-gate');

		const viewWidget = await service.openSession(sessionResource);
		const editorWidget = await service.openSession(sessionResource, ACTIVE_GROUP);

		assert.strictEqual(viewWidget, undefined);
		assert.strictEqual(editorWidget, undefined);
		assert.deepStrictEqual(viewsService.openViewCalls, []);
		assert.strictEqual(editorService.openEditorCalls, 0);
	});

	test('openSession may open ChatView in Agents Window', async () => {
		const { service, viewsService, editorService } = createService(true);
		const sessionResource = LocalChatSessionUri.forSession('agents-window');

		await service.openSession(sessionResource);

		assert.deepStrictEqual(viewsService.openViewCalls, [ChatViewId]);
		assert.strictEqual(editorService.openEditorCalls, 0);
	});
});
