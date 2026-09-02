/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainerLocation } from '../../../../common/views.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { workbenchInstantiationService, TestViewsService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationDiffReviewEditorId } from '../../common/conversationDiffReviewInput.js';
import { SOURCES_DIFF_MOVE_TO_CONVERSATION_COMMAND, SOURCES_DIFF_MOVE_TO_PREVIEW_COMMAND } from '../../browser/sourcesDiffActions.js';
import { SOURCES_DIFF_PANEL_VIEW_CONTAINER } from '../../browser/sourcesDiffPanel.contribution.js';
import '../../browser/sourcesDiffPanel.contribution.js';
import { SOURCES_DIFF_PANEL_CONTAINER_ID, SOURCES_DIFF_PANEL_VIEW_ID } from '../../browser/sourcesDiffPanelIds.js';
import { SourcesDiffPanelService } from '../../browser/sourcesDiffPanelService.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

suite('Sources diff panel', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
	const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

	test('Diff panel container and view register on Panel with hideIfEmpty', () => {
		const container = viewContainersRegistry.get(SOURCES_DIFF_PANEL_CONTAINER_ID);
		assert.ok(container, 'Sources diff panel container should be registered');
		assert.strictEqual(container, SOURCES_DIFF_PANEL_VIEW_CONTAINER);
		assert.strictEqual(container.hideIfEmpty, true);
		assert.strictEqual(
			viewContainersRegistry.getViewContainerLocation(container),
			ViewContainerLocation.Panel,
			'Sources diff panel must live on PANEL_PART'
		);

		const viewDescriptor = viewsRegistry.getView(SOURCES_DIFF_PANEL_VIEW_ID);
		assert.ok(viewDescriptor, 'Sources diff panel view should be registered');
		assert.strictEqual(viewsRegistry.getViewContainer(SOURCES_DIFF_PANEL_VIEW_ID), container);
		assert.strictEqual(viewDescriptor.when, SourcesDiffPanelService.ctxHasChange);
	});

	test('show enables view context and clear disables it for hideIfEmpty', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const ref = {
			modified: resource,
			original: toResource.call(this, '/project/src/a.ts.git'),
			groupId: 'workingTree',
		};

		const openViewCalls: Array<{ id: string; focus: boolean | undefined }> = [];
		class TrackingViewsService extends TestViewsService {
			override openView<T>(id: string, focus?: boolean): Promise<T | null> {
				openViewCalls.push({ id, focus });
				return Promise.resolve(null);
			}
			dispose(): void { }
		}

		const instantiationService = workbenchInstantiationService(undefined, store);
		const viewsService = store.add(new TrackingViewsService());
		instantiationService.stub(IViewsService, viewsService);

		const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
		const contextKeyService = instantiationService.get(IContextKeyService);
		const ctxValues = () => ({
			[SourcesDiffPanelService.ctxHasChange.key]: contextKeyService.getContextKeyValue<boolean>(SourcesDiffPanelService.ctxHasChange.key) ?? false,
			view: SOURCES_DIFF_PANEL_VIEW_ID,
		});

		assert.strictEqual(
			evalWhen(SourcesDiffPanelService.ctxHasChange, ctxValues()),
			false,
			'hideIfEmpty container must start inactive'
		);

		await panelService.show(ref);
		assert.strictEqual(panelService.getCurrentRef(), ref);
		assert.strictEqual(
			evalWhen(SourcesDiffPanelService.ctxHasChange, ctxValues()),
			true,
			'show must activate the diff panel view'
		);
		assert.deepStrictEqual(openViewCalls, [{ id: SOURCES_DIFF_PANEL_VIEW_ID, focus: true }]);

		panelService.clear();
		assert.strictEqual(panelService.getCurrentRef(), undefined);
		assert.strictEqual(
			evalWhen(SourcesDiffPanelService.ctxHasChange, ctxValues()),
			false,
			'clear must deactivate the diff panel view'
		);
	});

	test('show replaces the current change ref', async function () {
		const resourceA = toResource.call(this, '/project/src/a.ts');
		const resourceB = toResource.call(this, '/project/src/b.ts');
		const refA = { modified: resourceA, original: undefined, groupId: 'workingTree' };
		const refB = { modified: resourceB, original: undefined, groupId: 'workingTree' };

		const changes: Array<URI | undefined> = [];
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IViewsService, {
			openView: async () => null,
			onDidChangeViewVisibility: Event.None,
			onDidChangeViewContainerVisibility: Event.None,
		} as unknown as IViewsService);

		const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
		store.add(panelService.onDidChangeRef(ref => changes.push(ref?.modified)));

		await panelService.show(refA);
		await panelService.show(refB);

		assert.strictEqual(panelService.getCurrentRef()?.modified.toString(), resourceB.toString());
		assert.deepStrictEqual(changes.map(uri => uri?.toString()), [resourceA.toString(), resourceB.toString()]);
	});

	test('panel ViewTitle exposes move to conversation and preview actions', () => {
		const viewTitleItems = MenuRegistry.getMenuItems(MenuId.ViewTitle).filter(isIMenuItem);
		const moveToConversation = viewTitleItems.find(item => item.command.id === SOURCES_DIFF_MOVE_TO_CONVERSATION_COMMAND);
		const moveToPreview = viewTitleItems.find(item => item.command.id === SOURCES_DIFF_MOVE_TO_PREVIEW_COMMAND);

		assert.ok(moveToConversation, 'Panel view title must expose move to conversation');
		assert.ok(moveToPreview, 'Panel view title must expose move to preview');
		assert.ok(moveToConversation.when, 'Panel move to conversation must be gated');
		assert.ok(moveToPreview.when, 'Panel move to preview must be gated');
		assert.strictEqual(
			evalWhen(moveToConversation.when, { view: SOURCES_DIFF_PANEL_VIEW_ID, [SourcesDiffPanelService.ctxHasChange.key]: true }),
			true
		);
		assert.strictEqual(
			evalWhen(moveToPreview.when, { view: SOURCES_DIFF_PANEL_VIEW_ID, [SourcesDiffPanelService.ctxHasChange.key]: false }),
			false
		);
	});

	test('EditorTitle exposes move to preview when Conversation Diff placeholder is active', () => {
		const editorTitleItems = MenuRegistry.getMenuItems(MenuId.EditorTitle).filter(isIMenuItem);
		const moveToPreview = editorTitleItems.find(item => item.command.id === SOURCES_DIFF_MOVE_TO_PREVIEW_COMMAND);

		assert.ok(moveToPreview, 'Conversation Diff editor title must expose move to preview');
		assert.ok(moveToPreview.when, 'Conversation Diff move to preview must be gated');
		assert.strictEqual(
			evalWhen(moveToPreview.when, { activeEditor: ConversationDiffReviewEditorId }),
			true
		);
		assert.strictEqual(
			evalWhen(moveToPreview.when, { activeEditor: 'workbench.editor.files.textFileEditor' }),
			false
		);
	});
});
