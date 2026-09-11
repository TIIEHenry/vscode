/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Event } from '../../../../../base/common/event.js';
import { timeout } from '../../../../../base/common/async.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { localize } from '../../../../../nls.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { type ContextKeyExpression, type ContextKeyValue, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentWriteGitApplyHunksRequest, UniverseAgentWriteGitWriteResult } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { isConversationPairingHold } from '../../../conversation/browser/conversationSessionStatus.js';
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainerModel, IViewContainersRegistry, IViewDescriptorService, IViewPaneContainer, IViewsRegistry, ViewContainerLocation } from '../../../../common/views.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { workbenchInstantiationService, TestEditorGroupView, TestViewsService } from '../../../../test/browser/workbenchTestServices.js';
import { IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { ISCMResource, ISCMService } from '../../../scm/common/scm.js';
import { ConversationDiffReviewEditorId } from '../../common/conversationDiffReviewInput.js';
import { ConversationDiffReviewInput } from '../../browser/conversationDiffReviewInput.js';
import { ConversationDiffReviewPane } from '../../browser/conversationDiffReviewPane.js';
import { SOURCES_DIFF_MOVE_TO_CONVERSATION_COMMAND, SOURCES_DIFF_MOVE_TO_PREVIEW_COMMAND } from '../../browser/sourcesDiffActions.js';
import { SOURCES_DIFF_PANEL_VIEW_CONTAINER } from '../../browser/sourcesDiffPanel.contribution.js';
import { SOURCES_DIFF_PANEL_CONTAINER_ID, SOURCES_DIFF_PANEL_VIEW_ID } from '../../browser/sourcesDiffPanelIds.js';
import { SourcesDiffPanelService } from '../../browser/sourcesDiffPanelService.js';
import { SourcesDiffPanelView } from '../../browser/sourcesDiffPanelView.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';
import { canSendSourcesGitApplyHunks, canShowSourcesReviewAccept, resolveSourcesDiffWriteActions } from '../../common/sourcesChangesGitWrite.js';

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

	test('EditorTitle exposes move to preview when Conversation Diff is active', () => {
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

	function createViewDescriptorServiceStub(): IViewDescriptorService {
		return {
			getViewLocationById: () => ViewContainerLocation.Panel,
			onDidChangeLocation: Event.None,
			getViewDescriptorById: () => null,
			getViewContainerByViewId: () => ({
				id: SOURCES_DIFF_PANEL_CONTAINER_ID,
				title: { value: 'Diff', original: 'Diff' },
				ctorDescriptor: {} as SyncDescriptor<IViewPaneContainer>,
			}),
			getViewContainerModel: () => ({
				onDidChangeContainerInfo: Event.None,
			} as IViewContainerModel),
			getDefaultContainerById: () => null,
		} as unknown as IViewDescriptorService;
	}

	function createLeftoverScmService(resource: URI): ISCMService {
		const group = {
			id: 'workingTree',
			label: 'Changes',
			resources: [] as ISCMResource[],
		};
		const scmResource = {
			sourceUri: resource,
			resourceGroup: group,
			decorations: {},
			open: async () => { },
		} as unknown as ISCMResource;
		group.resources.push(scmResource);
		const repository = {
			provider: {
				groups: [group],
				rootUri: resource,
				onDidChangeResources: Event.None,
				onDidChangeResourceGroups: Event.None,
			},
		};
		return {
			_serviceBrand: undefined,
			get repositories() { return [repository]; },
			get repositoryCount() { return 1; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService;
	}

	function stubDiffHonestyServices(options: {
		throwOnLoad?: boolean;
		executeCommand?: (...args: unknown[]) => Promise<unknown>;
		resource?: URI;
		connection?: IUniverseAgentConnection;
	} = {}) {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IViewDescriptorService, createViewDescriptorServiceStub());
		instantiationService.stub(IUniverseAgentConnection, options.connection ?? {
			isEngineConnected: () => false,
			onDidChangeConnection: Event.None,
		} as unknown as IUniverseAgentConnection);
		instantiationService.stub(IConversationRosterService, {
			getActiveSessionId: () => 'session-1',
			onDidChangeActiveSession: Event.None,
		} as unknown as IConversationRosterService);
		if (options.resource) {
			instantiationService.stub(ISCMService, createLeftoverScmService(options.resource));
		}
		instantiationService.stub(ICommandService, {
			onWillExecuteCommand: Event.None,
			onDidExecuteCommand: Event.None,
			executeCommand: options.executeCommand ?? (async () => undefined),
		} as unknown as ICommandService);
		if (options.throwOnLoad) {
			instantiationService.stub(ITextModelService, {
				createModelReference: async () => {
					throw new Error('boom');
				},
			} as unknown as ITextModelService);
		}
		return instantiationService;
	}

	test('Panel Accept is hidden without ApplyHunks payload; SCM local action is Stage', () => {
		assert.strictEqual(canShowSourcesReviewAccept(true, false), false);
		const scmOnly = resolveSourcesDiffWriteActions({
			groupId: 'workingTree',
			hasScmResource: true,
			canWriteStage: false,
			canWriteAccept: true,
			hasApplyHunksPayload: false,
			hasGitStageCommand: true,
			hasGitUnstageCommand: false,
			hasGitCleanCommand: false,
		});
		assert.strictEqual(scmOnly.showStage, true);
		assert.strictEqual(scmOnly.showAccept, false);
	});

	test('Diff panel load fail hides title authority and write chrome', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const original = toResource.call(this, '/project/src/a.ts.git');
		const stageCommand = CommandsRegistry.registerCommand('git.stage', () => { });
		try {
			const instantiationService = stubDiffHonestyServices({ throwOnLoad: true, resource });
			instantiationService.stub(IViewsService, {
				openView: async () => null,
				onDidChangeViewVisibility: Event.None,
				onDidChangeViewContainerVisibility: Event.None,
			} as unknown as IViewsService);
			const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
			instantiationService.stub(ISourcesDiffPanelService, panelService);

			const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
				id: SOURCES_DIFF_PANEL_VIEW_ID,
				title: 'Diff',
			}));
			view.render();
			await panelService.show({
				modified: resource,
				original,
				groupId: 'workingTree',
			});
			await timeout(50);

			assert.strictEqual(view.element.querySelector('.sources-diff-panel-title')?.textContent ?? '', '');
			assert.strictEqual((view.element.querySelector('.sources-diff-panel-stage') as HTMLElement | null)?.style.display, 'none');
			assert.strictEqual((view.element.querySelector('.sources-diff-panel-accept') as HTMLElement | null)?.style.display, 'none');
			assert.strictEqual((view.element.querySelector('.sources-diff-panel-revert') as HTMLElement | null)?.style.display, 'none');
			assert.strictEqual((view.element.querySelector('.sources-diff-panel-unstage') as HTMLElement | null)?.style.display, 'none');
			assert.strictEqual(
				view.element.querySelector('.sources-diff-panel-new-file-notice')?.textContent ?? '',
				localize('sourcesDiffPanel.loadFailed', "Unable to load this comparison."),
			);
			assert.ok(!(view.element.querySelector('.sources-diff-panel-new-file-notice')?.textContent ?? '').includes('New file'));
		} finally {
			stageCommand.dispose();
		}
	});

	test('Conversation Diff load fail hides write chrome and only keeps loadFailed', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const original = toResource.call(this, '/project/src/a.ts.git');
		const stageCommand = CommandsRegistry.registerCommand('git.stage', () => { });
		try {
			const instantiationService = stubDiffHonestyServices({ throwOnLoad: true, resource });
			const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
			const parent = document.createElement('div');
			document.body.appendChild(parent);
			store.add({ dispose: () => parent.remove() });
			pane.create(parent);

			const input = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree'));
			await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
			await timeout(20);

			assert.strictEqual((parent.querySelector('.conversation-diff-review-stage') as HTMLElement | null)?.style.display, 'none');
			assert.strictEqual((parent.querySelector('.conversation-diff-review-accept') as HTMLElement | null)?.style.display, 'none');
			assert.strictEqual((parent.querySelector('.conversation-diff-review-revert') as HTMLElement | null)?.style.display, 'none');
			assert.strictEqual((parent.querySelector('.conversation-diff-review-unstage') as HTMLElement | null)?.style.display, 'none');
			assert.strictEqual(
				parent.querySelector('.conversation-diff-review-notice')?.textContent ?? '',
				localize('conversationDiffReviewPane.loadFailed', "Unable to load this comparison."),
			);
			assert.ok(!(parent.querySelector('.conversation-diff-review-notice')?.textContent ?? '').includes('New file'));
		} finally {
			stageCommand.dispose();
		}
	});

	test('Conversation runGitAction success clears notice and failure keeps it', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const original = toResource.call(this, '/project/src/a.ts.git');
		let shouldFail = false;
		const instantiationService = stubDiffHonestyServices({
			throwOnLoad: true,
			resource,
			executeCommand: async () => {
				if (shouldFail) {
					throw new Error('boom');
				}
			},
		});
		const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		pane.create(parent);

		const input = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree'));
		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);

		const runner = pane as unknown as { runGitAction: (commandId: string) => Promise<void> };
		await runner.runGitAction('git.stage');
		assert.strictEqual((parent.querySelector('.conversation-diff-review-notice') as HTMLElement | null)?.style.display, 'none');

		shouldFail = true;
		await runner.runGitAction('git.stage');
		assert.strictEqual(parent.querySelector('.conversation-diff-review-notice')?.textContent ?? '', 'boom');
		assert.notStrictEqual((parent.querySelector('.conversation-diff-review-notice') as HTMLElement | null)?.style.display, 'none');
	});

	function forceClick(button: HTMLElement | null): void {
		if (!button) {
			return;
		}
		button.style.display = '';
		button.removeAttribute('disabled');
		button.setAttribute('aria-disabled', 'false');
		if ('disabled' in button) {
			(button as HTMLButtonElement).disabled = false;
		}
		button.click();
	}

	function leftoverLooksLiveApplyConnection(applyCalls: UniverseAgentWriteGitApplyHunksRequest[]): IUniverseAgentConnection {
		const acceptedWrite: UniverseAgentWriteGitWriteResult = {
			supported: true,
			reason: '',
			success: true,
			errorMessage: '',
			exitCode: 0,
			stdout: '',
		};
		return {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: true }),
			onDidChangeConnection: Event.None,
			writeGitApplyHunks: async (request: UniverseAgentWriteGitApplyHunksRequest) => {
				applyCalls.push(request);
				return acceptedWrite;
			},
		} as unknown as IUniverseAgentConnection;
	}

	test('leftover-looks-live pairing-hold Accept chrome stays hidden and 0 unary', async function () {
		const resource = toResource.call(this, '/project/src/leftover.ts');
		const original = toResource.call(this, '/project/src/leftover.ts.git');
		const applyCalls: UniverseAgentWriteGitApplyHunksRequest[] = [];
		const connection = leftoverLooksLiveApplyConnection(applyCalls);
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.strictEqual(canSendSourcesGitApplyHunks(true, true, isConversationPairingHold(connection)), false);

		const instantiationService = stubDiffHonestyServices({
			throwOnLoad: true,
			resource,
			connection,
		});
		instantiationService.stub(IViewsService, {
			openView: async () => null,
			onDidChangeViewVisibility: Event.None,
			onDidChangeViewContainerVisibility: Event.None,
		} as unknown as IViewsService);
		const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
		instantiationService.stub(ISourcesDiffPanelService, panelService);

		const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
			id: SOURCES_DIFF_PANEL_VIEW_ID,
			title: 'Diff',
		}));
		view.render();
		await panelService.show({
			modified: resource,
			original,
			groupId: 'workingTree',
		});
		await timeout(50);

		const panelAccept = view.element.querySelector('.sources-diff-panel-accept') as HTMLButtonElement | null;
		assert.strictEqual(panelAccept?.style.display, 'none');
		forceClick(panelAccept);
		await (view as unknown as { runAccept: () => Promise<void> }).runAccept();
		await timeout(20);
		assert.deepStrictEqual(applyCalls, []);

		const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		pane.create(parent);
		const input = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree'));
		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
		await timeout(20);

		const reviewAccept = parent.querySelector('.conversation-diff-review-accept') as HTMLButtonElement | null;
		assert.strictEqual(reviewAccept?.style.display, 'none');
		forceClick(reviewAccept);
		await (pane as unknown as { runAccept: () => Promise<void> }).runAccept();
		await timeout(20);
		assert.deepStrictEqual(applyCalls, []);
	});
});
