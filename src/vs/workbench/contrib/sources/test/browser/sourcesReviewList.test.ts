/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, getErrorMessage, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { localize } from '../../../../../nls.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { getSelectionKeyboardEvent, WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { CodeEditorWidget } from '../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { workbenchInstantiationService, TestEditorGroupView } from '../../../../test/browser/workbenchTestServices.js';
import { IViewDescriptorService, IViewContainerModel, ViewContainerLocation } from '../../../../common/views.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { isConversationPairingHold } from '../../../conversation/browser/conversationSessionStatus.js';
import { IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';
import { ISCMResource, ISCMService } from '../../../scm/common/scm.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import { ConversationDiffReviewInput } from '../../browser/conversationDiffReviewInput.js';
import '../../browser/conversationDiffReview.contribution.js';
import { conversationDiffComparisonLoadFailedMessage, ConversationDiffReviewPane } from '../../browser/conversationDiffReviewPane.js';
import { EditorPanes } from '../../../../browser/parts/editor/editorPanes.js';
import { emptyProgressRunner, IEditorProgressService } from '../../../../../platform/progress/common/progress.js';
import { openSourcesChangeEntry, openSourcesChangeInConversation, sourcesConversationLeafMissingMessage } from '../../browser/sourcesChangeEntryOpen.js';
import { fireSourcesDiffLoad, onDidSourcesDiffLoad } from '../../browser/sourcesDiffLoadSignal.js';
import { createSourcesConversationOpenHarness } from './sourcesConversationOpenHarness.js';
import { SourcesChangesList } from '../../browser/sourcesChangesList.js';
import { SourcesDiffPanelService } from '../../browser/sourcesDiffPanelService.js';
import { sourcesDiffPanelComparisonLoadFailedMessage, SourcesDiffPanelView } from '../../browser/sourcesDiffPanelView.js';
import { SOURCES_DIFF_PANEL_VIEW_ID } from '../../browser/sourcesDiffPanelIds.js';
import { SourcesReviewList } from '../../browser/sourcesReviewList.js';
import { sourcesGitDiffOpenFailureMessage, sourcesGitEmptyFileDiffMessage, sourcesGitLocalOnlyMessage, sourcesGitReadFailureMessage, sourcesGitReadPairingHoldMessage, sourcesGitReadUnavailableNoHookMessage } from '../../common/sourcesChangesGitRead.js';
import { ISourcesChangeEntry, ISourcesChangesModel, ISourcesChangesSnapshot } from '../../common/sourcesChangesModel.js';
import { SourcesChangesModel } from '../../common/sourcesChangesReadModel.js';
import { SOURCES_DIFF_DEFAULT_OWNER_SETTING } from '../../common/sourcesDiffConfiguration.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';
import { ISourcesReviewAttributionService } from '../../common/sourcesReviewAttribution.js';
import { ISourcesReviewHostService, ISourcesReviewListHost } from '../../common/sourcesReviewHostService.js';
import {
	SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND,
	SOURCES_REVIEW_OPEN_SELECTED_COMMAND,
	SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND,
} from '../../browser/sourcesReviewCommands.contribution.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService, ServiceIdentifier, ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import {
	countReviewProgress,
	filterReviewEntries,
	markReviewedAfterSuccessfulOpen,
	reviewListEmptyReason,
} from '../../common/sourcesReviewListModel.js';
import { SourcesReviewProgressService } from '../../browser/sourcesReviewProgressService.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { buildSourcesReviewProgressKey, ISourcesReviewProgressBucket, ISourcesReviewProgressKey, ISourcesReviewProgressService, sourcesReviewProgressTarget } from '../../common/sourcesReviewProgress.js';

suite('Sources - review list model', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createThrowingGitConnection(): IUniverseAgentConnection {
		return createGitConnection({ throwOnRead: true });
	}

	function deniedWriteResult() {
		return {
			supported: true,
			reason: '',
			success: false,
			errorMessage: 'denied',
			exitCode: 1,
			stdout: '',
		};
	}

	function createGitConnection(options: {
		throwOnRead?: boolean;
		throwOnStage?: boolean;
		throwOnCommit?: boolean;
		failOnStage?: boolean;
		failOnCommit?: boolean;
		unsupportedChanges?: boolean;
		unsupportedCommit?: boolean;
		connected?: boolean;
		emptyFileDiff?: boolean;
		emptyEntries?: boolean;
	} = {}): IUniverseAgentConnection {
		return {
			isEngineConnected: () => options.connected ?? true,
			getConnectionPhase: () => ({ kind: (options.connected ?? true) ? 'connected' as const : 'disconnected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitChanges: async () => {
				if (options.throwOnRead) {
					throw new Error('boom');
				}
				return {
					supported: !options.unsupportedChanges,
					reason: '',
					branch: 'main',
					entries: (options.unsupportedChanges || options.emptyEntries) ? [] : [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
				};
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
			readGitFileDiff: async () => ({
				supported: true,
				reason: '',
				path: 'src/a.ts',
				unifiedDiff: options.emptyFileDiff ? '' : '@@ -1 +1 @@\n-old\n+new\n',
			}),
			...(options.throwOnStage || options.failOnStage ? {
				writeGitStagePaths: async () => {
					if (options.throwOnStage) {
						throw new Error('boom');
					}
					return deniedWriteResult();
				},
			} : {}),
			...(options.throwOnCommit || options.failOnCommit || options.unsupportedCommit ? {
				writeGitCommit: async () => {
					if (options.throwOnCommit) {
						throw new Error('boom');
					}
					if (options.unsupportedCommit) {
						return {
							supported: false,
							reason: '',
							success: false,
							errorMessage: '',
							exitCode: 0,
							stdout: '',
						};
					}
					return deniedWriteResult();
				},
			} : {}),
		} as unknown as IUniverseAgentConnection;
	}

	function createEmptyScmService(): ISCMService {
		return {
			_serviceBrand: undefined,
			get repositories() { return []; },
			get repositoryCount() { return 0; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService;
	}

	function createNoGitReadConnection(): IUniverseAgentConnection {
		return {
			isEngineConnected: () => false,
			getConnectionPhase: () => ({ kind: 'disconnected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
		} as unknown as IUniverseAgentConnection;
	}

	function createIndexScmService(resource: URI): ISCMService {
		const group = {
			id: 'index',
			label: 'Staged Changes',
			resources: [] as ISCMResource[],
		};
		const scmResource = {
			sourceUri: resource,
			resourceGroup: group,
			decorations: {},
			contextValue: undefined,
			command: undefined,
			multiDiffEditorOriginalUri: undefined,
			multiDiffEditorModifiedUri: undefined,
			open: async () => { },
		} as unknown as ISCMResource;
		group.resources.push(scmResource);

		const repository = {
			provider: {
				groups: [group],
				onDidChangeResources: Event.None,
				onDidChangeResourceGroups: Event.None,
				inputBoxTextModel: { setValue: () => { } },
			},
			input: {
				value: '',
				setValue: () => { },
				onDidChange: Event.None,
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

	function createRoster(sessionId = 'session-1', engineSessionReady = true): IConversationRosterService {
		return {
			getActiveSessionId: () => sessionId,
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: Event.None,
			isEngineSessionReady: () => engineSessionReady,
		} as unknown as IConversationRosterService;
	}

	function createSessionContext(connection: IUniverseAgentConnection, roster: IConversationRosterService): IAgentSessionContext {
		return {
			_serviceBrand: undefined,
			getActiveSessionId: () => roster.getActiveSessionId(),
			isEngineSessionReady: () => roster.isEngineSessionReady(),
			isPairingHold: () => {
				if (typeof connection.getConnectionPhase !== 'function' || typeof connection.getConnectionSnapshot !== 'function') {
					return false;
				}
				return connection.getConnectionPhase()?.kind === 'connected' && !!connection.getConnectionSnapshot()?.pairingPending;
			},
			onDidChangeActiveSession: roster.onDidChangeActiveSession,
			onDidChangeSession: roster.onDidChangeSession,
			acquireSessionView: () => { throw new Error('not used'); },
		};
	}

	function stubSourcesGitListServices(options: {
		connection?: IUniverseAgentConnection;
		scmService?: ISCMService;
		roster?: IConversationRosterService;
		getQuickDiffs?: () => Promise<unknown>;
		markReviewed?: () => void;
		markAllReviewed?: () => void;
		executeCommand?: (...args: unknown[]) => Promise<unknown>;
		openEditor?: (input: unknown) => Promise<unknown>;
	} = {}) {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const connection = options.connection ?? createThrowingGitConnection();
		const roster = options.roster ?? createRoster();
		instantiationService.stub(IUniverseAgentConnection, connection);
		instantiationService.stub(ISCMService, options.scmService ?? createEmptyScmService());
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IAgentSessionContext, createSessionContext(connection, roster));
		instantiationService.stub(ISourcesChangesModel, store.add(instantiationService.createInstance(SourcesChangesModel)));
		instantiationService.stub(IQuickDiffService, {
			getQuickDiffs: options.getQuickDiffs ?? (async () => []),
		} as unknown as IQuickDiffService);
		if (options.openEditor) {
			instantiationService.stub(IEditorService, {
				openEditor: options.openEditor,
			} as unknown as IEditorService);
		}
		instantiationService.stub(ISourcesDiffPanelService, {
			onDidChangeRef: Event.None,
			getCurrentRef: () => undefined,
			show: async () => { },
			clear: () => { },
		} as unknown as ISourcesDiffPanelService);
		instantiationService.stub(ICommandService, {
			onWillExecuteCommand: Event.None,
			onDidExecuteCommand: Event.None,
			executeCommand: options.executeCommand ?? (async () => undefined),
		} as unknown as ICommandService);
		instantiationService.stub(ISourcesReviewProgressService, {
			onDidChange: Event.None,
			hasReviewed: () => false,
			isReviewed: () => false,
			isEntryReviewed: () => false,
			getReviewedKey: () => undefined,
			markReviewed: options.markReviewed ?? (() => { }),
			markUnreviewed: () => { },
			markAllReviewed: options.markAllReviewed ?? (() => { }),
			noteRefreshedKey: () => { },
			resolveKey: async () => ({ origin: 'scm' as const, sessionId: '', scopeKeyId: 'root', path: '', contentHash: '' }),
			pruneMissingKeys: () => { },
		} as unknown as ISourcesReviewProgressService);
		instantiationService.stub(ISourcesReviewAttributionService, {
			onDidChange: Event.None,
			isAttributionEnabled: () => false,
			getWorkDirMismatchNote: () => undefined,
			getAttributionHeaderSuffix: () => undefined,
			resolveRevealItemId: () => undefined,
			buildChipMapForEntries: () => new Map(),
		} as unknown as ISourcesReviewAttributionService);
		return instantiationService;
	}

	function stubThrowOnLoadTextModelService(instantiationService: ReturnType<typeof stubSourcesGitListServices>): void {
		instantiationService.stub(ITextModelService, {
			createModelReference: async () => {
				throw new Error('boom');
			},
		} as unknown as ITextModelService);
	}

	async function openFailedConversationPane(
		instantiationService: ReturnType<typeof stubSourcesGitListServices>,
		input: unknown,
	): Promise<ConversationDiffReviewPane> {
		const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		pane.create(parent);
		if (input instanceof ConversationDiffReviewInput) {
			store.add(input);
			await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
		}
		return pane;
	}

	function createReviewDiffViewDescriptorService(): IViewDescriptorService {
		return {
			getViewLocationById: () => ViewContainerLocation.Panel,
			onDidChangeLocation: Event.None,
			getViewDescriptorById: () => null,
			getViewContainerByViewId: () => ({
				id: 'workbench.view.sourcesDiff',
				title: { value: 'Diff', original: 'Diff' },
			}),
			getViewContainerModel: () => ({
				onDidChangeContainerInfo: Event.None,
			} as IViewContainerModel),
			getDefaultContainerById: () => null,
		} as unknown as IViewDescriptorService;
	}

	function mountLoadFailedPanel(
		instantiationService: ReturnType<typeof stubSourcesGitListServices>,
	): SourcesDiffPanelService {
		instantiationService.stub(IViewDescriptorService, createReviewDiffViewDescriptorService());
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
		document.body.appendChild(view.element);
		store.add({ dispose: () => view.element.remove() });
		return panelService;
	}

	async function waitForStatusText(host: HTMLElement, selector: string, contains?: string): Promise<string> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			const text = host.querySelector(selector)?.textContent ?? '';
			if (text && (!contains || text.includes(contains))) {
				return text;
			}
			await timeout(20);
		}
		throw new Error(`status ${selector} stayed empty${contains ? ` (wanted ${contains})` : ''}`);
	}

	function statusIsError(host: HTMLElement): boolean {
		return !!host.querySelector('.sources-review-status')?.classList.contains('is-error');
	}

	function mountListHost(): HTMLElement {
		const host = document.createElement('div');
		host.style.width = '400px';
		host.style.height = '300px';
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });
		return host;
	}

	async function waitForList(owner: { list?: WorkbenchList<unknown> }): Promise<WorkbenchList<unknown>> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			if (owner.list && owner.list.length > 0) {
				owner.list.layout(120, 400);
				return owner.list;
			}
			await timeout(20);
		}
		throw new Error('list stayed empty');
	}

	async function openFirstListRow(owner: { list?: WorkbenchList<unknown> }): Promise<void> {
		const list = await waitForList(owner);
		list.setFocus([0]);
		list.setSelection([0], getSelectionKeyboardEvent('keydown', false, false));
	}

	async function selectFirstListRow(owner: { list?: WorkbenchList<unknown> }): Promise<void> {
		const list = await waitForList(owner);
		list.setFocus([0]);
		list.setSelection([0]);
	}

	function hostFromReviewList(widget: SourcesReviewList): ISourcesReviewListHost {
		return {
			selectReviewTab: () => { },
			setPathFilter: () => { },
			getSelectedEntry: () => widget.getSelectedEntry(),
			toggleReviewedSelected: () => widget.toggleReviewedSelected(),
			markAllReviewed: () => widget.markAllReviewed(),
			setStatusMessage: (message, isError) => widget.setStatusMessage(message, isError),
		};
	}

	function forceClick(button: HTMLElement | null): void {
		if (!button) {
			return;
		}
		button.classList.remove('disabled');
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

	function markAllButton(host: HTMLElement): HTMLElement | null {
		return host.querySelector('.sources-review-progress-header .monaco-button');
	}

	function stubAccessorForReviewCommands(host: ISourcesReviewListHost): ServicesAccessor {
		const hostService = {
			getReviewListHost: () => host,
		};
		return {
			get: <T,>(id: ServiceIdentifier<T>) => {
				if (id === ISourcesReviewHostService) {
					return hostService as T;
				}
				throw new Error(`unexpected service ${String(id)}`);
			},
		};
	}

	function stubAccessorForOpenSelected(
		instantiationService: ReturnType<typeof stubSourcesGitListServices>,
		host: ISourcesReviewListHost,
		openEditor: (input: unknown) => Promise<unknown>,
		modelService?: IModelService,
	): ServicesAccessor {
		const hostService = {
			getReviewListHost: () => host,
		};
		return {
			get: <T,>(id: ServiceIdentifier<T>) => {
				if (id === ISourcesReviewHostService) {
					return hostService as T;
				}
				if (id === ISourcesReviewProgressService) {
					return instantiationService.invokeFunction(accessor => accessor.get(ISourcesReviewProgressService)) as T;
				}
				if (id === IEditorService) {
					return { openEditor } as T;
				}
				if (id === IQuickDiffService) {
					return instantiationService.invokeFunction(accessor => accessor.get(IQuickDiffService)) as T;
				}
				if (id === IConfigurationService) {
					return instantiationService.invokeFunction(accessor => accessor.get(IConfigurationService)) as T;
				}
				if (id === IInstantiationService) {
					return instantiationService as T;
				}
				if (id === ISourcesDiffPanelService) {
					return instantiationService.invokeFunction(accessor => accessor.get(ISourcesDiffPanelService)) as T;
				}
				if (id === IModelService) {
					return (modelService ?? instantiationService.invokeFunction(accessor => accessor.get(IModelService))) as T;
				}
				if (id === IUniverseAgentConnection) {
					return instantiationService.invokeFunction(accessor => accessor.get(IUniverseAgentConnection)) as T;
				}
				if (id === ISourcesChangesModel) {
					return instantiationService.invokeFunction(accessor => accessor.get(ISourcesChangesModel)) as T;
				}
				if (id === IAgentSessionContext) {
					return instantiationService.invokeFunction(accessor => accessor.get(IAgentSessionContext)) as T;
				}
				if (id === IEditorGroupsService) {
					return instantiationService.invokeFunction(accessor => accessor.get(IEditorGroupsService)) as T;
				}
				throw new Error(`unexpected service ${String(id)}`);
			},
		};
	}

	async function waitForEnabledButton(host: HTMLElement, selector: string): Promise<HTMLElement> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			for (const button of host.querySelectorAll(selector)) {
				if (!button.classList.contains('disabled')) {
					return button as HTMLElement;
				}
			}
			await timeout(20);
		}
		throw new Error(`enabled button ${selector} not found`);
	}

	function entry(resource: URI): ISourcesChangeEntry {
		return {
			resource,
			name: resource.path.split('/').pop() ?? '',
			description: 'Changes',
			groupId: 'workingTree',
		};
	}

	test('filterReviewEntries applies text, path-set, and unreviewed toggle with AND semantics', function () {
		const a = entry(toResource.call(this, '/project/a.ts'));
		const b = entry(toResource.call(this, '/project/b.ts'));
		const c = entry(toResource.call(this, '/project/c.ts'));
		const reviewed = new Set([a.resource.toString()]);

		const pathFiltered = filterReviewEntries(
			[a, b, c],
			'',
			[a.resource, c.resource],
			false,
			e => reviewed.has(e.resource.toString()),
		);
		assert.deepStrictEqual(pathFiltered.map(e => e.name), ['a.ts', 'c.ts']);

		const unreviewedOnly = filterReviewEntries(
			[a, b, c],
			'',
			undefined,
			true,
			e => reviewed.has(e.resource.toString()),
		);
		assert.deepStrictEqual(unreviewedOnly.map(e => e.name), ['b.ts', 'c.ts']);

		const textAndPath = filterReviewEntries(
			[a, b, c],
			'b',
			[b.resource],
			false,
			e => reviewed.has(e.resource.toString()),
		);
		assert.deepStrictEqual(textAndPath.map(e => e.name), ['b.ts']);
	});

	test('path filter banner counts the visible intersection, not the path filter length', function () {
		const hit = entry(toResource.call(this, '/project/hit.ts'));
		const other = entry(toResource.call(this, '/project/other.ts'));
		const pathFilter = [
			hit.resource,
			toResource.call(this, '/project/missing-1.ts'),
			toResource.call(this, '/project/missing-2.ts'),
			toResource.call(this, '/project/missing-3.ts'),
			toResource.call(this, '/project/missing-4.ts'),
		];
		assert.strictEqual(pathFilter.length, 5);
		assert.strictEqual(filterReviewEntries([hit, other], '', pathFilter, false, () => false).length, 1);

		const { model, snapshot } = mutableChangesModel();
		snapshot.current = {
			generation: 1,
			settled: true,
			state: { kind: 'scm' },
			entries: [hit, other],
		};
		const instantiationService = stubSourcesGitListServices({ connection: createNoGitReadConnection() });
		instantiationService.stub(ISourcesChangesModel, model);
		const host = mountListHost();
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';
		widget.setPathFilter(pathFilter);

		const list = (widget as unknown as { list?: WorkbenchList<unknown> }).list;
		assert.ok(list);
		assert.strictEqual(list.length, 1);
		const banner = host.querySelector('.sources-review-path-filter') as HTMLElement;
		const count = host.querySelector('.sources-review-path-filter-count');
		assert.strictEqual(count?.textContent, localize('sourcesReviewList.pathFilterCount', "Showing {0} files from this turn", 1));
		assert.notStrictEqual(count?.textContent, localize('sourcesReviewList.pathFilterCount', "Showing {0} files from this turn", 5));
		assert.strictEqual(banner.style.display, 'block');

		widget.setPathFilter(undefined);
		assert.strictEqual(banner.style.display, 'none');
	});

	test('path filter banner follows the unreviewed-only toggle', function () {
		const hit = entry(toResource.call(this, '/project/hit.ts'));
		const also = entry(toResource.call(this, '/project/also.ts'));
		const reviewed = new Set([hit.resource.toString()]);
		const { model, snapshot } = mutableChangesModel();
		snapshot.current = {
			generation: 1,
			settled: true,
			state: { kind: 'scm' },
			entries: [hit, also],
		};
		const instantiationService = stubSourcesGitListServices({ connection: createNoGitReadConnection() });
		instantiationService.stub(ISourcesChangesModel, model);
		instantiationService.stub(ISourcesReviewProgressService, {
			onDidChange: Event.None,
			hasReviewed: () => reviewed.size > 0,
			isReviewed: () => false,
			isEntryReviewed: (target: { resource: URI }) => reviewed.has(target.resource.toString()),
			getReviewedKey: () => undefined,
			markReviewed: () => { },
			markUnreviewed: () => { },
			markAllReviewed: () => { },
			noteRefreshedKey: () => { },
			resolveKey: async () => ({ origin: 'scm' as const, sessionId: '', scopeKeyId: 'root', path: '', contentHash: '' }),
			pruneMissingKeys: () => { },
		} as unknown as ISourcesReviewProgressService);
		const host = mountListHost();
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';
		widget.setPathFilter([hit.resource, also.resource]);

		const list = (widget as unknown as { list?: WorkbenchList<unknown>; visibleEntries?: { name: string }[] }).list;
		const visible = () => (widget as unknown as { visibleEntries: { name: string }[] }).visibleEntries;
		assert.ok(list);
		assert.deepStrictEqual(visible().map(row => row.name), ['hit.ts', 'also.ts']);
		assert.strictEqual(list.length, 2);
		const countText = () => host.querySelector('.sources-review-path-filter-count')?.textContent;
		assert.strictEqual(countText(), localize('sourcesReviewList.pathFilterCount', "Showing {0} files from this turn", 2));
		assert.strictEqual(
			host.querySelector('.sources-review-progress-count')?.textContent,
			localize('sourcesReviewList.reviewProgress', "Reviewed {0} / {1}", 1, 2),
		);

		const toggle = host.querySelector('.sources-review-unreviewed-toggle input') as HTMLInputElement;
		toggle.checked = true;
		toggle.dispatchEvent(new mainWindow.Event('change'));

		assert.deepStrictEqual(visible().map(row => row.name), ['also.ts']);
		assert.strictEqual(list.length, 1);
		assert.strictEqual(countText(), localize('sourcesReviewList.pathFilterCount', "Showing {0} files from this turn", 1));
		assert.strictEqual(
			host.querySelector('.sources-review-progress-count')?.textContent,
			localize('sourcesReviewList.reviewProgress', "Reviewed {0} / {1}", 1, 2),
		);
	});

	test('reviewListEmptyReason distinguishes unreviewed-done, path miss, and text miss', function () {
		const a = entry(toResource.call(this, '/project/a.ts'));
		const b = entry(toResource.call(this, '/project/b.ts'));
		const reviewed = new Set([a.resource.toString(), b.resource.toString()]);
		const isReviewed = (e: ISourcesChangeEntry) => reviewed.has(e.resource.toString());

		assert.strictEqual(
			reviewListEmptyReason(true, [a, b], '', undefined, true, isReviewed),
			'unreviewedDone',
		);
		assert.strictEqual(
			reviewListEmptyReason(true, [a, b], '', [toResource.call(this, '/project/other.ts')], false, () => false),
			'pathNoIntersection',
		);
		assert.strictEqual(
			reviewListEmptyReason(true, [a, b], 'zzz', undefined, false, () => false),
			'textFilterEmpty',
		);
		assert.strictEqual(
			reviewListEmptyReason(true, [a, b], '', undefined, false, () => false),
			undefined,
		);
	});

	test('countReviewProgress reports reviewed and total', function () {
		const entries = [
			entry(toResource.call(this, '/project/a.ts')),
			entry(toResource.call(this, '/project/b.ts')),
		];
		const reviewed = new Set([entries[0].resource.toString()]);
		const counts = countReviewProgress(entries, e => reviewed.has(e.resource.toString()));
		assert.deepStrictEqual(counts, { reviewed: 1, total: 2 });
	});

	test('markReviewedAfterSuccessfulOpen marks only when open is true', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const marked: ISourcesReviewProgressKey[] = [];
		let shouldFail = false;

		await markReviewedAfterSuccessfulOpen(
			async () => {
				if (shouldFail) {
					throw new Error('open failed');
				}
				return true;
			},
			async () => ({ origin: 'scm' as const, sessionId: '', scopeKeyId: 'root', path: resource.toString(), contentHash: 'etag' }),
			key => marked.push(key),
			resource,
		);

		assert.strictEqual(marked.length, 1);

		shouldFail = true;
		await assert.rejects(() => markReviewedAfterSuccessfulOpen(
			async () => { throw new Error('open failed'); },
			async () => ({ origin: 'scm' as const, sessionId: '', scopeKeyId: 'root', path: resource.toString(), contentHash: 'etag' }),
			key => marked.push(key),
			resource,
		));
		assert.strictEqual(marked.length, 1);
	});

	test('markReviewedAfterSuccessfulOpen does not mark when open throws comparison load failure', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const marked: ISourcesReviewProgressKey[] = [];
		await assert.rejects(() => markReviewedAfterSuccessfulOpen(
			async () => {
				throw new Error(conversationDiffComparisonLoadFailedMessage());
			},
			async () => ({ origin: 'scm' as const, sessionId: '', scopeKeyId: 'root', path: resource.toString(), contentHash: 'etag' }),
			key => marked.push(key),
			resource,
		));
		assert.strictEqual(marked.length, 0);
	});

	test('markReviewedAfterSuccessfulOpen ignores stale and false without marking', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const marked: ISourcesReviewProgressKey[] = [];
		const resolveKey = async () => ({ origin: 'scm' as const, sessionId: '', scopeKeyId: 'root', path: resource.toString(), contentHash: 'etag' });
		await markReviewedAfterSuccessfulOpen(async () => 'stale', resolveKey, key => marked.push(key), resource);
		await markReviewedAfterSuccessfulOpen(async () => false, resolveKey, key => marked.push(key), resource);
		assert.strictEqual(marked.length, 0);
	});

	function mutableChangesModel(): { model: ISourcesChangesModel; snapshot: { current: ISourcesChangesSnapshot } } {
		const snapshot = {
			current: {
				generation: 0,
				settled: false,
				state: { kind: 'scm' },
				entries: [],
			} as ISourcesChangesSnapshot,
		};
		const model = {
			_serviceBrand: undefined,
			onDidChange: Event.None,
			getSnapshot: () => snapshot.current,
			isWriteClosed: () => false,
			isFileDiffOpenSkipped: () => false,
			refresh: async () => { },
			scheduleRefresh: () => { },
			flushScheduledRefresh: () => { },
		} as unknown as ISourcesChangesModel;
		return { model, snapshot };
	}

	type ReviewEnsureInternals = {
		ensureEntryKeys: (entries: readonly ISourcesChangeEntry[], generation?: number) => Promise<void>;
	};

	test('ensureEntryKeys returns before await when the changes generation already moved', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const reviewEntry: ISourcesChangeEntry = { ...entry(resource), origin: 'engine', sessionId: 'session-a', gitPath: 'a.ts' };
		let resolveCalls = 0;
		let pruneCalls = 0;
		let noted = 0;
		const { model, snapshot } = mutableChangesModel();
		const instantiationService = stubSourcesGitListServices({ connection: createNoGitReadConnection() });
		instantiationService.stub(ISourcesChangesModel, model);
		instantiationService.stub(ISourcesReviewProgressService, {
			onDidChange: Event.None,
			hasReviewed: () => true,
			isReviewed: () => true,
			isEntryReviewed: () => true,
			getReviewedKey: () => undefined,
			markReviewed: () => { },
			markUnreviewed: () => { },
			markAllReviewed: () => { },
			noteRefreshedKey: () => { noted++; },
			resolveKey: async () => {
				resolveCalls++;
				return { origin: 'engine' as const, sessionId: 'session-a', scopeKeyId: '', path: resource.toString(), contentHash: 'h' };
			},
			pruneMissingKeys: () => { pruneCalls++; },
		} as unknown as ISourcesReviewProgressService);

		const widget = store.add(instantiationService.createInstance(SourcesReviewList, mountListHost()));
		snapshot.current = {
			generation: 2,
			settled: true,
			state: { kind: 'engine-live', sessionId: 'session-a' },
			entries: [reviewEntry],
		};
		await (widget as unknown as ReviewEnsureInternals).ensureEntryKeys([reviewEntry], 1);

		assert.strictEqual(resolveCalls, 0);
		assert.strictEqual(noted, 0);
		assert.strictEqual(pruneCalls, 0);
	});

	test('ensureEntryKeys does not prune when a round stuck on resolveKey is stale', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const reviewEntry: ISourcesChangeEntry = { ...entry(resource), origin: 'engine', sessionId: 'session-a', gitPath: 'a.ts' };
		let releaseResolve!: () => void;
		const resolvePending = new Promise<void>(resolve => { releaseResolve = resolve; });
		let pruneCalls = 0;
		let noted = 0;
		const { model, snapshot } = mutableChangesModel();
		const instantiationService = stubSourcesGitListServices({ connection: createNoGitReadConnection() });
		instantiationService.stub(ISourcesChangesModel, model);
		instantiationService.stub(ISourcesReviewProgressService, {
			onDidChange: Event.None,
			hasReviewed: () => true,
			isReviewed: () => true,
			isEntryReviewed: () => true,
			getReviewedKey: () => undefined,
			markReviewed: () => { },
			markUnreviewed: () => { },
			markAllReviewed: () => { },
			noteRefreshedKey: () => { noted++; },
			resolveKey: async () => {
				await resolvePending;
				return { origin: 'engine' as const, sessionId: 'session-a', scopeKeyId: '', path: resource.toString(), contentHash: 'h' };
			},
			pruneMissingKeys: () => { pruneCalls++; },
		} as unknown as ISourcesReviewProgressService);

		const widget = store.add(instantiationService.createInstance(SourcesReviewList, mountListHost()));
		snapshot.current = {
			generation: 1,
			settled: true,
			state: { kind: 'engine-live', sessionId: 'session-a' },
			entries: [reviewEntry],
		};
		const ensurePromise = (widget as unknown as ReviewEnsureInternals).ensureEntryKeys([reviewEntry], 1);
		snapshot.current = { ...snapshot.current, generation: 2 };
		releaseResolve();
		await ensurePromise;

		assert.strictEqual(noted, 0);
		assert.strictEqual(pruneCalls, 0);
	});

	test('ensureEntryKeys prunes only a successful read of the current bucket', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		const reviewEntry = entry(resource);
		const pruned: ISourcesReviewProgressBucket[] = [];
		const { model, snapshot } = mutableChangesModel();
		const instantiationService = stubSourcesGitListServices({ connection: createNoGitReadConnection() });
		instantiationService.stub(ISourcesChangesModel, model);
		instantiationService.stub(ISourcesReviewProgressService, {
			onDidChange: Event.None,
			hasReviewed: () => true,
			isReviewed: () => false,
			isEntryReviewed: () => false,
			getReviewedKey: () => undefined,
			markReviewed: () => { },
			markUnreviewed: () => { },
			markAllReviewed: () => { },
			noteRefreshedKey: () => { },
			resolveKey: async () => { throw new Error('unreviewed refresh must not resolve'); },
			pruneMissingKeys: (bucket: ISourcesReviewProgressBucket) => { pruned.push(bucket); },
		} as unknown as ISourcesReviewProgressService);

		const widget = store.add(instantiationService.createInstance(SourcesReviewList, mountListHost()));
		const ensure = (widget as unknown as ReviewEnsureInternals).ensureEntryKeys.bind(widget);

		snapshot.current = {
			generation: 1,
			settled: true,
			failureMessage: 'Unable to read git changes',
			state: { kind: 'scm' },
			entries: [reviewEntry],
		};
		await ensure([reviewEntry], 1);
		snapshot.current = {
			generation: 2,
			settled: true,
			state: { kind: 'engine-leftover', sessionId: 'session-a', reason: 'read-failed' },
			entries: [{ ...reviewEntry, origin: 'engine', sessionId: 'session-a' }],
		};
		await ensure(snapshot.current.entries, 2);
		assert.deepStrictEqual(pruned, []);

		snapshot.current = {
			generation: 3,
			settled: true,
			state: { kind: 'scm' },
			entries: [reviewEntry],
		};
		await ensure([reviewEntry], 3);
		snapshot.current = {
			generation: 4,
			settled: true,
			state: { kind: 'engine-live', sessionId: 'session-b' },
			entries: [{ ...reviewEntry, origin: 'engine', sessionId: 'session-b', gitPath: 'a.ts' }],
		};
		await ensure(snapshot.current.entries, 4);
		assert.deepStrictEqual(pruned, [
			{ origin: 'scm', sessionId: '' },
			{ origin: 'engine', sessionId: 'session-b' },
		]);
	});

	test('refresh stats only entries that are already reviewed', async function () {
		const resourceA = toResource.call(this, '/project/a.ts');
		const resourceB = toResource.call(this, '/project/b.ts');
		let stats = 0;
		let etag = 'h1';
		const fileService = {
			stat: async () => {
				stats++;
				return { etag };
			},
			onDidFilesChange: Event.None,
		} as unknown as IFileService;
		const scmService = { getRepository: () => undefined } as unknown as ISCMService;
		const connection = {
			onDidFileMutation: Event.None,
			getConnectionSnapshot: () => ({ workDir: '/project' }),
		} as unknown as IUniverseAgentConnection;
		const progress = store.add(new SourcesReviewProgressService(fileService, scmService, connection));
		const entryA = entry(resourceA);
		const entryB = entry(resourceB);
		const { model, snapshot } = mutableChangesModel();
		const instantiationService = stubSourcesGitListServices({ connection: createNoGitReadConnection() });
		instantiationService.stub(ISourcesChangesModel, model);
		instantiationService.stub(ISourcesReviewProgressService, progress);
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, mountListHost()));
		const ensure = (widget as unknown as ReviewEnsureInternals).ensureEntryKeys.bind(widget);

		snapshot.current = {
			generation: 1,
			settled: true,
			state: { kind: 'scm' },
			entries: [entryA, entryB],
		};
		stats = 0;
		await ensure([entryA, entryB], 1);
		assert.strictEqual(stats, 0, 'empty reviewed set does not stat on refresh');

		const marked = await progress.resolveKey(sourcesReviewProgressTarget(entryA));
		progress.markReviewed(marked);
		assert.strictEqual(stats, 1);
		stats = 0;
		etag = 'h2';
		snapshot.current = { ...snapshot.current, generation: 2 };
		await ensure([entryA, entryB], 2);
		assert.strictEqual(stats, 1, 'only the reviewed path is stat');
		assert.strictEqual(progress.isReviewed(marked), false);
		assert.strictEqual(progress.isEntryReviewed(sourcesReviewProgressTarget(entryA)), false);
	});

	test('a successful read of another session does not delete the previous session key', async function () {
		const resourceA = toResource.call(this, '/project/a.ts');
		const resourceB = toResource.call(this, '/project/b.ts');
		let stats = 0;
		const fileService = {
			stat: async () => {
				stats++;
				return { etag: 'e' };
			},
			onDidFilesChange: Event.None,
		} as unknown as IFileService;
		const scmService = { getRepository: () => undefined } as unknown as ISCMService;
		const connection = {
			onDidFileMutation: Event.None,
			getConnectionSnapshot: () => ({ workDir: '/project' }),
		} as unknown as IUniverseAgentConnection;
		const progress = store.add(new SourcesReviewProgressService(fileService, scmService, connection));
		const keyA: ISourcesReviewProgressKey = {
			origin: 'engine',
			sessionId: 'session-a',
			scopeKeyId: '',
			path: resourceA.toString(),
			contentHash: 'turn-a\0tc-a',
			gitPath: 'a.ts',
		};
		const keyB: ISourcesReviewProgressKey = {
			origin: 'engine',
			sessionId: 'session-b',
			scopeKeyId: '',
			path: resourceB.toString(),
			contentHash: 'turn-b\0tc-b',
			gitPath: 'b.ts',
		};
		progress.markReviewed(keyA);
		progress.markReviewed(keyB);

		const { model, snapshot } = mutableChangesModel();
		const instantiationService = stubSourcesGitListServices({ connection: createNoGitReadConnection() });
		instantiationService.stub(ISourcesChangesModel, model);
		instantiationService.stub(ISourcesReviewProgressService, progress);
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, mountListHost()));

		snapshot.current = {
			generation: 4,
			settled: true,
			state: { kind: 'engine-live', sessionId: 'session-b' },
			entries: [],
		};
		stats = 0;
		await (widget as unknown as ReviewEnsureInternals).ensureEntryKeys([], 4);

		assert.strictEqual(stats, 0);
		assert.strictEqual(progress.isReviewed(keyA), true);
		assert.strictEqual(progress.isReviewed(keyB), false);
	});

	test('openSourcesChangeEntry conversation load-fail returns false and still hands the pane', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const original = toResource.call(this, '/project/src/a.ts.git');
		const instantiationService = stubSourcesGitListServices({
			connection: createNoGitReadConnection(),
		});
		stubThrowOnLoadTextModelService(instantiationService);
		let editorOpens = 0;
		const harness = createSourcesConversationOpenHarness(store, {
			openEditor: async input => openFailedConversationPane(instantiationService, input),
		});

		const opened = await openSourcesChangeEntry({
			resource,
			name: 'a.ts',
			description: 'Changes',
			groupId: 'workingTree',
		}, {
			editorService: {
				openEditor: async () => {
					editorOpens++;
					return undefined;
				},
			} as unknown as IEditorService,
			quickDiffService: {
				getQuickDiffs: async () => [{ originalResource: original, id: 'git', label: 'Git', kind: 'primary' }],
			} as unknown as IQuickDiffService,
			configurationService: new TestConfigurationService({ [SOURCES_DIFF_DEFAULT_OWNER_SETTING]: 'conversation' }),
			instantiationService: {
				createInstance: (ctor: typeof ConversationDiffReviewInput, modified: URI, originalUri?: URI, groupId?: string) =>
					store.add(new ctor(modified, originalUri, groupId)),
			} as unknown as IInstantiationService,
			sourcesDiffPanelService: { show: async () => false } as unknown as ISourcesDiffPanelService,
			editorGroupsService: harness.editorGroupsService,
			session: harness.session,
		}, { preserveFocus: false });

		assert.strictEqual(opened, false);
		assert.strictEqual(editorOpens, 0);
		assert.ok(harness.opened[0] instanceof ConversationDiffReviewInput);
	});

	test('openSourcesChangeEntry panel load-fail returns false from show()', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const original = toResource.call(this, '/project/src/a.ts.git');
		const instantiationService = stubSourcesGitListServices({
			connection: createNoGitReadConnection(),
		});
		stubThrowOnLoadTextModelService(instantiationService);
		const panelService = mountLoadFailedPanel(instantiationService);

		const opened = await openSourcesChangeEntry({
			resource,
			name: 'a.ts',
			description: 'Changes',
			groupId: 'workingTree',
		}, {
			editorService: { openEditor: async () => undefined } as unknown as IEditorService,
			quickDiffService: {
				getQuickDiffs: async () => [{ originalResource: original, id: 'git', label: 'Git', kind: 'primary' }],
			} as unknown as IQuickDiffService,
			configurationService: new TestConfigurationService({ [SOURCES_DIFF_DEFAULT_OWNER_SETTING]: 'panel' }),
			instantiationService,
			sourcesDiffPanelService: panelService,
		}, { preserveFocus: false });

		assert.strictEqual(opened, false);
		assert.ok(document.body.textContent?.includes(sourcesDiffPanelComparisonLoadFailedMessage()));
	});

	test('Review list conversation comparison load-fail does not mark reviewed', async function () {
		const host = mountListHost();
		let marked = 0;
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection(),
			markReviewed: () => { marked += 1; },
		});
		stubThrowOnLoadTextModelService(instantiationService);
		const configurationService = instantiationService.invokeFunction(accessor => accessor.get(IConfigurationService)) as TestConfigurationService;
		await configurationService.setUserConfiguration(SOURCES_DIFF_DEFAULT_OWNER_SETTING, 'conversation');
		let editorOpens = 0;
		const harness = createSourcesConversationOpenHarness(store, {
			openEditor: async input => openFailedConversationPane(instantiationService, input),
		});
		instantiationService.stub(IEditorService, {
			openEditor: async () => {
				editorOpens++;
				return undefined;
			},
		} as unknown as IEditorService);
		instantiationService.stub(IEditorGroupsService, harness.editorGroupsService);
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		await openFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

		const status = await waitForStatusText(host, '.sources-review-status', 'Unable to load this comparison');
		assert.strictEqual(status, sourcesGitDiffOpenFailureMessage(new Error(conversationDiffComparisonLoadFailedMessage())));
		assert.ok(statusIsError(host));
		assert.strictEqual(marked, 0);
		assert.strictEqual(editorOpens, 0);
		assert.ok(harness.opened[0] instanceof ConversationDiffReviewInput);
	});

	test('Review list panel comparison load-fail does not mark reviewed', async function () {
		const host = mountListHost();
		let marked = 0;
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection(),
			markReviewed: () => { marked += 1; },
		});
		stubThrowOnLoadTextModelService(instantiationService);
		const configurationService = instantiationService.invokeFunction(accessor => accessor.get(IConfigurationService)) as TestConfigurationService;
		await configurationService.setUserConfiguration(SOURCES_DIFF_DEFAULT_OWNER_SETTING, 'panel');
		mountLoadFailedPanel(instantiationService);
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		await openFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

		const status = await waitForStatusText(host, '.sources-review-status', 'Unable to load this comparison');
		assert.strictEqual(status, sourcesGitDiffOpenFailureMessage(new Error(sourcesDiffPanelComparisonLoadFailedMessage())));
		assert.ok(statusIsError(host));
		assert.strictEqual(marked, 0);
	});

	test('Open Selected conversation comparison load-fail does not mark reviewed', async function () {
		const host = mountListHost();
		let marked = 0;
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection(),
			markReviewed: () => { marked += 1; },
		});
		stubThrowOnLoadTextModelService(instantiationService);
		const configurationService = instantiationService.invokeFunction(accessor => accessor.get(IConfigurationService)) as TestConfigurationService;
		await configurationService.setUserConfiguration(SOURCES_DIFF_DEFAULT_OWNER_SETTING, 'conversation');
		let editorOpens = 0;
		const harness = createSourcesConversationOpenHarness(store, {
			openEditor: async input => openFailedConversationPane(instantiationService, input),
		});
		instantiationService.stub(IEditorGroupsService, harness.editorGroupsService);
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });
		const accessor = stubAccessorForOpenSelected(instantiationService, hostFromReviewList(widget), async () => {
			editorOpens++;
			return undefined;
		});
		await CommandsRegistry.getCommand(SOURCES_REVIEW_OPEN_SELECTED_COMMAND)?.handler?.(accessor);

		const status = await waitForStatusText(host, '.sources-review-status', 'Unable to load this comparison');
		assert.strictEqual(status, sourcesGitDiffOpenFailureMessage(new Error(conversationDiffComparisonLoadFailedMessage())));
		assert.ok(statusIsError(host));
		assert.strictEqual(marked, 0);
		assert.strictEqual(editorOpens, 0);
		assert.ok(harness.opened[0] instanceof ConversationDiffReviewInput);
	});

	test('conversation open treats undefined as failure before a load event', async function () {
		const resource = toResource.call(this, '/project/src/undefined-pane.ts');
		const instantiationService = workbenchInstantiationService(undefined, store);
		const harness = createSourcesConversationOpenHarness(store, {
			openEditor: async input => {
				if (input instanceof ConversationDiffReviewInput) {
					store.add(input);
					fireSourcesDiffLoad({ resource: input.modified, generation: input.loadGeneration, ok: true });
				}
				return undefined;
			},
		});
		const marked: ISourcesReviewProgressKey[] = [];
		const opened = await markOpened(resource, () => openSourcesChangeInConversation({
			modified: resource,
			original: undefined,
			groupId: 'workingTree',
		}, {
			editorService: { openEditor: async () => { throw new Error('conversation open must not use editorService.openEditor'); } } as unknown as IEditorService,
			quickDiffService: { getQuickDiffs: async () => [] } as unknown as IQuickDiffService,
			configurationService: new TestConfigurationService(),
			instantiationService,
			sourcesDiffPanelService: { show: async () => { throw new Error('conversation open must not show the panel'); } } as unknown as ISourcesDiffPanelService,
			editorGroupsService: harness.editorGroupsService,
			session: harness.session,
		}, {}), marked);
		assert.strictEqual(opened, false);
		assert.strictEqual(marked.length, 0);
	});

	function conversationOpenDeps(
		instantiationService: ReturnType<typeof workbenchInstantiationService>,
		harness: ReturnType<typeof createSourcesConversationOpenHarness>,
	) {
		return {
			editorService: { openEditor: async () => { throw new Error('conversation open must not use editorService.openEditor'); } } as unknown as IEditorService,
			quickDiffService: { getQuickDiffs: async () => [] } as unknown as IQuickDiffService,
			configurationService: new TestConfigurationService(),
			instantiationService,
			sourcesDiffPanelService: { show: async () => { throw new Error('conversation open must not show the panel'); } } as unknown as ISourcesDiffPanelService,
			editorGroupsService: harness.editorGroupsService,
			session: harness.session,
		};
	}

	function bareComparisonRef(resource: URI) {
		return { modified: resource, original: undefined, groupId: '' };
	}

	async function markOpened(
		resource: URI,
		open: () => Promise<boolean | 'stale'>,
		marked: ISourcesReviewProgressKey[],
	): Promise<boolean | 'stale'> {
		let opened: boolean | 'stale' = false;
		await markReviewedAfterSuccessfulOpen(
			async () => {
				opened = await open();
				return opened;
			},
			async () => ({ origin: 'scm' as const, sessionId: '', scopeKeyId: 'root', path: resource.toString(), contentHash: 'etag' }),
			key => marked.push(key),
			resource,
		);
		return opened;
	}

	async function withSetInputCallCount<T>(run: (calls: () => number) => Promise<T>): Promise<T> {
		const original = ConversationDiffReviewPane.prototype.setInput;
		let calls = 0;
		ConversationDiffReviewPane.prototype.setInput = async function (this: ConversationDiffReviewPane, ...args: Parameters<ConversationDiffReviewPane['setInput']>) {
			calls++;
			return original.apply(this, args);
		};
		try {
			return await run(() => calls);
		} finally {
			ConversationDiffReviewPane.prototype.setInput = original;
		}
	}

	function prepareConversationDiffServices(instantiationService: ReturnType<typeof workbenchInstantiationService>): void {
		const connection = createGitConnection();
		const roster = createRoster();
		instantiationService.stub(IUniverseAgentConnection, connection);
		instantiationService.stub(ISCMService, createEmptyScmService());
		instantiationService.stub(IAgentSessionContext, createSessionContext(connection, roster));
		instantiationService.stub(ISourcesChangesModel, store.add(instantiationService.createInstance(SourcesChangesModel)));
		instantiationService.stub(ICommandService, {
			onWillExecuteCommand: Event.None,
			onDidExecuteCommand: Event.None,
			executeCommand: async () => undefined,
		} as unknown as ICommandService);
		instantiationService.stubInstance(CodeEditorWidget, {
			setModel() { },
			layout() { },
			focus() { },
			dispose() { },
			getModel() { return null; },
		} as unknown as CodeEditorWidget);
		instantiationService.stub(IEditorProgressService, {
			show: () => emptyProgressRunner,
			showWhile: <T>(promise: Promise<T>) => promise,
		} as unknown as IEditorProgressService);
	}

	function stubComparisonModels(instantiationService: ReturnType<typeof workbenchInstantiationService>, failResource?: URI): void {
		instantiationService.stub(ITextModelService, {
			createModelReference: async (resource: URI) => {
				if (failResource && resource.toString() === failResource.toString()) {
					throw new Error('boom');
				}
				const model = store.add(instantiationService.invokeFunction(accessor => accessor.get(IModelService)).createModel('hello', null, resource));
				return {
					object: { textEditorModel: model },
					dispose() { },
				};
			},
		} as unknown as ITextModelService);
	}

	function createConversationEditorPanes(instantiationService: ReturnType<typeof workbenchInstantiationService>): EditorPanes {
		prepareConversationDiffServices(instantiationService);
		const groupParent = document.createElement('div');
		const panesParent = document.createElement('div');
		groupParent.appendChild(panesParent);
		document.body.appendChild(groupParent);
		store.add({ dispose: () => groupParent.remove() });
		return store.add(instantiationService.createInstance(EditorPanes, groupParent, panesParent, new TestEditorGroupView(7)));
	}

	function harnessThroughEditorPanes(panes: EditorPanes, handed: { pane: unknown }) {
		return createSourcesConversationOpenHarness(store, {
			openEditor: async input => {
				store.add(input);
				const result = await panes.openEditor(input, { preserveFocus: true }, undefined, Object.create(null));
				if (result.cancelled) {
					handed.pane = undefined;
					return undefined;
				}
				handed.pane = result.pane;
				return result.pane;
			},
		});
	}

	test('reveal through editor panes skips setInput and marks an already ok comparison', async function () {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const resource = toResource.call(this, '/project/src/reveal.ts');
		stubComparisonModels(instantiationService);
		const panes = createConversationEditorPanes(instantiationService);
		const seed = store.add(new ConversationDiffReviewInput(resource));
		const seeded = await panes.openEditor(seed, { preserveFocus: true }, undefined, Object.create(null));
		assert.strictEqual(seeded.cancelled, false);
		const seededPane = seeded.pane;
		assert.ok(seededPane instanceof ConversationDiffReviewPane);
		assert.strictEqual(seededPane.getComparisonLoadState(), 'ok');
		assert.strictEqual(seededPane.input, seed);

		const handed: { pane: unknown } = { pane: undefined };
		const harness = harnessThroughEditorPanes(panes, handed);
		const marked: ISourcesReviewProgressKey[] = [];
		await withSetInputCallCount(async calls => {
			const opened = await markOpened(resource, () => openSourcesChangeInConversation(
				bareComparisonRef(resource),
				conversationOpenDeps(instantiationService, harness),
				{ preserveFocus: true },
			), marked);
			assert.strictEqual(calls(), 0);
			assert.strictEqual(opened, true);
			assert.strictEqual(marked.length, 1);
		});
		assert.ok(handed.pane instanceof ConversationDiffReviewPane);
		assert.strictEqual(seededPane.input, seed);
		assert.strictEqual(seededPane.getComparisonLoadState(), 'ok');
		assert.ok(harness.opened[0] instanceof ConversationDiffReviewInput);
		assert.notStrictEqual(harness.opened[0], seed);
		assert.strictEqual((harness.opened[0] as ConversationDiffReviewInput).matches(seed), true);
	});

	test('first setInput failure still returns the pane and a failed reveal does not mark', async function () {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const resource = toResource.call(this, '/project/src/fail.ts');
		stubComparisonModels(instantiationService, resource);
		const panes = createConversationEditorPanes(instantiationService);
		const handed: { pane: unknown } = { pane: undefined };
		const events: { generation: number; ok: boolean }[] = [];
		store.add(onDidSourcesDiffLoad(event => events.push({ generation: event.generation, ok: event.ok })));
		const harness = harnessThroughEditorPanes(panes, handed);
		const marked: ISourcesReviewProgressKey[] = [];
		await withSetInputCallCount(async calls => {
			const first = await markOpened(resource, () => openSourcesChangeInConversation(
				bareComparisonRef(resource),
				conversationOpenDeps(instantiationService, harness),
				{ preserveFocus: true },
			), marked);
			assert.strictEqual(calls(), 1);
			assert.strictEqual(first, false);
			assert.strictEqual(marked.length, 0);
			assert.ok(handed.pane instanceof ConversationDiffReviewPane);
			assert.strictEqual((handed.pane as ConversationDiffReviewPane).getComparisonLoadState(), 'fail');
			assert.ok(document.body.textContent?.includes(conversationDiffComparisonLoadFailedMessage()));
			assert.strictEqual(events.length, 1);
			assert.strictEqual(events[0].ok, false);

			const second = await markOpened(resource, () => openSourcesChangeInConversation(
				bareComparisonRef(resource),
				conversationOpenDeps(instantiationService, harness),
				{ preserveFocus: true },
			), marked);
			assert.strictEqual(calls(), 1);
			assert.strictEqual(second, false);
			assert.strictEqual(marked.length, 0);
			assert.ok(handed.pane instanceof ConversationDiffReviewPane);
			assert.strictEqual((handed.pane as ConversationDiffReviewPane).getComparisonLoadState(), 'fail');
			assert.strictEqual(events.length, 1);
		});
		const firstInput = harness.opened[0] as ConversationDiffReviewInput;
		const secondInput = harness.opened[1] as ConversationDiffReviewInput;
		assert.strictEqual(secondInput.matches(firstInput), true);
		assert.notStrictEqual(secondInput.loadGeneration, firstInput.loadGeneration);
	});

	test('a later open of a different comparison does not reuse the earlier ok', async function () {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const resourceA = toResource.call(this, '/project/src/gen-a.ts');
		const resourceB = toResource.call(this, '/project/src/gen-b.ts');
		stubComparisonModels(instantiationService, resourceB);
		const panes = createConversationEditorPanes(instantiationService);
		const handed: { pane: unknown } = { pane: undefined };
		const events: { generation: number; ok: boolean }[] = [];
		store.add(onDidSourcesDiffLoad(event => events.push({ generation: event.generation, ok: event.ok })));
		const harness = harnessThroughEditorPanes(panes, handed);
		const marked: ISourcesReviewProgressKey[] = [];
		await withSetInputCallCount(async calls => {
			const first = await markOpened(resourceA, () => openSourcesChangeInConversation(
				bareComparisonRef(resourceA),
				conversationOpenDeps(instantiationService, harness),
				{ preserveFocus: true },
			), marked);
			assert.strictEqual(calls(), 1);
			assert.strictEqual(first, true);
			assert.strictEqual(marked.length, 1);
			assert.strictEqual(events.length, 1);
			assert.strictEqual(events[0].ok, true);
			const genA = events[0].generation;
			assert.ok(handed.pane instanceof ConversationDiffReviewPane);
			assert.strictEqual((handed.pane as ConversationDiffReviewPane).getComparisonLoadState(), 'ok');

			const second = await markOpened(resourceB, () => openSourcesChangeInConversation(
				bareComparisonRef(resourceB),
				conversationOpenDeps(instantiationService, harness),
				{ preserveFocus: true },
			), marked);
			assert.strictEqual(calls(), 2);
			assert.strictEqual(second, false);
			assert.strictEqual(marked.length, 1);
			assert.ok(handed.pane instanceof ConversationDiffReviewPane);
			assert.strictEqual((handed.pane as ConversationDiffReviewPane).getComparisonLoadState(), 'fail');
			const later = events.filter(event => event.generation !== genA);
			assert.strictEqual(later.length, 1);
			assert.strictEqual(later[0].ok, false);
			assert.ok(!events.some(event => event.generation === later[0].generation && event.ok));
		});
		const firstInput = harness.opened[0] as ConversationDiffReviewInput;
		const secondInput = harness.opened[1] as ConversationDiffReviewInput;
		assert.strictEqual(firstInput.matches(secondInput), false);
		assert.notStrictEqual(firstInput.modified.toString(), secondInput.modified.toString());
		assert.ok(document.body.textContent?.includes(conversationDiffComparisonLoadFailedMessage()));
	});

	test('preview open resolves true when the editor promise resolves', async function () {
		const resource = toResource.call(this, '/project/src/preview.ts');
		const opened = await openSourcesChangeEntry({
			resource,
			name: 'preview.ts',
			description: 'Changes',
			groupId: '',
		}, {
			editorService: { openEditor: async () => undefined } as unknown as IEditorService,
			quickDiffService: { getQuickDiffs: async () => [] } as unknown as IQuickDiffService,
			configurationService: new TestConfigurationService({ [SOURCES_DIFF_DEFAULT_OWNER_SETTING]: 'preview' }),
			instantiationService: workbenchInstantiationService(undefined, store),
			sourcesDiffPanelService: { show: async () => { throw new Error('preview must not show the panel'); } } as unknown as ISourcesDiffPanelService,
		}, { preserveFocus: false });
		assert.strictEqual(opened, true);
	});

	function spyPanelWriteActions(): { count: () => number; restore: () => void } {
		const proto = SourcesDiffPanelView.prototype as unknown as { updateWriteActions(): void };
		const original = proto.updateWriteActions;
		let calls = 0;
		proto.updateWriteActions = function (this: { updateWriteActions(): void }) {
			calls++;
			return original.call(this);
		};
		return {
			count: () => calls,
			restore: () => {
				proto.updateWriteActions = original;
			},
		};
	}

	function stubPanelCodeEditor(instantiationService: ReturnType<typeof stubSourcesGitListServices>): void {
		instantiationService.stubInstance(CodeEditorWidget, {
			setModel() { },
			layout() { },
			focus() { },
			dispose() { },
			getModel() { return null; },
		} as unknown as CodeEditorWidget);
	}

	function stubPanelTextModel(instantiationService: ReturnType<typeof stubSourcesGitListServices>, fail: boolean): void {
		instantiationService.stub(ITextModelService, {
			createModelReference: async (resource: URI) => {
				if (fail) {
					throw new Error('boom');
				}
				const model = store.add(instantiationService.invokeFunction(accessor => accessor.get(IModelService)).createModel('hello', null, resource));
				return {
					object: { textEditorModel: model },
					dispose() { },
				};
			},
		} as unknown as ITextModelService);
	}

	test('panel show joins the first paint and returns true only after the header is drawn', async function () {
		const resource = toResource.call(this, '/project/src/ok.ts');
		const instantiationService = stubSourcesGitListServices({ connection: createNoGitReadConnection() });
		stubPanelCodeEditor(instantiationService);
		stubPanelTextModel(instantiationService, false);
		instantiationService.stub(IViewDescriptorService, createReviewDiffViewDescriptorService());
		let view: SourcesDiffPanelView | undefined;
		instantiationService.stub(IViewsService, {
			openView: async () => {
				view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
					id: SOURCES_DIFF_PANEL_VIEW_ID,
					title: 'Diff',
				}));
				view.render();
				document.body.appendChild(view.element);
				store.add({ dispose: () => view?.element.remove() });
				return null;
			},
			onDidChangeViewVisibility: Event.None,
			onDidChangeViewContainerVisibility: Event.None,
		} as unknown as IViewsService);
		const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
		instantiationService.stub(ISourcesDiffPanelService, panelService);
		const events: { generation: number; ok: boolean }[] = [];
		store.add(onDidSourcesDiffLoad(event => events.push({ generation: event.generation, ok: event.ok })));
		const writes = spyPanelWriteActions();
		const marked: ISourcesReviewProgressKey[] = [];
		try {
			const opened = await markOpened(resource, () => panelService.show({
				modified: resource,
				original: undefined,
				groupId: 'workingTree',
			}), marked);
			assert.strictEqual(opened, true);
			assert.strictEqual(marked.length, 1);
			assert.strictEqual(events.length, 1);
			assert.strictEqual(events[0].ok, true);
			assert.ok(writes.count() >= 1);
			const header = view?.element.querySelector('.sources-diff-panel-header') as HTMLElement | null;
			assert.strictEqual(header?.style.display, '');
			assert.strictEqual(view?.element.querySelector('.sources-diff-panel-title')?.textContent, 'ok.ts');
		} finally {
			writes.restore();
		}
	});

	test('panel show joins the failure paint and does not treat renderRef resolve as success', async function () {
		const resource = toResource.call(this, '/project/src/bad.ts');
		const original = toResource.call(this, '/project/src/bad.ts.git');
		const instantiationService = stubSourcesGitListServices({ connection: createNoGitReadConnection() });
		stubPanelTextModel(instantiationService, true);
		const panelService = mountLoadFailedPanel(instantiationService);
		const events: { generation: number; ok: boolean }[] = [];
		store.add(onDidSourcesDiffLoad(event => events.push({ generation: event.generation, ok: event.ok })));
		const writes = spyPanelWriteActions();
		const marked: ISourcesReviewProgressKey[] = [];
		try {
			const opened = await markOpened(resource, () => panelService.show({
				modified: resource,
				original,
				groupId: 'workingTree',
			}), marked);
			assert.strictEqual(opened, false);
			assert.strictEqual(marked.length, 0);
			assert.strictEqual(events.length, 1);
			assert.strictEqual(events[0].ok, false);
			assert.strictEqual(writes.count(), 0);
			assert.ok(document.body.textContent?.includes(sourcesDiffPanelComparisonLoadFailedMessage()));
			const header = document.body.querySelector('.sources-diff-panel-header') as HTMLElement | null;
			assert.strictEqual(header?.style.display, 'none');
		} finally {
			writes.restore();
		}
	});

	test('a later review open keeps its status when an older open finishes', async function () {
		const host = mountListHost();
		let marked = 0;
		let diffCalls = 0;
		let releaseLate: (() => void) | undefined;
		const lateGate = new Promise<void>(resolve => { releaseLate = resolve; });
		const connection = createGitConnection();
		connection.readGitFileDiff = async () => {
			diffCalls += 1;
			if (diffCalls === 1) {
				await lateGate;
				throw new Error('late-boom');
			}
			return { supported: false, reason: '', path: 'src/a.ts', unifiedDiff: '' };
		};
		const instantiationService = stubSourcesGitListServices({
			connection,
			markReviewed: () => { marked += 1; },
		});
		const configurationService = instantiationService.invokeFunction(accessor => accessor.get(IConfigurationService)) as TestConfigurationService;
		await configurationService.setUserConfiguration(SOURCES_DIFF_DEFAULT_OWNER_SETTING, 'conversation');
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });
		list.setFocus([0]);
		list.setSelection([0], getSelectionKeyboardEvent('keydown', false, false));
		const started = Date.now() + 2000;
		while (diffCalls < 1 && Date.now() < started) {
			await timeout(10);
		}
		assert.strictEqual(diffCalls, 1);
		list.setSelection([]);
		list.setSelection([0], getSelectionKeyboardEvent('keydown', false, false));
		const expected = sourcesGitDiffOpenFailureMessage(new Error(sourcesConversationLeafMissingMessage()));
		const status = await waitForStatusText(host, '.sources-review-status', expected);
		assert.strictEqual(status, expected);
		assert.strictEqual(marked, 0);
		releaseLate!();
		await timeout(40);
		assert.strictEqual(host.querySelector('.sources-review-status')?.textContent ?? '', status);
		assert.ok(!status.includes('late-boom'));
		assert.strictEqual(marked, 0);
	});

	test('stale review open does not mark reviewed or write an open failure', async function () {
		const host = mountListHost();
		let marked = 0;
		let diffCalls = 0;
		let releaseLate: (() => void) | undefined;
		const lateGate = new Promise<void>(resolve => { releaseLate = resolve; });
		const connection = createGitConnection();
		connection.readGitFileDiff = async () => {
			diffCalls += 1;
			if (diffCalls === 1) {
				await lateGate;
			}
			return { supported: true, reason: '', path: 'src/a.ts', unifiedDiff: '@@ -1 +1 @@\n-old\n+new\n' };
		};
		const instantiationService = stubSourcesGitListServices({
			connection,
			markReviewed: () => { marked += 1; },
			openEditor: async () => undefined,
		});
		const configurationService = instantiationService.invokeFunction(accessor => accessor.get(IConfigurationService)) as TestConfigurationService;
		await configurationService.setUserConfiguration(SOURCES_DIFF_DEFAULT_OWNER_SETTING, 'preview');
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });
		list.setFocus([0]);
		list.setSelection([0], getSelectionKeyboardEvent('keydown', false, false));
		const started = Date.now() + 2000;
		while (diffCalls < 1 && Date.now() < started) {
			await timeout(10);
		}
		list.setSelection([]);
		list.setSelection([0], getSelectionKeyboardEvent('keydown', false, false));
		const markedDeadline = Date.now() + 2000;
		while (marked < 1 && Date.now() < markedDeadline) {
			await timeout(10);
		}
		assert.strictEqual(marked, 1);
		releaseLate!();
		await timeout(40);
		assert.strictEqual(marked, 1);
		assert.ok(!(host.querySelector('.sources-review-status')?.textContent ?? '').includes('Unable to open diff'));
	});

	test('Review list status DOM shows git-read throw', async function () {
		const host = document.createElement('div');
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });

		const instantiationService = stubSourcesGitListServices();
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));

		const status = await waitForStatusText(host, '.sources-review-status');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.ok(status.includes('Unable to read git changes:'));
		assert.ok(status.includes('boom'));
		assert.ok(statusIsError(host));
		assert.strictEqual((widget as unknown as { list?: WorkbenchList<unknown> }).list?.length ?? 0, 0);
		assert.ok(!host.querySelector('.sources-review-list .monaco-list-row'));
		assert.ok(!(host.querySelector('.sources-review-empty')?.textContent ?? '').includes(localize('sourcesReviewList.noChanges', "No changes to review.")));
		assert.ok((host.querySelector('.sources-review-empty')?.textContent ?? '').includes('Unable to read git changes'));
	});

	test('Review list setStatusMessage uses error tone only for throw-style failures', function () {
		const host = document.createElement('div');
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });

		const widget = store.add(stubSourcesGitListServices({
			connection: createNoGitReadConnection(),
		}).createInstance(SourcesReviewList, host));

		widget.setStatusMessage(sourcesGitReadPairingHoldMessage());
		assert.ok(!statusIsError(host));
		widget.setStatusMessage(sourcesGitReadUnavailableNoHookMessage());
		assert.ok(!statusIsError(host));
		widget.setStatusMessage(sourcesGitLocalOnlyMessage());
		assert.ok(!statusIsError(host));
		widget.setStatusMessage(sourcesGitDiffOpenFailureMessage(new Error('boom')));
		assert.ok(statusIsError(host));
		widget.setStatusMessage(sourcesGitReadFailureMessage('boom'));
		assert.ok(statusIsError(host));
		widget.setStatusMessage(undefined);
		assert.ok(!statusIsError(host));
	});

	test('Review list success then git-read throw keeps leftover rows and paints failed', async function () {
		let readCalls = 0;
		let diffCalls = 0;
		let marked = 0;
		const onDidChangeConnection = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		const leftoverPath = 'src/leftover.ts';
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls += 1;
				if (readCalls > 1) {
					throw new Error('boom');
				}
				return {
					supported: true,
					reason: '',
					branch: 'main',
					entries: [{ path: leftoverPath, oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
				};
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
			readGitFileDiff: async () => {
				diffCalls += 1;
				return {
					supported: true,
					reason: '',
					path: leftoverPath,
					unifiedDiff: '@@ -1 +1 @@\n-old\n+new\n',
				};
			},
		} as unknown as IUniverseAgentConnection;

		const host = mountListHost();
		const widget = store.add(stubSourcesGitListServices({
			connection,
			markReviewed: () => { marked += 1; },
		}).createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });
		assert.strictEqual(readCalls, 1);
		assert.strictEqual(list.length, 1);
		assert.strictEqual((list.element(0) as { name?: string }).name, 'leftover.ts');
		assert.strictEqual(host.querySelector('.sources-review-status')?.textContent ?? '', '');
		assert.strictEqual((host.querySelector('.sources-review-empty') as HTMLElement).style.display, 'none');

		onDidChangeConnection.fire({
			transport: 'ok',
			sharedFsRootSent: false,
			pairingPending: false,
			channelAlive: true,
			capabilities: {} as never,
		});

		const status = await waitForStatusText(host, '.sources-review-status', 'Unable to read git changes');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.ok(status.includes('Unable to read git changes:'));
		assert.ok(status.includes('boom'));
		assert.ok(statusIsError(host));
		assert.ok(readCalls >= 2);
		assert.strictEqual((widget as unknown as { list?: WorkbenchList<unknown> }).list?.length ?? 0, 1);
		assert.strictEqual(((widget as unknown as { list?: WorkbenchList<unknown> }).list?.element(0) as { name?: string }).name, 'leftover.ts');
		assert.ok(host.querySelector('.sources-review-list .monaco-list-row'));
		assert.strictEqual((host.querySelector('.sources-review-empty') as HTMLElement).style.display, 'none');
		assert.ok(!(host.querySelector('.sources-review-empty')?.textContent ?? '').includes(localize('sourcesReviewList.noChanges', "No changes to review.")));

		await openFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });
		await timeout(20);
		assert.strictEqual(diffCalls, 0, 'list-fail leftover must not readGitFileDiff');
		assert.strictEqual((widget as unknown as { list?: WorkbenchList<unknown> }).list?.length ?? 0, 1);
		assert.strictEqual(((widget as unknown as { list?: WorkbenchList<unknown> }).list?.element(0) as { name?: string }).name, 'leftover.ts');
		assert.strictEqual(host.querySelector('.sources-review-status')?.textContent ?? '', sourcesGitReadFailureMessage('boom'));
		assert.strictEqual(marked, 0, 'list-fail leftover open must not mark reviewed');
	});

	test('Open Selected leftover list-fail uses the same FileDiff gate as onDidOpen', async function () {
		let readCalls = 0;
		let diffCalls = 0;
		let marked = 0;
		let openCalls = 0;
		const leftoverPath = 'src/leftover.ts';
		const onDidChangeConnection = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls += 1;
				if (readCalls > 1) {
					throw new Error('boom');
				}
				return {
					supported: true,
					reason: '',
					branch: 'main',
					entries: [{ path: leftoverPath, oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
				};
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
			readGitFileDiff: async () => {
				diffCalls += 1;
				return {
					supported: true,
					reason: '',
					path: leftoverPath,
					unifiedDiff: '@@ -1 +1 @@\n-old\n+new\n',
				};
			},
		} as unknown as IUniverseAgentConnection;

		const host = mountListHost();
		const instantiationService = stubSourcesGitListServices({
			connection,
			markReviewed: () => { marked += 1; },
			openEditor: async () => {
				openCalls += 1;
				return undefined;
			},
		});
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });
		onDidChangeConnection.fire({
			transport: 'ok',
			sharedFsRootSent: false,
			pairingPending: false,
			channelAlive: true,
			capabilities: {} as never,
		});
		const status = await waitForStatusText(host, '.sources-review-status', 'Unable to read git changes');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.strictEqual(list.length, 1);

		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });
		const accessor = stubAccessorForOpenSelected(instantiationService, hostFromReviewList(widget), async () => {
			openCalls += 1;
			return undefined;
		});
		await CommandsRegistry.getCommand(SOURCES_REVIEW_OPEN_SELECTED_COMMAND)?.handler?.(accessor);
		await timeout(20);

		assert.strictEqual(diffCalls, 0, 'Open Selected leftover list-fail must not readGitFileDiff');
		assert.strictEqual(openCalls, 0, 'Open Selected leftover list-fail must not fake preview');
		assert.strictEqual(marked, 0, 'Open Selected leftover list-fail must not mark reviewed');
		assert.strictEqual(host.querySelector('.sources-review-status')?.textContent ?? '', sourcesGitReadFailureMessage('boom'));
	});

	test('list-fail leftover closes Mark chrome and forced click stays 0 markReviewed/markAllReviewed', async function () {
		let readCalls = 0;
		let marked = 0;
		let markedAll = 0;
		const leftoverPath = 'src/leftover.ts';
		const onDidChangeConnection = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls += 1;
				if (readCalls > 1) {
					throw new Error('boom');
				}
				return {
					supported: true,
					reason: '',
					branch: 'main',
					entries: [{ path: leftoverPath, oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
				};
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
		} as unknown as IUniverseAgentConnection;

		const host = mountListHost();
		const widget = store.add(stubSourcesGitListServices({
			connection,
			markReviewed: () => { marked += 1; },
			markAllReviewed: () => { markedAll += 1; },
		}).createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });
		onDidChangeConnection.fire({
			transport: 'ok',
			sharedFsRootSent: false,
			pairingPending: false,
			channelAlive: true,
			capabilities: {} as never,
		});
		const status = await waitForStatusText(host, '.sources-review-status', 'Unable to read git changes');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.strictEqual(list.length, 1);

		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });
		const markAll = markAllButton(host);
		assert.ok(markAll, 'Mark all as reviewed is in the progress header');
		assert.strictEqual(markAll.classList.contains('disabled'), true);
		assert.strictEqual(markAll.getAttribute('aria-disabled'), 'true');
		const rowMark = host.querySelector('.sources-review-state') as HTMLButtonElement | null;
		assert.ok(rowMark);
		assert.strictEqual(rowMark.disabled || rowMark.getAttribute('aria-disabled') === 'true' || rowMark.classList.contains('disabled'), true);

		forceClick(markAll);
		forceClick(rowMark);
		widget.markAllReviewed();
		widget.toggleReviewedSelected();
		const accessor = stubAccessorForReviewCommands(hostFromReviewList(widget));
		await CommandsRegistry.getCommand(SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND)?.handler?.(accessor);
		await CommandsRegistry.getCommand(SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND)?.handler?.(accessor);
		await timeout(20);

		assert.strictEqual(marked, 0, 'list-fail leftover must not markReviewed');
		assert.strictEqual(markedAll, 0, 'list-fail leftover must not markAllReviewed');
		assert.strictEqual(host.querySelector('.sources-review-status')?.textContent ?? '', sourcesGitReadFailureMessage('boom'));
		assert.strictEqual(list.length, 1);
	});

	test('KEEP leftover list-fail closes Mark chrome while git-read still succeeds and forced click stays 0 markReviewed/markAllReviewed', async function () {
		let marked = 0;
		let markedAll = 0;
		const leftoverPath = 'src/leftover.ts';
		const roster = createRoster('session-1', false);
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: leftoverPath, oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
		} as unknown as IUniverseAgentConnection;
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, false);
		assert.strictEqual(roster.isEngineSessionReady(), false);

		const host = mountListHost();
		const widget = store.add(stubSourcesGitListServices({
			connection,
			roster,
			markReviewed: () => { marked += 1; },
			markAllReviewed: () => { markedAll += 1; },
		}).createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual(widget.isSourcesKeepLeftoverWrite(), true);
		assert.strictEqual(host.querySelector('.sources-review-status')?.textContent ?? '', '');

		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });
		const markAll = markAllButton(host);
		assert.ok(markAll, 'Mark all as reviewed is in the progress header');
		assert.strictEqual(markAll.classList.contains('disabled'), true);
		assert.strictEqual(markAll.getAttribute('aria-disabled'), 'true');
		const rowMark = host.querySelector('.sources-review-state') as HTMLButtonElement | null;
		assert.ok(rowMark);
		assert.strictEqual(rowMark.disabled || rowMark.getAttribute('aria-disabled') === 'true' || rowMark.classList.contains('disabled'), true);

		forceClick(markAll);
		forceClick(rowMark);
		widget.markAllReviewed();
		widget.toggleReviewedSelected();
		const accessor = stubAccessorForReviewCommands(hostFromReviewList(widget));
		await CommandsRegistry.getCommand(SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND)?.handler?.(accessor);
		await CommandsRegistry.getCommand(SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND)?.handler?.(accessor);
		await timeout(20);

		assert.strictEqual(marked, 0, 'KEEP leftover list-fail must not markReviewed');
		assert.strictEqual(markedAll, 0, 'KEEP leftover list-fail must not markAllReviewed');
		assert.strictEqual(list.length, 1);
	});

	test('Open Selected KEEP leftover still opens FileDiff and does not markReviewed', async function () {
		let marked = 0;
		let diffCalls = 0;
		let openCalls = 0;
		const leftoverPath = 'src/leftover.ts';
		const roster = createRoster('session-1', false);
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: leftoverPath, oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
			readGitFileDiff: async () => {
				diffCalls += 1;
				return {
					supported: true,
					reason: '',
					path: leftoverPath,
					unifiedDiff: '@@ -1 +1 @@\n-old\n+new\n',
				};
			},
		} as unknown as IUniverseAgentConnection;
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, false);
		assert.strictEqual(roster.isEngineSessionReady(), false);

		const host = mountListHost();
		const instantiationService = stubSourcesGitListServices({
			connection,
			roster,
			markReviewed: () => { marked += 1; },
			openEditor: async () => {
				openCalls += 1;
				return undefined;
			},
		});
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual(widget.isSourcesKeepLeftoverWrite(), true);
		assert.strictEqual(widget.isSourcesGitWriteClosed(), true);
		assert.strictEqual(widget.isSourcesGitFileDiffOpenSkipped(), false, 'KEEP leftover must not join the FileDiff read gate');
		assert.strictEqual(host.querySelector('.sources-review-status')?.textContent ?? '', '');

		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });
		const models = new Map<string, string>();
		const accessor = stubAccessorForOpenSelected(instantiationService, hostFromReviewList(widget), async () => {
			openCalls += 1;
			return undefined;
		}, {
			getModel: (uri: { toString(): string }) => models.has(uri.toString()) ? {} : undefined,
			updateModel: (model: { uri?: { toString(): string } }, value: string) => {
				if (model.uri) {
					models.set(model.uri.toString(), value);
				}
			},
			createModel: (_value: string, _language: unknown, uri: { toString(): string }) => {
				models.set(uri.toString(), _value);
				return { uri };
			},
		} as unknown as IModelService);
		await CommandsRegistry.getCommand(SOURCES_REVIEW_OPEN_SELECTED_COMMAND)?.handler?.(accessor);
		await timeout(20);

		assert.ok(diffCalls >= 1, 'KEEP leftover Open Selected must still open FileDiff');
		assert.ok(openCalls >= 1, 'KEEP leftover Open Selected must still open the FileDiff editor');
		assert.strictEqual(marked, 0, 'KEEP leftover Open Selected must not markReviewed');
		assert.strictEqual(list.length, 1);
	});

	test('connected leftover without pairing Mark still marks', async function () {
		let marked = 0;
		let markedAll = 0;
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: 'src/live.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
		} as unknown as IUniverseAgentConnection;

		const host = mountListHost();
		const roster = createRoster('session-1', true);
		const widget = store.add(stubSourcesGitListServices({
			connection,
			roster,
			markReviewed: () => { marked += 1; },
			markAllReviewed: () => { markedAll += 1; },
		}).createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });
		assert.strictEqual(roster.isEngineSessionReady(), true);
		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });
		const markAll = await waitForEnabledButton(host, '.sources-review-progress-header .monaco-button');
		assert.strictEqual(markAll.classList.contains('disabled'), false);
		const rowMark = host.querySelector('.sources-review-state') as HTMLButtonElement | null;
		assert.ok(rowMark);
		assert.strictEqual(rowMark.disabled, false);

		markAll.click();
		await timeout(20);
		assert.strictEqual(markedAll, 1);

		widget.toggleReviewedSelected();
		await timeout(20);
		assert.strictEqual(marked, 1);

		const accessor = stubAccessorForReviewCommands(hostFromReviewList(widget));
		await CommandsRegistry.getCommand(SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND)?.handler?.(accessor);
		await CommandsRegistry.getCommand(SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND)?.handler?.(accessor);
		await timeout(20);
		assert.strictEqual(markedAll, 2);
		assert.strictEqual(marked, 2);
	});

	test('Review list success then missing readGitChanges keeps leftover rows and does not paint local-only', async function () {
		const onDidChangeConnection = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		const leftoverPath = 'src/leftover.ts';
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: leftoverPath, oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
		} as unknown as IUniverseAgentConnection;
		const scmStub = toResource.call(this, '/project/src/scm-stub.ts');
		const host = mountListHost();
		const widget = store.add(stubSourcesGitListServices({
			connection,
			scmService: createIndexScmService(scmStub),
		}).createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual((list.element(0) as { gitPath?: string }).gitPath, leftoverPath);

		delete (connection as { readGitChanges?: unknown }).readGitChanges;
		onDidChangeConnection.fire({
			transport: 'ok',
			sharedFsRootSent: false,
			pairingPending: false,
			channelAlive: true,
			capabilities: {} as never,
		});

		const status = await waitForStatusText(host, '.sources-review-status', 'unavailable');
		assert.strictEqual(status, sourcesGitReadUnavailableNoHookMessage());
		assert.ok(!status.includes('local source control'));
		assert.notStrictEqual(status, sourcesGitLocalOnlyMessage());
		assert.ok(!statusIsError(host));
		assert.strictEqual(list.length, 1);
		assert.strictEqual((list.element(0) as { gitPath?: string }).gitPath, leftoverPath);
		assert.strictEqual((list.element(0) as { scmResource?: unknown }).scmResource, undefined);
	});

	test('Review list success then pairingPending keeps leftover rows and does not paint local-only', async function () {
		let connected = true;
		let pairingPending = false;
		let readCalls = 0;
		const leftoverPath = 'src/leftover.ts';
		const onDidChangeConnection = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		const snapshot = (): import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			sharedFsRootSent: false,
			pairingPending,
			channelAlive: connected,
			capabilities: {} as never,
		});
		const connection = {
			isEngineConnected: () => connected && !pairingPending,
			getConnectionPhase: () => ({ kind: connected ? 'connected' as const : 'disconnected' as const }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls += 1;
				return {
					supported: true,
					reason: '',
					branch: 'main',
					entries: [{ path: leftoverPath, oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
				};
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
		} as unknown as IUniverseAgentConnection;
		const scmStub = toResource.call(this, '/project/src/scm-stub.ts');
		const host = mountListHost();
		const widget = store.add(stubSourcesGitListServices({
			connection,
			scmService: createIndexScmService(scmStub),
		}).createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual((list.element(0) as { gitPath?: string }).gitPath, leftoverPath);
		assert.strictEqual(readCalls, 1);

		pairingPending = true;
		onDidChangeConnection.fire(snapshot());

		const pairingStatus = await waitForStatusText(host, '.sources-review-status', 'not connected');
		assert.strictEqual(pairingStatus, sourcesGitReadPairingHoldMessage());
		assert.ok(pairingStatus.includes('pairing'));
		assert.ok(!pairingStatus.includes('local source control'));
		assert.notStrictEqual(pairingStatus, sourcesGitLocalOnlyMessage());
		assert.ok(!statusIsError(host));
		assert.strictEqual(readCalls, 1);
		assert.strictEqual(list.length, 1);
		assert.strictEqual((list.element(0) as { gitPath?: string }).gitPath, leftoverPath);
		assert.strictEqual((list.element(0) as { scmResource?: unknown }).scmResource, undefined);

		connected = false;
		pairingPending = false;
		onDidChangeConnection.fire(snapshot());

		const disconnectStatus = await waitForStatusText(host, '.sources-review-status', 'local source control');
		assert.strictEqual(disconnectStatus, sourcesGitLocalOnlyMessage());
		assert.ok(!statusIsError(host));
		assert.strictEqual(readCalls, 1);
		assert.strictEqual(list.length, 1);
		assert.ok((list.element(0) as { scmResource?: unknown }).scmResource);
		assert.ok((((list.element(0) as { resource?: { path?: string } }).resource?.path) ?? '').includes('scm-stub.ts'));
	});

	test('leftover-looks-live pairing-hold keeps leftover rows and skips git-read', async function () {
		let connected = true;
		let pairingPending = false;
		let readCalls = 0;
		let diffCalls = 0;
		let marked = 0;
		let openCalls = 0;
		const leftoverPath = 'src/leftover.ts';
		const onDidChangeConnection = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		const snapshot = (): import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			sharedFsRootSent: false,
			pairingPending,
			channelAlive: connected,
			capabilities: {} as never,
		});
		const connection = {
			isEngineConnected: () => connected,
			getConnectionPhase: () => ({ kind: connected ? 'connected' as const : 'disconnected' as const }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls += 1;
				return {
					supported: true,
					reason: '',
					branch: 'main',
					entries: [{ path: leftoverPath, oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
				};
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
			readGitFileDiff: async () => {
				diffCalls += 1;
				throw new Error('must not readGitFileDiff while leftover-looks-live');
			},
		} as unknown as IUniverseAgentConnection;
		const scmStub = toResource.call(this, '/project/src/scm-stub.ts');
		const host = mountListHost();
		const instantiationService = stubSourcesGitListServices({
			connection,
			scmService: createIndexScmService(scmStub),
			markReviewed: () => { marked += 1; },
			openEditor: async () => {
				openCalls += 1;
				return undefined;
			},
		});
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual((list.element(0) as { gitPath?: string }).gitPath, leftoverPath);
		assert.strictEqual(isConversationPairingHold(connection), false);
		const listCallsAfterLoad = readCalls;

		pairingPending = true;
		onDidChangeConnection.fire(snapshot());

		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);
		const pairingStatus = await waitForStatusText(host, '.sources-review-status', 'not connected');
		assert.strictEqual(pairingStatus, sourcesGitReadPairingHoldMessage());
		assert.ok(!pairingStatus.includes('local source control'));
		assert.notStrictEqual(pairingStatus, sourcesGitLocalOnlyMessage());
		assert.strictEqual(readCalls, listCallsAfterLoad, 'leftover-looks-live must not extra readGitChanges');
		assert.strictEqual(list.length, 1);
		assert.strictEqual((list.element(0) as { gitPath?: string }).gitPath, leftoverPath);
		assert.strictEqual((list.element(0) as { scmResource?: unknown }).scmResource, undefined);

		await openFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });
		await timeout(20);
		assert.strictEqual(diffCalls, 0, 'leftover-looks-live must not extra readGitFileDiff');
		assert.strictEqual(openCalls, 0, 'KEEP pairing-hold leftover must not fake preview');
		assert.strictEqual(marked, 0, 'KEEP pairing-hold leftover open must not mark reviewed');
		assert.strictEqual(host.querySelector('.sources-review-status')?.textContent ?? '', sourcesGitReadPairingHoldMessage());
		assert.strictEqual(list.length, 1);
		assert.strictEqual((list.element(0) as { gitPath?: string }).gitPath, leftoverPath);

		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });
		const accessor = stubAccessorForOpenSelected(instantiationService, hostFromReviewList(widget), async () => {
			openCalls += 1;
			return undefined;
		});
		await CommandsRegistry.getCommand(SOURCES_REVIEW_OPEN_SELECTED_COMMAND)?.handler?.(accessor);
		await timeout(20);
		assert.strictEqual(diffCalls, 0, 'Open Selected KEEP pairing-hold leftover must not readGitFileDiff');
		assert.strictEqual(openCalls, 0, 'Open Selected KEEP pairing-hold leftover must not fake preview');
		assert.strictEqual(marked, 0, 'Open Selected KEEP pairing-hold leftover must not mark reviewed');
		assert.strictEqual(host.querySelector('.sources-review-status')?.textContent ?? '', sourcesGitReadPairingHoldMessage());

		connected = false;
		pairingPending = false;
		onDidChangeConnection.fire(snapshot());

		const disconnectStatus = await waitForStatusText(host, '.sources-review-status', 'local source control');
		assert.strictEqual(disconnectStatus, sourcesGitLocalOnlyMessage());
		assert.strictEqual(readCalls, listCallsAfterLoad);
		assert.strictEqual(diffCalls, 0);
		assert.strictEqual(list.length, 1);
		assert.ok((list.element(0) as { scmResource?: unknown }).scmResource);
		assert.ok((((list.element(0) as { resource?: { path?: string } }).resource?.path) ?? '').includes('scm-stub.ts'));
	});

	test('in-flight readGitChanges leftover-looks-live keeps leftover and does not paint fresh live', async function () {
		let connected = true;
		let pairingPending = false;
		let readCalls = 0;
		let resolveInFlight: ((value: {
			supported: boolean;
			reason: string;
			branch: string;
			entries: Array<{ path: string; oldPath: string; kind: string; indexState: string }>;
		}) => void) | undefined;
		const leftoverPath = 'src/leftover.ts';
		const freshLivePath = 'src/fresh-live.ts';
		const onDidChangeConnection = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		const snapshot = (): import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			sharedFsRootSent: false,
			pairingPending,
			channelAlive: connected,
			capabilities: {} as never,
		});
		const connection = {
			isEngineConnected: () => connected,
			getConnectionPhase: () => ({ kind: connected ? 'connected' as const : 'disconnected' as const }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls += 1;
				if (readCalls === 1) {
					return {
						supported: true,
						reason: '',
						branch: 'main',
						entries: [{ path: leftoverPath, oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
					};
				}
				return new Promise(resolve => {
					resolveInFlight = resolve;
				});
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
		} as unknown as IUniverseAgentConnection;
		const scmStub = toResource.call(this, '/project/src/scm-stub.ts');
		const host = mountListHost();
		const widget = store.add(stubSourcesGitListServices({
			connection,
			scmService: createIndexScmService(scmStub),
		}).createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual((list.element(0) as { gitPath?: string }).gitPath, leftoverPath);
		assert.strictEqual(isConversationPairingHold(connection), false);
		assert.strictEqual(readCalls, 1);

		onDidChangeConnection.fire(snapshot());
		const inflightDeadline = Date.now() + 2000;
		while (!resolveInFlight && Date.now() < inflightDeadline) {
			await timeout(20);
		}
		assert.ok(resolveInFlight, 'in-flight readGitChanges must start while still live');
		assert.strictEqual(readCalls, 2);

		pairingPending = true;
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		resolveInFlight({
			supported: true,
			reason: '',
			branch: 'main',
			entries: [{ path: freshLivePath, oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
		});
		const pairingStatus = await waitForStatusText(host, '.sources-review-status', 'not connected');
		assert.strictEqual(pairingStatus, sourcesGitReadPairingHoldMessage());
		assert.ok(!pairingStatus.includes('local source control'));
		assert.notStrictEqual(pairingStatus, sourcesGitLocalOnlyMessage());
		assert.strictEqual(list.length, 1);
		assert.strictEqual((list.element(0) as { gitPath?: string }).gitPath, leftoverPath);
		assert.notStrictEqual((list.element(0) as { gitPath?: string }).gitPath, freshLivePath, 'in-flight leftover-looks-live must not paint fresh live');
		assert.strictEqual((list.element(0) as { scmResource?: unknown }).scmResource, undefined);
	});

	test('Changes list status DOM shows git-read throw', async function () {
		const host = document.createElement('div');
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });

		const instantiationService = stubSourcesGitListServices();
		store.add(instantiationService.createInstance(SourcesChangesList, host));

		const status = await waitForStatusText(host, '.sources-changes-status');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.ok(status.includes('Unable to read git changes:'));
		assert.ok(status.includes('boom'));
	});

	test('empty roster session does not call git-read; Changes stay on SCM empty copy', async function () {
		let changeCalls = 0;
		const host = document.createElement('div');
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });

		const instantiationService = stubSourcesGitListServices({
			roster: createRoster(''),
			connection: {
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected' as const }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
				onDidChangeConnection: Event.None,
				readGitChanges: async () => {
					changeCalls += 1;
					throw new Error('boom');
				},
				readGitSummary: async () => {
					throw new Error('boom');
				},
			} as unknown as IUniverseAgentConnection,
		});
		store.add(instantiationService.createInstance(SourcesChangesList, host));

		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			const empty = host.querySelector('.sources-changes-empty')?.textContent ?? '';
			if (empty.includes('No source control repository')) {
				assert.strictEqual(changeCalls, 0);
				assert.strictEqual(host.querySelector('.sources-changes-status')?.textContent ?? '', '');
				return;
			}
			await timeout(20);
		}
		throw new Error('Changes list did not stay on SCM empty copy');
	});

	type ReviewMenuAction = { id: string; label: string; run(): Promise<void>; dispose(): void };

	function stubReviewContextMenu(instantiationService: ReturnType<typeof stubSourcesGitListServices>): { current: { getActions(): readonly ReviewMenuAction[] } | undefined } {
		const shown: { current: { getActions(): readonly ReviewMenuAction[] } | undefined } = { current: undefined };
		instantiationService.stub(IContextMenuService, {
			onDidShowContextMenu: Event.None,
			onDidHideContextMenu: Event.None,
			showContextMenu: (delegate: { getActions(): readonly ReviewMenuAction[] }) => {
				shown.current = delegate;
			},
		} as unknown as IContextMenuService);
		return shown;
	}

	async function runReviewAlternateOpen(host: HTMLElement, shown: { current: { getActions(): readonly ReviewMenuAction[] } | undefined }): Promise<string> {
		const row = host.querySelector('.sources-review-list .monaco-list-row') as HTMLElement | null;
		assert.ok(row, 'review row');
		row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		const actions = shown.current?.getActions() ?? [];
		try {
			const openAction = actions.find(action => action.id === 'sources.openInNewTab' || action.id === 'sources.replaceActiveEditor');
			assert.ok(openAction, 'alternate open action');
			await openAction.run();
			return openAction.label;
		} finally {
			for (const action of actions) {
				action.dispose();
			}
		}
	}

	test('Review context menu alternate open marks reviewed only when the diff opens', async function () {
		const resource = toResource.call(this, '/project/a.ts');
		let opened = 0;
		let marked = 0;
		const scmResource = {
			sourceUri: resource,
			open: async () => { opened++; },
		} as unknown as ISCMResource;
		const { model, snapshot } = mutableChangesModel();
		snapshot.current = {
			generation: 1,
			settled: true,
			state: { kind: 'scm' },
			entries: [{ ...entry(resource), scmResource }],
		};
		const instantiationService = stubSourcesGitListServices({
			connection: createNoGitReadConnection(),
			markReviewed: () => { marked += 1; },
		});
		instantiationService.stub(ISourcesChangesModel, model);
		const shown = stubReviewContextMenu(instantiationService);
		const host = mountListHost();
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';
		await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });

		const label = await runReviewAlternateOpen(host, shown);
		const deadline = Date.now() + 2000;
		while (marked === 0 && Date.now() < deadline) {
			await timeout(20);
		}

		assert.strictEqual(opened, 1);
		assert.strictEqual(marked, 1);
		assert.strictEqual(label, localize('sources.openInNewTab', "Open in New Tab"));
	});

	test('Review context menu alternate open does not mark when opening the diff throws', async function () {
		const host = mountListHost();
		let marked = 0;
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection(),
			getQuickDiffs: async () => { throw new Error('boom'); },
			markReviewed: () => { marked += 1; },
		});
		const shown = stubReviewContextMenu(instantiationService);
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';
		await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });

		await runReviewAlternateOpen(host, shown);

		const status = await waitForStatusText(host, '.sources-review-status', 'Unable to open diff');
		assert.strictEqual(status, sourcesGitDiffOpenFailureMessage(new Error('boom')));
		assert.ok(statusIsError(host));
		assert.strictEqual(marked, 0);
	});

	test('Review list status DOM shows onDidOpen open-diff throw and does not mark reviewed', async function () {
		const host = mountListHost();
		let marked = 0;
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection(),
			getQuickDiffs: async () => { throw new Error('boom'); },
			markReviewed: () => { marked += 1; },
		});
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		await openFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

		const status = await waitForStatusText(host, '.sources-review-status', 'Unable to open diff');
		assert.strictEqual(status, sourcesGitDiffOpenFailureMessage(new Error('boom')));
		assert.ok(status.includes('boom'));
		assert.ok(statusIsError(host));
		assert.strictEqual(marked, 0);
	});

	test('Changes list status DOM shows onDidOpen open-diff throw', async function () {
		const host = mountListHost();
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection(),
			getQuickDiffs: async () => { throw new Error('boom'); },
		});
		const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		await openFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

		const status = await waitForStatusText(host, '.sources-changes-status', 'Unable to open diff');
		assert.strictEqual(status, sourcesGitDiffOpenFailureMessage(new Error('boom')));
		assert.ok(status.includes('boom'));
	});

	test('Changes list status DOM shows Stage Selected write throw', async function () {
		const host = mountListHost();
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection({ throwOnStage: true }),
		});
		const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

		const stageButton = await waitForEnabledButton(host, '.sources-changes-toolbar .monaco-button');
		stageButton.click();

		const status = await waitForStatusText(host, '.sources-changes-status', 'Unable to stage');
		assert.strictEqual(status, localize('sourcesChangesList.stageFailed', "Unable to stage: {0}", getErrorMessage(new Error('boom'))));
		assert.ok(status.includes('Unable to stage:'));
		assert.ok(status.includes('boom'));
	});

	test('Changes list status DOM shows Commit write throw', async function () {
		const host = mountListHost();
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection({ throwOnCommit: true }),
		});
		const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

		const input = host.querySelector('.sources-changes-commit-input') as HTMLInputElement;
		input.value = 'fix';
		input.dispatchEvent(new mainWindow.Event('input', { bubbles: true }));

		const commitButton = await waitForEnabledButton(host, '.sources-changes-commit .monaco-button');
		commitButton.click();

		const status = await waitForStatusText(host, '.sources-changes-status', 'Unable to commit');
		assert.strictEqual(status, localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", getErrorMessage(new Error('boom'))));
		assert.ok(status.includes('Unable to commit:'));
		assert.ok(status.includes('boom'));
	});

	test('Changes list status DOM shows Stage Selected write ok:false', async function () {
		const host = mountListHost();
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection({ failOnStage: true }),
		});
		const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

		const stageButton = await waitForEnabledButton(host, '.sources-changes-toolbar .monaco-button');
		stageButton.click();

		const status = await waitForStatusText(host, '.sources-changes-status', 'Unable to stage');
		assert.strictEqual(status, localize('sourcesChangesList.stageFailed', "Unable to stage: {0}", 'denied'));
		assert.ok(status.includes('Unable to stage:'));
		assert.ok(status.includes('denied'));
	});

	test('Changes list status DOM shows Commit write ok:false', async function () {
		const host = mountListHost();
		const instantiationService = stubSourcesGitListServices({
			connection: createGitConnection({ failOnCommit: true }),
		});
		const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

		const input = host.querySelector('.sources-changes-commit-input') as HTMLInputElement;
		input.value = 'fix';
		input.dispatchEvent(new mainWindow.Event('input', { bubbles: true }));

		const commitButton = await waitForEnabledButton(host, '.sources-changes-commit .monaco-button');
		commitButton.click();

		const status = await waitForStatusText(host, '.sources-changes-status', 'Unable to commit');
		assert.strictEqual(status, localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", 'denied'));
		assert.ok(status.includes('Unable to commit:'));
		assert.ok(status.includes('denied'));
	});

	test('Changes list status DOM shows Unstage Selected command throw', async function () {
		const unstageCommand = CommandsRegistry.registerCommand('git.unstage', () => { });
		try {
			const resource = toResource.call(this, '/project/src/a.ts');
			const host = mountListHost();
			const instantiationService = stubSourcesGitListServices({
				connection: createNoGitReadConnection(),
				scmService: createIndexScmService(resource),
				executeCommand: async () => {
					throw new Error('boom');
				},
			});
			const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

			await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

			const toolbarButtons = host.querySelectorAll('.sources-changes-toolbar .monaco-button');
			const unstageButton = toolbarButtons[1] as HTMLElement | undefined;
			assert.ok(unstageButton, 'Unstage Selected is the toolbar second button');
			const enabledUnstage = await waitForEnabledButton(host, '.sources-changes-toolbar .monaco-button:nth-child(2)');
			enabledUnstage.click();

			const status = await waitForStatusText(host, '.sources-changes-status', 'Unable to unstage');
			assert.strictEqual(status, localize('sourcesChangesList.unstageFailed', "Unable to unstage: {0}", getErrorMessage(new Error('boom'))));
			assert.ok(status.includes('Unable to unstage:'));
			assert.ok(status.includes('boom'));
		} finally {
			unstageCommand.dispose();
		}
	});

	test('Review list throw clears leftover SCM rows and chrome', async function () {
		const leftover = toResource.call(this, '/project/src/leftover.ts');
		const host = mountListHost();
		const widget = store.add(stubSourcesGitListServices({
			scmService: createIndexScmService(leftover),
		}).createInstance(SourcesReviewList, host));

		const status = await waitForStatusText(host, '.sources-review-status');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.strictEqual((widget as unknown as { list?: WorkbenchList<unknown> }).list?.length ?? 0, 0);
		assert.strictEqual((host.querySelector('.sources-review-progress-header') as HTMLElement | null)?.style.display, 'none');
		assert.strictEqual((host.querySelector('.sources-review-header-hint') as HTMLElement | null)?.style.display, 'none');
		assert.strictEqual((host.querySelector('.sources-review-filter-row') as HTMLElement | null)?.style.display, 'none');
		assert.ok(!host.querySelector('.sources-review-list .monaco-list-row'));
	});

	test('Changes list throw clears leftover SCM rows and chrome', async function () {
		const leftover = toResource.call(this, '/project/src/leftover.ts');
		const host = mountListHost();
		const widget = store.add(stubSourcesGitListServices({
			scmService: createIndexScmService(leftover),
		}).createInstance(SourcesChangesList, host));

		const status = await waitForStatusText(host, '.sources-changes-status');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.strictEqual((widget as unknown as { list?: WorkbenchList<unknown> }).list?.length ?? 0, 0);
		assert.strictEqual((host.querySelector('.sources-changes-toolbar') as HTMLElement | null)?.style.display, 'none');
		assert.ok(!host.querySelector('.sources-changes-list .monaco-list-row'));
	});

	test('leftover SCM is local-only when session is empty, disconnected, or unsupported', async function () {
		const leftover = toResource.call(this, '/project/src/leftover.ts');
		const cases: Array<{
			label: string;
			connection?: IUniverseAgentConnection;
			roster?: IConversationRosterService;
		}> = [
			{ label: 'empty session', roster: createRoster('') },
			{ label: 'disconnected', connection: createNoGitReadConnection() },
			{ label: 'unsupported', connection: createGitConnection({ unsupportedChanges: true }) },
			{ label: 'empty supported entries', connection: createGitConnection({ emptyEntries: true }) },
		];

		for (const testCase of cases) {
			const host = mountListHost();
			store.add(stubSourcesGitListServices({
				connection: testCase.connection,
				roster: testCase.roster,
				scmService: createIndexScmService(leftover),
			}).createInstance(SourcesChangesList, host));

			const status = await waitForStatusText(host, '.sources-changes-provenance');
			assert.strictEqual(status, sourcesGitLocalOnlyMessage(), testCase.label);
			assert.ok(status.includes('local source control'), testCase.label);
		}
	});

	test('empty supported git entries do not hide leftover SCM on Changes or Review', async function () {
		const leftover = toResource.call(this, '/project/src/leftover.ts');
		const connection = createGitConnection({ emptyEntries: true });

		const changesHost = mountListHost();
		const changes = store.add(stubSourcesGitListServices({
			connection,
			scmService: createIndexScmService(leftover),
		}).createInstance(SourcesChangesList, changesHost));
		(changesHost.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		assert.strictEqual(await waitForStatusText(changesHost, '.sources-changes-provenance'), sourcesGitLocalOnlyMessage());
		assert.strictEqual((await waitForList(changes as unknown as { list?: WorkbenchList<unknown> })).length, 1);
		assert.strictEqual((changesHost.querySelector('.sources-changes-empty') as HTMLElement).style.display, 'none');
		assert.ok((changesHost.querySelector('.sources-changes-empty')?.textContent ?? '') !== localize('sourcesChangesList.noChanges', "No changes."));

		const reviewHost = mountListHost();
		const review = store.add(stubSourcesGitListServices({
			connection,
			scmService: createIndexScmService(leftover),
		}).createInstance(SourcesReviewList, reviewHost));
		(reviewHost.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		assert.strictEqual(await waitForStatusText(reviewHost, '.sources-review-status'), sourcesGitLocalOnlyMessage());
		assert.ok(!statusIsError(reviewHost));
		assert.strictEqual((await waitForList(review as unknown as { list?: WorkbenchList<unknown> })).length, 1);
		assert.strictEqual((reviewHost.querySelector('.sources-review-empty') as HTMLElement).style.display, 'none');
	});

	test('Review list empty unifiedDiff does not mark reviewed', async function () {
		const host = mountListHost();
		let marked = 0;
		const widget = store.add(stubSourcesGitListServices({
			connection: createGitConnection({ emptyFileDiff: true }),
			markReviewed: () => { marked += 1; },
		}).createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		await openFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });

		const status = await waitForStatusText(host, '.sources-review-status', 'Unable to open diff');
		assert.strictEqual(status, sourcesGitDiffOpenFailureMessage(new Error(sourcesGitEmptyFileDiffMessage())));
		assert.ok(statusIsError(host));
		assert.strictEqual(marked, 0);
	});

	test('Changes write failure status survives applyRefreshPresentation', async function () {
		const host = mountListHost();
		const widget = store.add(stubSourcesGitListServices({
			connection: createGitConnection({ throwOnStage: true }),
		}).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });
		const stageButton = await waitForEnabledButton(host, '.sources-changes-toolbar .monaco-button');
		stageButton.click();

		const failed = await waitForStatusText(host, '.sources-changes-status', 'Unable to stage');
		assert.ok(failed.includes('Unable to stage:'));

		const filter = host.querySelector('.sources-list-filter-input') as HTMLInputElement;
		assert.ok(filter);
		filter.value = 'a';
		filter.dispatchEvent(new mainWindow.Event('input', { bubbles: true }));
		await timeout(400);

		assert.strictEqual(host.querySelector('.sources-changes-status')?.textContent ?? '', failed);
	});

	test('Changes unsupported Commit without local command shows unavailable', async function () {
		const host = mountListHost();
		store.add(stubSourcesGitListServices({
			connection: createGitConnection({ unsupportedCommit: true }),
		}).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		const input = host.querySelector('.sources-changes-commit-input') as HTMLInputElement;
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline && !input) {
			await timeout(20);
		}
		assert.ok(input);
		input.value = 'fix';
		input.dispatchEvent(new mainWindow.Event('input', { bubbles: true }));

		const commitButton = await waitForEnabledButton(host, '.sources-changes-commit .monaco-button');
		commitButton.click();

		const status = await waitForStatusText(host, '.sources-changes-status', 'not available');
		assert.strictEqual(status, localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
	});

	test('review progress keys remain distinct per content hash', () => {
		const base = { origin: 'scm' as const, sessionId: '', scopeKeyId: 'root', path: 'file:///a.ts' };
		const keyA = buildSourcesReviewProgressKey({ ...base, contentHash: '1' });
		const keyB = buildSourcesReviewProgressKey({ ...base, contentHash: '2' });
		assert.notStrictEqual(keyA, keyB);
	});

	test('does not leak unhandled rejection when refresh catch-path paint throws and onUnexpectedError warn-then-rethrows', async () => {
		// refresh() already catches git-read throw; a lone inner reject does not leak.
		// The void scheduler call site still needs `.catch` when the catch-path paint throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			const host = mountListHost();
			const widget = store.add(stubSourcesGitListServices().createInstance(SourcesReviewList, host));
			(widget as unknown as { setStatusMessage(message: string | undefined): void }).setStatusMessage = message => {
				if (message) {
					throw paintBoom;
				}
			};
			(widget as unknown as { scheduleRefresh(): void }).scheduleRefresh();
			(widget as unknown as { refreshScheduler: { flush(): void } }).refreshScheduler.flush();
		});
	});

	test('does not leak unhandled rejection when revealAttributionItem catch-path hint throws and onUnexpectedError warn-then-rethrows', async () => {
		// revealAttributionItem already catches executeCommand; a lone inner reject does not leak.
		// The void chip-click call site still needs `.catch` when the catch-path hint throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
			const host = mountListHost();
			const widget = store.add(stubSourcesGitListServices({
				executeCommand: async () => {
					throw new Error('reveal boom');
				},
			}).createInstance(SourcesReviewList, host));
			(widget as unknown as { scheduleRefresh(): void }).scheduleRefresh();
			(widget as unknown as { refreshScheduler: { flush(): void } }).refreshScheduler.flush();
			await timeout(0);
			(widget as unknown as { updateHeaderHint(): void }).updateHeaderHint = () => {
				throw paintBoom;
			};
			(widget as unknown as { rendererDelegate: { onChipClick(toolCallId: string): void } }).rendererDelegate.onChipClick('tc-1');
		});
	});

	test('does not leak unhandled rejection when Changes list refresh catch-path paint throws and onUnexpectedError warn-then-rethrows', async () => {
		// refresh() already catches git-read throw; a lone inner reject does not leak.
		// The void scheduler call site still needs `.catch` when the catch-path paint throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			const host = mountListHost();
			const widget = store.add(stubSourcesGitListServices().createInstance(SourcesChangesList, host));
			(widget as unknown as { setStatusMessage(message: string | undefined): void }).setStatusMessage = message => {
				if (message) {
					throw paintBoom;
				}
			};
			(widget as unknown as { scheduleRefresh(): void }).scheduleRefresh();
			(widget as unknown as { refreshScheduler: { flush(): void } }).refreshScheduler.flush();
		});
	});

	test('does not leak unhandled rejection when Changes list runCommit catch-path paint throws and onUnexpectedError warn-then-rethrows', async () => {
		// runCommit() already catches writeGitCommit throw; a lone inner reject does not leak.
		// The void Enter-key call site still needs `.catch` when the catch-path paint throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
			const host = mountListHost();
			const widget = store.add(stubSourcesGitListServices({
				connection: createGitConnection({ throwOnCommit: true }),
			}).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
			await selectFirstListRow(widget as unknown as { list?: WorkbenchList<unknown> });
			const input = host.querySelector('.sources-changes-commit-input') as HTMLInputElement;
			assert.ok(input);
			input.value = 'fix';
			input.dispatchEvent(new mainWindow.Event('input', { bubbles: true }));
			await waitForEnabledButton(host, '.sources-changes-commit .monaco-button');
			(widget as unknown as { setStatusMessage(message: string | undefined): void }).setStatusMessage = message => {
				if (message) {
					throw paintBoom;
				}
			};
			input.dispatchEvent(new mainWindow.KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
		});
	});

	test('does not leak unhandled rejection when Changes list onRowAction catch-path paint throws and onUnexpectedError warn-then-rethrows', async () => {
		// runResourceAction / tryStagePaths already catch write throw; a lone inner reject does not leak.
		// The void onRowAction call site still needs `.catch` when the catch-path paint throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
			const host = mountListHost();
			const widget = store.add(stubSourcesGitListServices({
				connection: createGitConnection({ throwOnStage: true }),
			}).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
			const list = await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });
			(widget as unknown as { setStatusMessage(message: string | undefined): void }).setStatusMessage = message => {
				if (message) {
					throw paintBoom;
				}
			};
			widget.onRowAction(list.element(0) as ISourcesChangeEntry, 'stage');
		});
	});

	test('Changes and Review share one git read per connection change', async function () {
		const onDidChangeConnection = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		let changeCalls = 0;
		let summaryCalls = 0;
		const snapshot = (): import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot => ({
			transport: 'ok',
			sharedFsRootSent: false,
			pairingPending: false,
			channelAlive: true,
			capabilities: {} as never,
		});
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				changeCalls += 1;
				return {
					supported: true,
					reason: '',
					branch: 'main',
					entries: [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
				};
			},
			readGitSummary: async () => {
				summaryCalls += 1;
				return {
					supported: true,
					reason: '',
					branch: 'main',
					changeCount: 1,
				};
			},
		} as unknown as IUniverseAgentConnection;

		const instantiationService = stubSourcesGitListServices({ connection });
		const changesHost = mountListHost();
		const reviewHost = mountListHost();
		store.add(instantiationService.createInstance(SourcesChangesList, changesHost));
		store.add(instantiationService.createInstance(SourcesReviewList, reviewHost));
		onDidChangeConnection.fire(snapshot());

		const firstDeadline = Date.now() + 2000;
		while (Date.now() < firstDeadline && (changeCalls < 1 || summaryCalls < 1)) {
			await timeout(20);
		}
		assert.strictEqual(changeCalls, 1, 'both lists and one connection change share one ReadGitChanges');
		assert.strictEqual(summaryCalls, 1, 'both lists and one connection change share one ReadGitSummary');

		onDidChangeConnection.fire(snapshot());
		const secondDeadline = Date.now() + 2000;
		while (Date.now() < secondDeadline && (changeCalls < 2 || summaryCalls < 2)) {
			await timeout(20);
		}
		assert.strictEqual(changeCalls, 2);
		assert.strictEqual(summaryCalls, 2);
		await timeout(400);
		assert.strictEqual(changeCalls, 2, 'a later debounce must not start a third ReadGitChanges');
		assert.strictEqual(summaryCalls, 2, 'a later debounce must not start a third ReadGitSummary');
	});

	test('leftover engine rows keep the ReadGitChanges sessionId when the active session changes', async function () {
		let active = 'session-old';
		const roster = {
			getActiveSessionId: () => active,
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: Event.None,
			isEngineSessionReady: () => true,
		} as unknown as IConversationRosterService;
		const onDidChangeConnection = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
		} as unknown as IUniverseAgentConnection;
		const host = mountListHost();
		const instantiationService = stubSourcesGitListServices({ connection, roster });
		const widget = store.add(instantiationService.createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });
		assert.strictEqual((list.element(0) as { sessionId?: string }).sessionId, 'session-old');

		active = 'session-new';
		delete (connection as { readGitChanges?: unknown }).readGitChanges;
		onDidChangeConnection.fire({
			transport: 'ok',
			sharedFsRootSent: false,
			pairingPending: false,
			channelAlive: true,
			capabilities: {} as never,
		});

		const status = await waitForStatusText(host, '.sources-review-status', 'unavailable');
		assert.strictEqual(status, sourcesGitReadUnavailableNoHookMessage());
		assert.strictEqual((list.element(0) as { sessionId?: string }).sessionId, 'session-old');
		const snapshot = instantiationService.invokeFunction(accessor => accessor.get(ISourcesChangesModel).getSnapshot());
		assert.strictEqual(snapshot.state.kind, 'engine-leftover');
		assert.strictEqual(snapshot.state.kind === 'engine-leftover' ? snapshot.state.sessionId : undefined, 'session-old');
	});

	test('Review filter input does not start another git read', async function () {
		let readCalls = 0;
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitChanges: async () => {
				readCalls += 1;
				return {
					supported: true,
					reason: '',
					branch: 'main',
					entries: [
						{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' },
						{ path: 'src/b.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' },
					],
				};
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 2,
			}),
		} as unknown as IUniverseAgentConnection;
		const host = mountListHost();
		const widget = store.add(stubSourcesGitListServices({ connection }).createInstance(SourcesReviewList, host));
		(host.querySelector('.sources-review-list') as HTMLElement).style.height = '120px';
		const list = await waitForList(widget as unknown as { list?: WorkbenchList<unknown> });
		assert.strictEqual(Number(list.length), 2);
		const afterLoad = readCalls;

		const input = host.querySelector('.sources-list-filter-input') as HTMLInputElement;
		assert.ok(input);
		input.value = 'a.ts';
		input.dispatchEvent(new mainWindow.Event('input', { bubbles: true }));
		const filteredDeadline = Date.now() + 2000;
		while (Date.now() < filteredDeadline && list.length !== 1) {
			await timeout(20);
		}
		assert.strictEqual(Number(list.length), 1, 'filter must repaint without another git read');
		await timeout(400);
		assert.strictEqual(readCalls, afterLoad);
	});
});
