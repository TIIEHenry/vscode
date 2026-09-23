/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { localize } from '../../../../../nls.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { type ContextKeyExpression, type ContextKeyValue, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentWriteGitApplyHunksRequest, UniverseAgentWriteGitStagePathsRequest, UniverseAgentWriteGitWriteResult } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { isConversationPairingHold } from '../../../conversation/browser/conversationSessionStatus.js';
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainerModel, IViewContainersRegistry, IViewDescriptorService, IViewPaneContainer, IViewsRegistry, ViewContainerLocation } from '../../../../common/views.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { DiffEditorInput } from '../../../../common/editor/diffEditorInput.js';
import { workbenchInstantiationService, TestEditorGroupView, TestEditorInput, TestViewsService } from '../../../../test/browser/workbenchTestServices.js';
import { IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { ISCMResource, ISCMService } from '../../../scm/common/scm.js';
import { ConversationDiffReviewEditorId } from '../../common/conversationDiffReviewInput.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { ConversationDiffReviewInput } from '../../browser/conversationDiffReviewInput.js';
import { ConversationDiffReviewPane } from '../../browser/conversationDiffReviewPane.js';
import { ISourcesChangeEntryOpenDeps, openSourcesChangeEntry } from '../../browser/sourcesChangeEntryOpen.js';
import { SOURCES_DIFF_MOVE_TO_CONVERSATION_COMMAND, SOURCES_DIFF_MOVE_TO_PREVIEW_COMMAND } from '../../browser/sourcesDiffActions.js';
import { moveActiveDiffToConversation } from '../../browser/sourcesDiffRefHelpers.js';
import { SOURCES_DIFF_PANEL_VIEW_CONTAINER } from '../../browser/sourcesDiffPanel.contribution.js';
import { SOURCES_DIFF_PANEL_CONTAINER_ID, SOURCES_DIFF_PANEL_VIEW_ID } from '../../browser/sourcesDiffPanelIds.js';
import { SourcesDiffPanelService } from '../../browser/sourcesDiffPanelService.js';
import { SourcesDiffPanelView } from '../../browser/sourcesDiffPanelView.js';
import { attachCarriedSourcesGitApplyHunksPatch, attachSourcesGitApplyHunksPatch, carriedSourcesGitApplyHunksPatch, ISourcesChangeRef, sourcesGitApplyHunksPatches, withCarriedSourcesGitApplyHunksPatch } from '../../common/sourcesChangeRef.js';
import { ISourcesChangeEntry } from '../../common/sourcesChangesModel.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';
import { canSendSourcesGitApplyHunks, canSendSourcesGitStagePaths, canShowSourcesReviewAccept, resolveSourcesDiffWriteActions } from '../../common/sourcesChangesGitWrite.js';

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

	function createLeftoverScmService(resource: URI, groupId = 'workingTree'): ISCMService {
		const group = {
			id: groupId,
			label: groupId === 'index' ? 'Staged Changes' : 'Changes',
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
		groupId?: string;
		connection?: IUniverseAgentConnection;
		engineSessionReady?: boolean;
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
			onDidChangeSession: Event.None,
			isEngineSessionReady: () => options.engineSessionReady ?? true,
		} as unknown as IConversationRosterService);
		if (options.resource) {
			instantiationService.stub(ISCMService, createLeftoverScmService(options.resource, options.groupId));
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
			assert.ok(view.element.querySelector('.sources-diff-panel-new-file-notice')?.classList.contains('is-error'));
			assert.ok(!(view.element.querySelector('.sources-diff-panel-new-file-notice')?.textContent ?? '').includes('New file'));
			assert.strictEqual((view.element.querySelector('.sources-diff-panel-header') as HTMLElement | null)?.style.display, 'none');
		} finally {
			stageCommand.dispose();
		}
	});

	test('connection change during renderRef keeps write chrome hidden until comparison loads', async function () {
		const resource = toResource.call(this, '/project/src/render-pending-write.ts');
		const original = toResource.call(this, '/project/src/render-pending-write.ts.git');
		const stageCommand = CommandsRegistry.registerCommand('git.stage', () => { });
		try {
			let releaseLoad: (() => void) | undefined;
			const loadGate = new Promise<void>(resolve => {
				releaseLoad = resolve;
			});
			const onDidChangeConnection = new Emitter<void>();
			const connection = {
				isEngineConnected: () => false,
				getConnectionSnapshot: () => ({ pairingPending: false }),
				onDidChangeConnection: onDidChangeConnection.event,
			} as unknown as IUniverseAgentConnection;

			const instantiationService = stubDiffHonestyServices({ resource, connection });
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
			const renderHost = view as unknown as {
				renderDiff: (original: URI, modified: URI, generation: number) => Promise<boolean>;
			};
			renderHost.renderDiff = async () => {
				await loadGate;
				return true;
			};

			void panelService.show({
				modified: resource,
				original,
				groupId: 'workingTree',
			});
			await timeout(0);

			paintPanelWriteChrome(view);
			onDidChangeConnection.fire();
			assert.strictEqual((view.element.querySelector('.sources-diff-panel-stage') as HTMLElement | null)?.style.display, 'none');
			assert.strictEqual((view.element.querySelector('.sources-diff-panel-accept') as HTMLElement | null)?.style.display, 'none');

			releaseLoad!();
			await timeout(50);

			assert.strictEqual((view.element.querySelector('.sources-diff-panel-stage') as HTMLElement | null)?.style.display, '');
			onDidChangeConnection.dispose();
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
			assert.ok(parent.querySelector('.conversation-diff-review-notice')?.classList.contains('is-error'));
			assert.ok(!(parent.querySelector('.conversation-diff-review-notice')?.textContent ?? '').includes('New file'));
			assert.strictEqual((parent.querySelector('.conversation-diff-review-toolbar') as HTMLElement | null)?.style.display, 'none');
			assert.strictEqual((parent.querySelector('.conversation-diff-review-open-preview') as HTMLElement | null)?.style.display, 'none');
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

	async function assertWarnThenRethrowDoesNotLeak(paintBoom: Error, run: () => void | Promise<void>): Promise<void> {
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			await run();
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom, paintBoom],
			});
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	}

	function leftoverLooksLiveApplyConnection(
		applyCalls: UniverseAgentWriteGitApplyHunksRequest[],
		stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [],
		pairingPending = true,
	): IUniverseAgentConnection {
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
			getConnectionSnapshot: () => ({ pairingPending }),
			onDidChangeConnection: Event.None,
			writeGitApplyHunks: async (request: UniverseAgentWriteGitApplyHunksRequest) => {
				applyCalls.push(request);
				return acceptedWrite;
			},
			writeGitStagePaths: async (request: UniverseAgentWriteGitStagePathsRequest) => {
				stageCalls.push(request);
				return acceptedWrite;
			},
		} as unknown as IUniverseAgentConnection;
	}

	const carriedUnifiedDiff = '@@ -1 +1 @@\n-old\n+new\n';

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
			unifiedDiff: carriedUnifiedDiff,
		});
		await timeout(50);
		paintPanelWriteChrome(view);

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
		attachSourcesGitApplyHunksPatch(input, carriedUnifiedDiff);
		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
		await timeout(20);
		paintReviewWriteChrome(pane);

		const reviewAccept = parent.querySelector('.conversation-diff-review-accept') as HTMLButtonElement | null;
		assert.strictEqual(reviewAccept?.style.display, 'none');
		forceClick(reviewAccept);
		await (pane as unknown as { runAccept: () => Promise<void> }).runAccept();
		await timeout(20);
		assert.deepStrictEqual(applyCalls, []);
	});

	test('leftover-looks-live pairing-hold Stage chrome stays hidden and 0 unary / 0 git.stage', async function () {
		const resource = toResource.call(this, '/project/src/leftover-stage.ts');
		const original = toResource.call(this, '/project/src/leftover-stage.ts.git');
		const applyCalls: UniverseAgentWriteGitApplyHunksRequest[] = [];
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const gitStageCommands: unknown[] = [];
		const connection = leftoverLooksLiveApplyConnection(applyCalls, stageCalls);
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.strictEqual(canSendSourcesGitStagePaths(true, true, 'session-1', isConversationPairingHold(connection)), false);

		const instantiationService = stubDiffHonestyServices({
			throwOnLoad: true,
			resource,
			connection,
			executeCommand: async (commandId: unknown) => {
				if (commandId === 'git.stage') {
					gitStageCommands.push(commandId);
				}
			},
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

		const panelStage = view.element.querySelector('.sources-diff-panel-stage') as HTMLButtonElement | null;
		assert.strictEqual(panelStage?.style.display, 'none');
		forceClick(panelStage);
		await (view as unknown as { runStage: () => Promise<void> }).runStage();
		await timeout(20);
		assert.deepStrictEqual(stageCalls, []);
		assert.deepStrictEqual(gitStageCommands, []);

		const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		pane.create(parent);
		const input = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree'));
		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
		await timeout(20);

		const reviewStage = parent.querySelector('.conversation-diff-review-stage') as HTMLButtonElement | null;
		assert.strictEqual(reviewStage?.style.display, 'none');
		forceClick(reviewStage);
		await (pane as unknown as { runStage: () => Promise<void> }).runStage();
		await timeout(20);
		assert.deepStrictEqual(stageCalls, []);
		assert.deepStrictEqual(gitStageCommands, []);
		assert.deepStrictEqual(applyCalls, []);
	});

	function leftoverConnectedConnection(
		pairingPending: boolean,
	): IUniverseAgentConnection {
		return leftoverLooksLiveApplyConnection([], [], pairingPending);
	}

	function paintPanelWriteChrome(view: SourcesDiffPanelView): void {
		const host = view as unknown as { comparisonLoadFailed: boolean; updateWriteActions: () => void };
		host.comparisonLoadFailed = false;
		host.updateWriteActions();
	}

	function paintReviewWriteChrome(pane: ConversationDiffReviewPane): void {
		const host = pane as unknown as { comparisonLoadFailed: boolean; updateReviewActions: () => void };
		host.comparisonLoadFailed = false;
		host.updateReviewActions();
	}

	test('leftover-looks-live pairing-hold Stage with local SCM stays hidden and 0 git.stage', async function () {
		const resource = toResource.call(this, '/project/src/leftover-scm-stage.ts');
		const original = toResource.call(this, '/project/src/leftover-scm-stage.ts.git');
		const applyCalls: UniverseAgentWriteGitApplyHunksRequest[] = [];
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const gitStageCommands: unknown[] = [];
		const connection = leftoverLooksLiveApplyConnection(applyCalls, stageCalls);
		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		const stageCommand = CommandsRegistry.registerCommand('git.stage', () => { });
		try {
			const instantiationService = stubDiffHonestyServices({
				throwOnLoad: true,
				resource,
				groupId: 'workingTree',
				connection,
				executeCommand: async (commandId: unknown) => {
					if (commandId === 'git.stage') {
						gitStageCommands.push(commandId);
					}
				},
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
			paintPanelWriteChrome(view);

			const panelStage = view.element.querySelector('.sources-diff-panel-stage') as HTMLButtonElement | null;
			assert.strictEqual(panelStage?.style.display, 'none');
			forceClick(panelStage);
			await (view as unknown as { runStage: () => Promise<void> }).runStage();
			await timeout(20);
			assert.deepStrictEqual(stageCalls, []);
			assert.deepStrictEqual(gitStageCommands, []);

			const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
			const parent = document.createElement('div');
			document.body.appendChild(parent);
			store.add({ dispose: () => parent.remove() });
			pane.create(parent);
			const input = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree'));
			await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
			await timeout(20);
			paintReviewWriteChrome(pane);

			const reviewStage = parent.querySelector('.conversation-diff-review-stage') as HTMLButtonElement | null;
			assert.strictEqual(reviewStage?.style.display, 'none');
			forceClick(reviewStage);
			await (pane as unknown as { runStage: () => Promise<void> }).runStage();
			await timeout(20);
			assert.deepStrictEqual(stageCalls, []);
			assert.deepStrictEqual(gitStageCommands, []);
			assert.deepStrictEqual(applyCalls, []);
		} finally {
			stageCommand.dispose();
		}
	});

	test('leftover-looks-live pairing-hold Unstage / Revert chrome stays hidden and 0 git.unstage / git.clean', async function () {
		const resource = toResource.call(this, '/project/src/leftover-unstage.ts');
		const original = toResource.call(this, '/project/src/leftover-unstage.ts.git');
		const gitMutateCommands: string[] = [];
		const connection = leftoverConnectedConnection(true);
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		const unstageCommand = CommandsRegistry.registerCommand('git.unstage', () => { });
		const cleanCommand = CommandsRegistry.registerCommand('git.clean', () => { });
		try {
			const instantiationService = stubDiffHonestyServices({
				throwOnLoad: true,
				resource,
				groupId: 'workingTree',
				connection,
				executeCommand: async (commandId: unknown) => {
					if (commandId === 'git.unstage' || commandId === 'git.clean') {
						gitMutateCommands.push(String(commandId));
					}
				},
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
			paintPanelWriteChrome(view);

			const panelRevert = view.element.querySelector('.sources-diff-panel-revert') as HTMLButtonElement | null;
			const panelUnstage = view.element.querySelector('.sources-diff-panel-unstage') as HTMLButtonElement | null;
			assert.strictEqual(panelRevert?.style.display, 'none');
			assert.strictEqual(panelUnstage?.style.display, 'none');
			forceClick(panelRevert);
			forceClick(panelUnstage);
			await (view as unknown as { runGitAction: (commandId: string) => Promise<void> }).runGitAction('git.clean');
			await (view as unknown as { runGitAction: (commandId: string) => Promise<void> }).runGitAction('git.unstage');
			await timeout(20);
			assert.strictEqual(gitMutateCommands.length, 0);

			const indexInstantiation = stubDiffHonestyServices({
				throwOnLoad: true,
				resource,
				groupId: 'index',
				connection,
				executeCommand: async (commandId: unknown) => {
					if (commandId === 'git.unstage' || commandId === 'git.clean') {
						gitMutateCommands.push(String(commandId));
					}
				},
			});
			indexInstantiation.stub(IViewsService, {
				openView: async () => null,
				onDidChangeViewVisibility: Event.None,
				onDidChangeViewContainerVisibility: Event.None,
			} as unknown as IViewsService);
			const indexPanelService = store.add(indexInstantiation.createInstance(SourcesDiffPanelService));
			indexInstantiation.stub(ISourcesDiffPanelService, indexPanelService);
			const indexView = store.add(indexInstantiation.createInstance(SourcesDiffPanelView, {
				id: SOURCES_DIFF_PANEL_VIEW_ID,
				title: 'Diff',
			}));
			indexView.render();
			await indexPanelService.show({
				modified: resource,
				original,
				groupId: 'index',
			});
			await timeout(50);
			paintPanelWriteChrome(indexView);
			const indexUnstage = indexView.element.querySelector('.sources-diff-panel-unstage') as HTMLButtonElement | null;
			assert.strictEqual(indexUnstage?.style.display, 'none');
			forceClick(indexUnstage);
			await (indexView as unknown as { runGitAction: (commandId: string) => Promise<void> }).runGitAction('git.unstage');
			await timeout(20);
			assert.deepStrictEqual(gitMutateCommands, []);

			const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
			const parent = document.createElement('div');
			document.body.appendChild(parent);
			store.add({ dispose: () => parent.remove() });
			pane.create(parent);
			const input = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree'));
			await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
			await timeout(20);
			paintReviewWriteChrome(pane);

			const reviewRevert = parent.querySelector('.conversation-diff-review-revert') as HTMLButtonElement | null;
			const reviewUnstage = parent.querySelector('.conversation-diff-review-unstage') as HTMLButtonElement | null;
			assert.strictEqual(reviewRevert?.style.display, 'none');
			assert.strictEqual(reviewUnstage?.style.display, 'none');
			forceClick(reviewRevert);
			forceClick(reviewUnstage);
			await (pane as unknown as { runGitAction: (commandId: string) => Promise<void> }).runGitAction('git.clean');
			await (pane as unknown as { runGitAction: (commandId: string) => Promise<void> }).runGitAction('git.unstage');
			await timeout(20);
			assert.deepStrictEqual(gitMutateCommands, []);
		} finally {
			unstageCommand.dispose();
			cleanCommand.dispose();
		}
	});

	test('KEEP leftover list-fail hides Diff Stage / Revert / Unstage chrome and stays 0 writes', async function () {
		const resource = toResource.call(this, '/project/src/leftover-keep.ts');
		const original = toResource.call(this, '/project/src/leftover-keep.ts.git');
		const applyCalls: UniverseAgentWriteGitApplyHunksRequest[] = [];
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const gitMutateCommands: string[] = [];
		const connection = leftoverLooksLiveApplyConnection(applyCalls, stageCalls, false);
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, false);
		assert.strictEqual(isConversationPairingHold(connection), false);

		const unstageCommand = CommandsRegistry.registerCommand('git.unstage', () => { });
		const cleanCommand = CommandsRegistry.registerCommand('git.clean', () => { });
		const stageCommand = CommandsRegistry.registerCommand('git.stage', () => { });
		try {
			const instantiationService = stubDiffHonestyServices({
				throwOnLoad: true,
				resource,
				groupId: 'workingTree',
				connection,
				engineSessionReady: false,
				executeCommand: async (commandId: unknown) => {
					if (commandId === 'git.unstage' || commandId === 'git.clean' || commandId === 'git.stage') {
						gitMutateCommands.push(String(commandId));
					}
				},
			});
			instantiationService.invokeFunction(accessor => {
				assert.strictEqual(accessor.get(IConversationRosterService).isEngineSessionReady(), false);
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
			paintPanelWriteChrome(view);

			const panelStage = view.element.querySelector('.sources-diff-panel-stage') as HTMLButtonElement | null;
			const panelRevert = view.element.querySelector('.sources-diff-panel-revert') as HTMLButtonElement | null;
			const panelUnstage = view.element.querySelector('.sources-diff-panel-unstage') as HTMLButtonElement | null;
			assert.strictEqual(panelStage?.style.display, 'none');
			assert.strictEqual(panelRevert?.style.display, 'none');
			assert.ok(!panelUnstage || panelUnstage.style.display === 'none');
			forceClick(panelStage);
			forceClick(panelRevert);
			await (view as unknown as { runStage: () => Promise<void> }).runStage();
			await (view as unknown as { runGitAction: (commandId: string) => Promise<void> }).runGitAction('git.clean');
			await timeout(20);
			assert.deepStrictEqual(applyCalls, []);
			assert.deepStrictEqual(stageCalls, []);
			assert.deepStrictEqual(gitMutateCommands, []);

			const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
			const parent = document.createElement('div');
			document.body.appendChild(parent);
			store.add({ dispose: () => parent.remove() });
			pane.create(parent);
			const input = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree'));
			await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
			await timeout(20);
			paintReviewWriteChrome(pane);

			const reviewStage = parent.querySelector('.conversation-diff-review-stage') as HTMLButtonElement | null;
			const reviewRevert = parent.querySelector('.conversation-diff-review-revert') as HTMLButtonElement | null;
			assert.strictEqual(reviewStage?.style.display, 'none');
			assert.strictEqual(reviewRevert?.style.display, 'none');
			forceClick(reviewStage);
			forceClick(reviewRevert);
			await (pane as unknown as { runStage: () => Promise<void> }).runStage();
			await (pane as unknown as { runGitAction: (commandId: string) => Promise<void> }).runGitAction('git.unstage');
			await timeout(20);
			assert.deepStrictEqual(applyCalls, []);
			assert.deepStrictEqual(stageCalls, []);
			assert.deepStrictEqual(gitMutateCommands, []);
		} finally {
			unstageCommand.dispose();
			cleanCommand.dispose();
			stageCommand.dispose();
		}
	});

	test('connected leftover without pairing Unstage / Revert still run git.unstage / git.clean', async function () {
		const resource = toResource.call(this, '/project/src/leftover-live-unstage.ts');
		const original = toResource.call(this, '/project/src/leftover-live-unstage.ts.git');
		const gitMutateCommands: string[] = [];
		const connection = leftoverConnectedConnection(false);
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, false);
		assert.strictEqual(isConversationPairingHold(connection), false);

		const unstageCommand = CommandsRegistry.registerCommand('git.unstage', () => { });
		const cleanCommand = CommandsRegistry.registerCommand('git.clean', () => { });
		try {
			const instantiationService = stubDiffHonestyServices({
				throwOnLoad: true,
				resource,
				groupId: 'workingTree',
				connection,
				executeCommand: async (commandId: unknown) => {
					if (commandId === 'git.unstage' || commandId === 'git.clean') {
						gitMutateCommands.push(String(commandId));
					}
				},
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
			paintPanelWriteChrome(view);

			const panelRevert = view.element.querySelector('.sources-diff-panel-revert') as HTMLButtonElement | null;
			assert.strictEqual(panelRevert?.style.display, '');
			await (view as unknown as { runGitAction: (commandId: string) => Promise<void> }).runGitAction('git.clean');
			await timeout(20);
			assert.deepStrictEqual(gitMutateCommands, ['git.clean']);

			const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
			const parent = document.createElement('div');
			document.body.appendChild(parent);
			store.add({ dispose: () => parent.remove() });
			pane.create(parent);
			const input = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree'));
			await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
			await timeout(20);
			paintReviewWriteChrome(pane);

			const reviewRevert = parent.querySelector('.conversation-diff-review-revert') as HTMLButtonElement | null;
			assert.strictEqual(reviewRevert?.style.display, '');
			await (pane as unknown as { runGitAction: (commandId: string) => Promise<void> }).runGitAction('git.unstage');
			await timeout(20);
			assert.deepStrictEqual(gitMutateCommands, ['git.clean', 'git.unstage']);
		} finally {
			unstageCommand.dispose();
			cleanCommand.dispose();
		}
	});

	function disconnectedHoldSafeConnection(): IUniverseAgentConnection {
		return {
			isEngineConnected: () => false,
			getConnectionPhase: () => ({ kind: 'disconnected' as const }),
			getConnectionSnapshot: () => ({}),
			onDidChangeConnection: Event.None,
		} as unknown as IUniverseAgentConnection;
	}

	async function mountConversationDiffReviewPane(test: Mocha.Context, options: {
		executeCommand?: (...args: unknown[]) => Promise<unknown>;
		connection?: IUniverseAgentConnection;
		groupId?: string;
	} = {}): Promise<{ pane: ConversationDiffReviewPane; parent: HTMLElement }> {
		const resource = toResource.call(test, '/project/src/d526-review.ts');
		const original = toResource.call(test, '/project/src/d526-review.ts.git');
		const instantiationService = stubDiffHonestyServices({
			throwOnLoad: true,
			resource,
			groupId: options.groupId,
			executeCommand: options.executeCommand,
			connection: options.connection ?? disconnectedHoldSafeConnection(),
		});
		const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		pane.create(parent);
		const input = store.add(new ConversationDiffReviewInput(resource, original, options.groupId ?? 'workingTree'));
		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
		return { pane, parent };
	}

	function stubShowNoticeThrow(pane: ConversationDiffReviewPane, paintBoom: Error): void {
		(pane as unknown as { showNotice(message: string): void }).showNotice = () => {
			throw paintBoom;
		};
	}

	test('does not leak unhandled rejection when Revert click catch-path notice throws and onUnexpectedError warn-then-rethrows', async function () {
		const paintBoom = new Error('paint boom');
		await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
			const { pane, parent } = await mountConversationDiffReviewPane(this, {
				executeCommand: async () => {
					throw new Error('git boom');
				},
			});
			stubShowNoticeThrow(pane, paintBoom);
			forceClick(parent.querySelector('.conversation-diff-review-revert'));
		});
	});

	test('does not leak unhandled rejection when Unstage click catch-path notice throws and onUnexpectedError warn-then-rethrows', async function () {
		const paintBoom = new Error('paint boom');
		await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
			const { pane, parent } = await mountConversationDiffReviewPane(this, {
				groupId: 'index',
				executeCommand: async () => {
					throw new Error('git boom');
				},
			});
			stubShowNoticeThrow(pane, paintBoom);
			forceClick(parent.querySelector('.conversation-diff-review-unstage'));
		});
	});

	test('does not leak unhandled rejection when Stage click catch-path notice throws and onUnexpectedError warn-then-rethrows', async function () {
		const paintBoom = new Error('paint boom');
		await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
			const { pane, parent } = await mountConversationDiffReviewPane(this, {
				executeCommand: async () => {
					throw new Error('git boom');
				},
			});
			stubShowNoticeThrow(pane, paintBoom);
			forceClick(parent.querySelector('.conversation-diff-review-stage'));
		});
	});

	test('does not leak unhandled rejection when Accept click catch-path notice throws and onUnexpectedError warn-then-rethrows', async function () {
		const paintBoom = new Error('paint boom');
		await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
			const { pane, parent } = await mountConversationDiffReviewPane(this, {
				connection: leftoverConnectedConnection(false),
			});
			stubShowNoticeThrow(pane, paintBoom);
			forceClick(parent.querySelector('.conversation-diff-review-accept'));
		});
	});

	test('does not leak unhandled rejection when Preview executeCommand rejects and onUnexpectedError warn-then-rethrows', async function () {
		const commandBoom = new Error('preview boom');
		await assertWarnThenRethrowDoesNotLeak(commandBoom, async () => {
			const { parent } = await mountConversationDiffReviewPane(this, {
				executeCommand: async () => {
					throw commandBoom;
				},
			});
			forceClick(parent.querySelector('.conversation-diff-review-open-preview'));
		});
	});

	test('does not leak unhandled rejection when Stage catch-path notice throws and onUnexpectedError warn-then-rethrows', async function () {
		const paintBoom = new Error('paint boom');
		const resource = toResource.call(this, '/project/src/d524-stage.ts');
		const original = toResource.call(this, '/project/src/d524-stage.ts.git');
		const applyCalls: UniverseAgentWriteGitApplyHunksRequest[] = [];
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const connection = leftoverLooksLiveApplyConnection(applyCalls, stageCalls, false);
		connection.writeGitStagePaths = async (request: UniverseAgentWriteGitStagePathsRequest) => {
			stageCalls.push(request);
			throw new Error('stage boom');
		};

		await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
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
			paintPanelWriteChrome(view);
			(view as unknown as { showActionNotice(message: string): void }).showActionNotice = () => {
				throw paintBoom;
			};
			forceClick(view.element.querySelector('.sources-diff-panel-stage') as HTMLButtonElement | null);
			await timeout(20);
		});
		assert.strictEqual(stageCalls.length, 1);
		assert.deepStrictEqual(applyCalls, []);
	});

	test('does not leak unhandled rejection when renderRef catch-path notice throws and onUnexpectedError warn-then-rethrows', async function () {
		const paintBoom = new Error('paint boom');
		const resource = toResource.call(this, '/project/src/d524-render.ts');
		const original = toResource.call(this, '/project/src/d524-render.ts.git');

		await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
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
			(view as unknown as { showLoadNotice(message: string): void }).showLoadNotice = () => {
				throw paintBoom;
			};
			await panelService.show({
				modified: resource,
				original,
				groupId: 'workingTree',
			});
			await timeout(50);
		});
	});

	test('sourcesGitApplyHunksPatches carries unifiedDiff and rejects empty', () => {
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(undefined), []);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches({ unifiedDiff: '' }), []);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches({ unifiedDiff: '  ' }), []);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches({ unifiedDiff: carriedUnifiedDiff }), [carriedUnifiedDiff]);
		assert.strictEqual(carriedSourcesGitApplyHunksPatch({ unifiedDiff: carriedUnifiedDiff }), carriedUnifiedDiff);
		assert.strictEqual(carriedSourcesGitApplyHunksPatch({ unifiedDiff: '' }), undefined);
		const host = {};
		attachSourcesGitApplyHunksPatch(host, '');
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(host), []);
		attachSourcesGitApplyHunksPatch(host, carriedUnifiedDiff);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(host), [carriedUnifiedDiff]);
		assert.strictEqual(carriedSourcesGitApplyHunksPatch(host), carriedUnifiedDiff);
		const rebuilt = {};
		attachCarriedSourcesGitApplyHunksPatch(rebuilt, host);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(rebuilt), [carriedUnifiedDiff]);
		const emptyHost = {};
		attachCarriedSourcesGitApplyHunksPatch(emptyHost, { unifiedDiff: '' });
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(emptyHost), []);
		const resource = URI.file('/project/src/carry.ts');
		const original = URI.file('/project/src/carry.ts.git');
		assert.strictEqual(withCarriedSourcesGitApplyHunksPatch({
			modified: resource,
			original,
			groupId: 'workingTree',
		}, { unifiedDiff: carriedUnifiedDiff }).unifiedDiff, carriedUnifiedDiff);
		assert.strictEqual(withCarriedSourcesGitApplyHunksPatch({
			modified: resource,
			original,
			groupId: 'workingTree',
		}, { unifiedDiff: '' }).unifiedDiff, undefined);
	});

	test('openSourcesChangeEntry carries fetched unifiedDiff onto the panel change ref', async function () {
		const resource = toResource.call(this, '/project/src/carry-panel.ts');
		const entry: ISourcesChangeEntry = {
			resource,
			name: 'carry-panel.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/carry-panel.ts',
			indexState: 'WORKTREE',
		};
		let shown: ISourcesChangeRef | undefined;
		const models = new Map<string, string>();

		await openSourcesChangeEntry(entry, {
			editorService: { openEditor: async () => undefined } as unknown as IEditorService,
			quickDiffService: { getQuickDiffs: async () => [] } as unknown as IQuickDiffService,
			configurationService: new TestConfigurationService({ 'sources.diff.defaultOwner': 'panel' }),
			instantiationService: {
				createInstance: () => { throw new Error('panel open must not create ConversationDiffReviewInput'); },
			} as unknown as ISourcesChangeEntryOpenDeps['instantiationService'],
			sourcesDiffPanelService: {
				show: async (ref: ISourcesChangeRef) => { shown = ref; },
			} as unknown as ISourcesDiffPanelService,
			modelService: {
				getModel: (uri: URI) => models.has(uri.toString()) ? { uri } : null,
				updateModel: (model: { uri: URI }, value: string) => { models.set(model.uri.toString(), value); },
				createModel: (value: string, _language: unknown, uri?: URI) => {
					if (uri) {
						models.set(uri.toString(), value);
					}
					return { uri };
				},
			} as unknown as IModelService,
			readGitFileDiff: async () => ({
				supported: true,
				reason: '',
				path: 'src/carry-panel.ts',
				unifiedDiff: carriedUnifiedDiff,
			}),
		}, { preserveFocus: false });

		assert.strictEqual(shown?.unifiedDiff, carriedUnifiedDiff);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(shown), [carriedUnifiedDiff]);
	});

	test('openSourcesChangeEntry attaches fetched unifiedDiff for Conversation Accept', async function () {
		const resource = toResource.call(this, '/project/src/carry-review.ts');
		const entry: ISourcesChangeEntry = {
			resource,
			name: 'carry-review.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/carry-review.ts',
			indexState: 'WORKTREE',
		};
		let opened: ConversationDiffReviewInput | undefined;
		const models = new Map<string, string>();

		await openSourcesChangeEntry(entry, {
			editorService: {
				openEditor: async (input: unknown) => {
					if (input instanceof ConversationDiffReviewInput) {
						opened = input;
					}
					return undefined;
				},
			} as unknown as IEditorService,
			quickDiffService: { getQuickDiffs: async () => [] } as unknown as IQuickDiffService,
			configurationService: new TestConfigurationService({ 'sources.diff.defaultOwner': 'conversation' }),
			instantiationService: {
				createInstance: (ctor: typeof ConversationDiffReviewInput, modified: URI, original?: URI, groupId?: string) =>
					store.add(new ctor(modified, original, groupId)),
			} as unknown as ISourcesChangeEntryOpenDeps['instantiationService'],
			sourcesDiffPanelService: {
				show: async () => { throw new Error('conversation open must not show the panel'); },
			} as unknown as ISourcesDiffPanelService,
			modelService: {
				getModel: (uri: URI) => models.has(uri.toString()) ? { uri } : null,
				updateModel: (model: { uri: URI }, value: string) => { models.set(model.uri.toString(), value); },
				createModel: (value: string, _language: unknown, uri?: URI) => {
					if (uri) {
						models.set(uri.toString(), value);
					}
					return { uri };
				},
			} as unknown as IModelService,
			readGitFileDiff: async () => ({
				supported: true,
				reason: '',
				path: 'src/carry-review.ts',
				unifiedDiff: carriedUnifiedDiff,
			}),
		}, { preserveFocus: false });

		assert.ok(opened);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(opened), [carriedUnifiedDiff]);
	});

	test('openSourcesChangeEntry attaches fetched unifiedDiff for Preview then Conversation Accept', async function () {
		const resource = toResource.call(this, '/project/src/carry-preview.ts');
		const entry: ISourcesChangeEntry = {
			resource,
			name: 'carry-preview.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/carry-preview.ts',
			indexState: 'WORKTREE',
		};
		const instantiationService = workbenchInstantiationService(undefined, store);
		const models = new Map<string, string>();
		const editorState = {
			activeEditor: undefined as DiffEditorInput | ConversationDiffReviewInput | undefined,
			closed: [] as object[],
		};

		const editorService = {
			get activeEditor() { return editorState.activeEditor; },
			activeEditorPane: { group: { id: 1 } },
			closeEditor: async (ident: { editor: object }) => {
				editorState.closed.push(ident.editor);
				if (editorState.activeEditor === ident.editor) {
					editorState.activeEditor = undefined;
				}
			},
			openEditor: async (input: unknown) => {
				if (input instanceof ConversationDiffReviewInput) {
					store.add(input);
					editorState.activeEditor = input;
					return { input };
				}
				const untyped = input as { original?: { resource?: URI }; modified?: { resource?: URI } };
				if (untyped.original?.resource && untyped.modified?.resource) {
					const originalInput = store.add(new TestEditorInput(untyped.original.resource, 'test.original'));
					const modifiedInput = store.add(new TestEditorInput(untyped.modified.resource, 'test.modified'));
					const diffInput = store.add(instantiationService.createInstance(DiffEditorInput, undefined, undefined, originalInput, modifiedInput, undefined));
					editorState.activeEditor = diffInput;
					return { input: diffInput };
				}
				return undefined;
			},
		} as unknown as IEditorService;

		await openSourcesChangeEntry(entry, {
			editorService,
			quickDiffService: { getQuickDiffs: async () => [] } as unknown as IQuickDiffService,
			configurationService: new TestConfigurationService({ 'sources.diff.defaultOwner': 'preview' }),
			instantiationService,
			sourcesDiffPanelService: {
				show: async () => { throw new Error('preview open must not show the panel'); },
			} as unknown as ISourcesDiffPanelService,
			modelService: {
				getModel: (uri: URI) => models.has(uri.toString()) ? { uri } : null,
				updateModel: (model: { uri: URI }, value: string) => { models.set(model.uri.toString(), value); },
				createModel: (value: string, _language: unknown, uri?: URI) => {
					if (uri) {
						models.set(uri.toString(), value);
					}
					return { uri };
				},
			} as unknown as IModelService,
			readGitFileDiff: async () => ({
				supported: true,
				reason: '',
				path: 'src/carry-preview.ts',
				unifiedDiff: carriedUnifiedDiff,
			}),
		}, { preserveFocus: false });

		const previewHost = editorState.activeEditor;
		assert.ok(previewHost instanceof DiffEditorInput);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(previewHost), [carriedUnifiedDiff]);

		await moveActiveDiffToConversation(editorService, { repositories: [] } as unknown as ISCMService, instantiationService);

		const conversationHost = editorState.activeEditor;
		assert.ok(conversationHost instanceof ConversationDiffReviewInput);
		assert.notStrictEqual(conversationHost, previewHost);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(conversationHost), [carriedUnifiedDiff]);
	});

	test('openSourcesChangeEntry preview first-open leaves whitespace unifiedDiff absent', async function () {
		const resource = toResource.call(this, '/project/src/preview-whitespace.ts');
		const entry: ISourcesChangeEntry = {
			resource,
			name: 'preview-whitespace.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/preview-whitespace.ts',
			indexState: 'WORKTREE',
		};
		const instantiationService = workbenchInstantiationService(undefined, store);
		const models = new Map<string, string>();
		let previewHost: DiffEditorInput | undefined;

		await openSourcesChangeEntry(entry, {
			editorService: {
				get activeEditor() { return previewHost; },
				openEditor: async (input: { original?: { resource?: URI }; modified?: { resource?: URI } }) => {
					if (input.original?.resource && input.modified?.resource) {
						const originalInput = store.add(new TestEditorInput(input.original.resource, 'test.original'));
						const modifiedInput = store.add(new TestEditorInput(input.modified.resource, 'test.modified'));
						previewHost = store.add(instantiationService.createInstance(DiffEditorInput, undefined, undefined, originalInput, modifiedInput, undefined));
						return { input: previewHost };
					}
					return undefined;
				},
			} as unknown as IEditorService,
			quickDiffService: { getQuickDiffs: async () => [] } as unknown as IQuickDiffService,
			configurationService: new TestConfigurationService({ 'sources.diff.defaultOwner': 'preview' }),
			instantiationService,
			sourcesDiffPanelService: {
				show: async () => { throw new Error('preview open must not show the panel'); },
			} as unknown as ISourcesDiffPanelService,
			modelService: {
				getModel: (uri: URI) => models.has(uri.toString()) ? { uri } : null,
				updateModel: (model: { uri: URI }, value: string) => { models.set(model.uri.toString(), value); },
				createModel: (value: string, _language: unknown, uri?: URI) => {
					if (uri) {
						models.set(uri.toString(), value);
					}
					return { uri };
				},
			} as unknown as IModelService,
			readGitFileDiff: async () => ({
				supported: true,
				reason: '',
				path: 'src/preview-whitespace.ts',
				unifiedDiff: '   ',
			}),
		}, { preserveFocus: false });

		assert.ok(previewHost);
		assert.deepStrictEqual(sourcesGitApplyHunksPatches(previewHost), []);
	});

	test('Accept sends the carried unifiedDiff and does not fall back to git.stage', async function () {
		const resource = toResource.call(this, '/project/src/accept-carry.ts');
		const original = toResource.call(this, '/project/src/accept-carry.ts.git');
		const applyCalls: UniverseAgentWriteGitApplyHunksRequest[] = [];
		const gitStageCommands: unknown[] = [];
		const connection = leftoverLooksLiveApplyConnection(applyCalls, [], false);
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, false);
		assert.strictEqual(isConversationPairingHold(connection), false);

		const stageCommand = CommandsRegistry.registerCommand('git.stage', () => { });
		try {
			const instantiationService = stubDiffHonestyServices({
				throwOnLoad: true,
				resource,
				connection,
				executeCommand: async (commandId: unknown) => {
					if (commandId === 'git.stage') {
						gitStageCommands.push(commandId);
					}
				},
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
				unifiedDiff: carriedUnifiedDiff,
			});
			await timeout(50);
			paintPanelWriteChrome(view);

			const panelAccept = view.element.querySelector('.sources-diff-panel-accept') as HTMLButtonElement | null;
			assert.strictEqual(panelAccept?.style.display, '');
			await (view as unknown as { runAccept: () => Promise<void> }).runAccept();
			await timeout(20);
			assert.deepStrictEqual(applyCalls, [{
				sessionId: 'session-1',
				argv: [],
				patches: [carriedUnifiedDiff],
			}]);
			assert.deepStrictEqual(gitStageCommands, []);

			const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
			const parent = document.createElement('div');
			document.body.appendChild(parent);
			store.add({ dispose: () => parent.remove() });
			pane.create(parent);
			const input = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree'));
			attachSourcesGitApplyHunksPatch(input, carriedUnifiedDiff);
			await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
			await timeout(20);
			paintReviewWriteChrome(pane);

			const reviewAccept = parent.querySelector('.conversation-diff-review-accept') as HTMLButtonElement | null;
			assert.strictEqual(reviewAccept?.style.display, '');
			await (pane as unknown as { runAccept: () => Promise<void> }).runAccept();
			await timeout(20);
			assert.deepStrictEqual(applyCalls, [
				{ sessionId: 'session-1', argv: [], patches: [carriedUnifiedDiff] },
				{ sessionId: 'session-1', argv: [], patches: [carriedUnifiedDiff] },
			]);
			assert.deepStrictEqual(gitStageCommands, []);
		} finally {
			stageCommand.dispose();
		}
	});

	test('empty unifiedDiff keeps Accept hidden and sends 0 ApplyHunks', async function () {
		const resource = toResource.call(this, '/project/src/accept-empty.ts');
		const original = toResource.call(this, '/project/src/accept-empty.ts.git');
		const applyCalls: UniverseAgentWriteGitApplyHunksRequest[] = [];
		const connection = leftoverLooksLiveApplyConnection(applyCalls, [], false);

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
			unifiedDiff: '',
		});
		await timeout(50);
		paintPanelWriteChrome(view);

		const panelAccept = view.element.querySelector('.sources-diff-panel-accept') as HTMLButtonElement | null;
		assert.strictEqual(panelAccept?.style.display, 'none');
		forceClick(panelAccept);
		await (view as unknown as { runAccept: () => Promise<void> }).runAccept();
		await timeout(20);
		assert.deepStrictEqual(applyCalls, []);
	});
});

