/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ConnectionPhase } from '../../../../../platform/universeAgent/common/connectionHubTypes.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { URI } from '../../../../../base/common/uri.js';
import { TestWorkspace, Workspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { ConversationPart, IConversationLensSlots } from '../../../../browser/parts/conversation/conversationPart.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ISCMRepository, ISCMService } from '../../../scm/common/scm.js';
import { TestContextService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import { IConversationReviewNavService } from '../../browser/conversationReviewEntry.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import type { IAgentWorkRoot } from '../../../../services/agentSession/common/agentWorkRoot.js';
import type { UniverseAgentReadGitSummaryResult } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';

import { ConversationLens } from '../../browser/conversationLens.js';
import { stubConversationTimelineLinkServices } from './conversationTimelineLinkTestStubs.js';
import { ConversationTimelineHost } from '../../browser/conversationTimelineHost.js';
import {
	conversationIdentityBranchChipClass,
	conversationIdentityBranchReadOnlyClass,
	conversationIdentityEngineChipClass,
	conversationIdentityEngineOfflineClass,
	conversationIdentityFolderChipClass,
	conversationIdentityFolderReadOnlyClass,
	conversationIdentityStripClass,
	getConversationIdentityBranchName,
} from '../../browser/conversationIdentityStrip.js';
import { getConnectionPhaseStatusBarText } from '../../browser/conversationSessionStatus.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import {
	conversationLensPhasePreFirstClass,
	conversationLensPrefirstHeroClass,
} from '../../browser/conversationLensDockStrings.js';
import { CONNECTION_PROFILES_ZONE, OPEN_CONNECTION_PREFERENCES_COMMAND_ID, OPEN_ENGINE_PREFERENCES_COMMAND_ID } from '../../common/uaPreferencesPanes.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { TestClipboardService } from '../../../../../platform/clipboard/test/common/testClipboardService.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';
import { flushConversationLensLayout, installConversationLensResizeObserverHarness } from './conversationLensLayoutHarness.js';
import { getWindow } from '../../../../../base/browser/dom.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ActionListItemKind, IActionListDelegate, IActionListItem, IActionListOptions } from '../../../../../platform/actionWidget/browser/actionList.js';
import { IActionWidgetService } from '../../../../../platform/actionWidget/browser/actionWidget.js';
import { IWorkspacesService, IRecentlyOpened } from '../../../../../platform/workspaces/common/workspaces.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { TestHostService, TestWorkspacesService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';

declare function __readFileInTests(path: string): Promise<string>;

const LENS_LAYOUT_WIDTH = 640;
const LENS_LAYOUT_HEIGHT = 480;

interface IRecordedMenuShow {
	readonly user: string;
	readonly items: readonly IActionListItem<unknown>[];
	readonly delegate: IActionListDelegate<unknown>;
	readonly anchor: unknown;
	readonly listOptions?: IActionListOptions;
}

class RecordingActionWidget {
	declare readonly _serviceBrand: undefined;
	private _visible = false;
	readonly shows: IRecordedMenuShow[] = [];

	get isVisible(): boolean {
		return this._visible;
	}

	show(user: string, _supportsPreview: boolean, items: readonly IActionListItem<unknown>[], delegate: IActionListDelegate<unknown>, anchor: unknown, _container?: unknown, _actionBarActions?: unknown, _accessibilityProvider?: unknown, listOptions?: IActionListOptions): void {
		this._visible = true;
		this.shows.push({ user, items, delegate, anchor, listOptions });
	}

	updateItems(): void { }

	focusItemById(): void { }

	hide(didCancel?: boolean): void {
		this._visible = false;
		this.shows.at(-1)?.delegate.onHide(didCancel);
	}
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

suite('ConversationIdentityStrip', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	installConversationLensResizeObserverHarness();

	teardown(async () => {
		await flushConversationLensLayout();
	});

	function layoutReadingColumn(lens: ConversationLens, slots: IConversationLensSlots): void {
		const readingColumn = slots.timeline.querySelector('.conversation-lens-reading-column') as HTMLElement | null;
		const timelineScroll = slots.timeline.querySelector('.conversation-lens-timeline-scroll') as HTMLElement | null;
		const contentHost = slots.timeline.querySelector('.conversation-lens-timeline-content') as HTMLElement | null;
		const treeContainer = (slots.timeline.querySelector('.conversation-timeline-stream') ?? slots.timeline.querySelector('.conversation-timeline-tree')) as HTMLElement | null;
		if (readingColumn) {
			readingColumn.style.width = `${LENS_LAYOUT_WIDTH}px`;
			readingColumn.style.height = `${LENS_LAYOUT_HEIGHT}px`;
		}
		if (timelineScroll) {
			timelineScroll.style.height = `${LENS_LAYOUT_HEIGHT - 120}px`;
			timelineScroll.style.minHeight = `${LENS_LAYOUT_HEIGHT - 120}px`;
		}
		if (contentHost) {
			contentHost.style.display = '';
			contentHost.style.minHeight = `${LENS_LAYOUT_HEIGHT - 120}px`;
		}
		if (treeContainer) {
			treeContainer.style.height = `${LENS_LAYOUT_HEIGHT - 120}px`;
		}
		const timelineTree = (lens as unknown as { timelineTree: ConversationTimelineHost }).timelineTree;
		timelineTree.layout(LENS_LAYOUT_HEIGHT - 120, LENS_LAYOUT_WIDTH);
	}

	function createConnectionStub(overrides: Partial<IUniverseAgentConnection> = {}): IUniverseAgentConnection {
		return createConversationConnectionTestStub(overrides);
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

	function createScmRepository(
		branchName: string | undefined,
		rootUri: URI,
		id = 'git',
		provideHistoryItemRefs: () => Promise<readonly { id: string; name: string }[]> = async () => [],
	): ISCMRepository {
		const historyItemRef = observableValue<{ id: string; name: string } | undefined>(
			'historyItemRef',
			branchName ? { id: 'HEAD', name: branchName } : undefined,
		);
		const historyProvider = {
			historyItemRef,
			historyItemRemoteRef: observableValue('remote', undefined),
			historyItemBaseRef: observableValue('base', undefined),
			historyItemRefChanges: observableValue('changes', { added: [], removed: [], modified: [], silent: true }),
			provideHistoryItemRefs,
		};
		const provider = {
			id,
			providerId: 'git',
			label: 'Git',
			name: 'Git',
			rootUri,
			groups: [],
			onDidChangeResourceGroups: Event.None,
			onDidChangeResources: Event.None,
			historyProvider: observableValue('historyProvider', historyProvider),
			dispose: () => { },
		};
		return { id, provider, dispose: () => { } } as unknown as ISCMRepository;
	}

	function createScmServiceWithRepositories(repositories: readonly ISCMRepository[]): ISCMService {
		return {
			_serviceBrand: undefined,
			get repositories() { return repositories; },
			get repositoryCount() { return repositories.length; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => repositories[0],
		} as unknown as ISCMService;
	}

	function createScmServiceWithBranch(branchName: string, rootUri: URI = TestWorkspace.folders[0].uri): ISCMService {
		return createScmServiceWithRepositories([createScmRepository(branchName, rootUri)]);
	}

	function mountLens(options?: {
		workspaceContextService?: IWorkspaceContextService;
		scmService?: ISCMService;
		commandService?: ICommandService;
		stubService?: ConversationStubService;
		connectionOverrides?: Partial<IUniverseAgentConnection>;
		sessionContext?: IAgentSessionContext;
	}): { part: ConversationPart; slots: IConversationLensSlots; commandService: ICommandService; stubService: ConversationStubService; lens: ConversationLens; workbench: HTMLElement; actionWidget: RecordingActionWidget; host: TestHostService; workspaces: TestWorkspacesService } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const actionWidget = new RecordingActionWidget();
		instantiationService.stub(IActionWidgetService, actionWidget as unknown as IActionWidgetService);
		const storageService = store.add(new TestStorageService());
		instantiationService.stub(IStorageService, storageService);
		const stubService = options?.stubService ?? store.add(new ConversationStubService());
		const clipboardService = new TestClipboardService();
		const commandService = options?.commandService ?? new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			readonly executed: string[] = [];
			readonly executedArgs: unknown[][] = [];
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand<T>(id: string, ...args: unknown[]): Promise<T | undefined> {
				this.executed.push(id);
				this.executedArgs.push(args);
				return Promise.resolve(undefined);
			}
		}();
		const explorerService = {
			_serviceBrand: undefined,
			select: async () => { },
		} as unknown as IExplorerService;

		instantiationService.stub(IConversationRosterService, stubService);
		stubConversationTimelineLinkServices(instantiationService);
		instantiationService.stub(IUniverseAgentConnection, createConnectionStub(options?.connectionOverrides));
		instantiationService.stub(IConversationTimelineRevealService, {
			_serviceBrand: undefined,
			registerLens: () => ({ dispose: () => { } }),
			revealItem: () => { },
			getAccessibleTurnContent: () => undefined,
			focusAccessibleTurn: () => { },
			scrollToFirstPendingConfirmation: () => { },
		});
		instantiationService.stub(IConversationReviewNavService, {
			_serviceBrand: undefined,
			onDidChange: Event.None,
			getReviewNavForSession: () => [],
		});
		instantiationService.stub(IClipboardService, clipboardService);
		instantiationService.stub(ICommandService, commandService);
		instantiationService.stub(IExplorerService, explorerService);
		instantiationService.stub(ISCMService, options?.scmService ?? createEmptyScmService());
		if (options?.workspaceContextService) {
			instantiationService.stub(IWorkspaceContextService, options.workspaceContextService);
		}
		if (options?.sessionContext) {
			instantiationService.stub(IAgentSessionContext, options.sessionContext);
		}

		const part = store.add(instantiationService.createInstance(ConversationPart));
		const workbenchRoot = document.createElement('div');
		workbenchRoot.classList.add('monaco-workbench');
		const parent = document.createElement('div');
		parent.classList.add('part', 'conversation');
		parent.style.width = `${LENS_LAYOUT_WIDTH}px`;
		parent.style.height = `${LENS_LAYOUT_HEIGHT}px`;
		workbenchRoot.appendChild(parent);
		document.body.appendChild(workbenchRoot);
		store.add(toDisposable(() => workbenchRoot.remove()));
		part.create(parent);
		const partSlots = part.getSlots();
		assert.ok(partSlots);
		const slots: IConversationLensSlots = {
			sessionBar: partSlots.sessionBar,
			timeline: document.createElement('div'),
			dock: document.createElement('div'),
		};
		slots.timeline.classList.add('conversation-timeline', 'part', 'conversation');
		slots.dock.classList.add('conversation-dock');
		parent.appendChild(slots.timeline);
		parent.appendChild(slots.dock);
		part.layout(LENS_LAYOUT_WIDTH, LENS_LAYOUT_HEIGHT, 0, 0);
		const lens = store.add(instantiationService.createInstance(ConversationLens, slots));
		layoutReadingColumn(lens, slots);

		return {
			part,
			slots,
			commandService,
			stubService,
			lens,
			workbench: parent,
			actionWidget,
			host: instantiationService.get(IHostService) as TestHostService,
			workspaces: instantiationService.get(IWorkspacesService) as TestWorkspacesService,
		};
	}

	function menuActions(show: IRecordedMenuShow): IActionListItem<unknown>[] {
		return show.items.filter(item => item.kind === ActionListItemKind.Action);
	}

	function getReadingColumn(slots: IConversationLensSlots): HTMLElement {
		const column = slots.timeline.querySelector('.conversation-lens-reading-column');
		assert.ok(column);
		return column as HTMLElement;
	}

	function getIdentityStrip(slots: IConversationLensSlots): HTMLElement {
		const strip = getReadingColumn(slots).querySelector(`.${conversationIdentityStripClass}`);
		assert.ok(strip);
		return strip as HTMLElement;
	}

	test('identity strip mounts in reading column before timeline scroll when Active', () => {
		const { slots } = mountLens();
		const readingColumn = getReadingColumn(slots);
		const children = [...readingColumn.children];

		assert.strictEqual(children[0]?.classList.contains(conversationIdentityStripClass), true);
		assert.ok(readingColumn.querySelector('.conversation-lens-timeline'));
		assert.ok(getIdentityStrip(slots).compareDocumentPosition(getReadingColumn(slots).querySelector('.conversation-lens-timeline-scroll')!) & Node.DOCUMENT_POSITION_FOLLOWING);
	});

	test('PreFirst: identity strip mounts in prefirst hero above composer, not at column top', () => {
		const { slots, stubService, lens } = mountLens();
		const emptySessionId = stubService.createSession();
		assert.strictEqual(stubService.getTurns(emptySessionId).length, 0);
		layoutReadingColumn(lens, slots);

		const readingColumn = getReadingColumn(slots);
		const prefirstHero = readingColumn.querySelector(`.${conversationLensPrefirstHeroClass}`) as HTMLElement | null;
		assert.ok(prefirstHero);
		assert.ok(!prefirstHero.hidden);
		assert.strictEqual(readingColumn.classList.contains(conversationLensPhasePreFirstClass), true);
		assert.strictEqual(readingColumn.firstElementChild?.classList.contains(conversationIdentityStripClass), false);
		assert.strictEqual(prefirstHero.querySelector(`.${conversationIdentityStripClass}`), getIdentityStrip(slots));
		assert.ok(prefirstHero.querySelector('.conversation-lens-composer'));
	});

	test('identity strip is absent from SessionBar and dock', () => {
		const { slots } = mountLens();

		assert.strictEqual(slots.sessionBar!.querySelector(`.${conversationIdentityStripClass}`), null);
		assert.strictEqual(slots.dock.querySelector(`.${conversationIdentityStripClass}`), null);
		assert.strictEqual(slots.sessionBar!.querySelector(`.${conversationIdentityEngineChipClass}`), null);
		assert.strictEqual(slots.dock.querySelector(`.${conversationIdentityEngineChipClass}`), null);
	});

	test('engine chip shows disconnected copy and opens Connection preferences', async () => {
		const { slots, commandService } = mountLens();
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;

		assert.ok(engineChip);
		assert.strictEqual(engineChip.textContent, getConnectionPhaseStatusBarText({ kind: 'disconnected' }));
		assert.strictEqual(engineChip.textContent, 'Engine not connected');
		assert.strictEqual(engineChip.classList.contains(conversationIdentityEngineOfflineClass), true);
		assert.ok(engineChip.querySelector('.conversation-identity-chip-open'));

		engineChip.click();
		await Promise.resolve();
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, [OPEN_CONNECTION_PREFERENCES_COMMAND_ID]);
		assert.deepStrictEqual((commandService as unknown as { executedArgs: unknown[][] }).executedArgs, [[CONNECTION_PROFILES_ZONE]]);
	});

	test('engine chip stays the hit target when session bar / split-view chrome overlaps it', async () => {
		const { slots, commandService, workbench } = mountLens();
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;
		assert.ok(engineChip);
		if (engineChip.getBoundingClientRect().width === 0) {
			engineChip.style.display = 'inline-block';
			engineChip.style.width = '96px';
			engineChip.style.height = '24px';
		}

		const rect = engineChip.getBoundingClientRect();
		const overlay = document.createElement('div');
		overlay.className = 'conversation-session-bar monaco-split-view2';
		overlay.style.position = 'fixed';
		overlay.style.left = `${rect.left}px`;
		overlay.style.top = `${rect.top}px`;
		overlay.style.width = `${Math.max(rect.width, 8)}px`;
		overlay.style.height = `${Math.max(rect.height, 8)}px`;
		overlay.style.zIndex = '5';
		const sashContainer = document.createElement('div');
		sashContainer.className = 'sash-container';
		sashContainer.style.position = 'absolute';
		sashContainer.style.inset = '0';
		overlay.appendChild(sashContainer);
		workbench.appendChild(overlay);
		store.add(toDisposable(() => overlay.remove()));

		assert.strictEqual(getWindow(overlay).getComputedStyle(overlay).pointerEvents, 'none');
		assert.strictEqual(getWindow(engineChip).getComputedStyle(engineChip).pointerEvents, 'auto');

		const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
		assert.ok(hit === engineChip || engineChip.contains(hit), `expected engine chip under overlay, hit ${hit?.className ?? 'null'}`);

		engineChip.click();
		await Promise.resolve();
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, [OPEN_CONNECTION_PREFERENCES_COMMAND_ID]);
	});

	test('engine chip opens Connection when roster is connected but phase is not', async () => {
		const stubService = store.add(new ConversationStubService());
		stubService.setEngineConnected(true);

		const { slots, commandService } = mountLens({
			stubService,
			connectionOverrides: {
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'disconnected' }),
			},
		});
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;
		engineChip.click();
		await Promise.resolve();
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, [OPEN_CONNECTION_PREFERENCES_COMMAND_ID]);
		assert.deepStrictEqual((commandService as unknown as { executedArgs: unknown[][] }).executedArgs, [[CONNECTION_PROFILES_ZONE]]);
	});

	test('engine chip shows connected copy and opens Engine preferences', async () => {
		const stubService = store.add(new ConversationStubService());
		stubService.setEngineConnected(true);

		const { slots, commandService } = mountLens({
			stubService,
			connectionOverrides: {
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected', path: 'hubRelay' }),
			},
		});
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;

		assert.ok(engineChip);
		assert.strictEqual(engineChip.textContent, getConnectionPhaseStatusBarText({ kind: 'connected', path: 'hubRelay' }));
		assert.strictEqual(engineChip.textContent, 'Engine · Hub relay');
		assert.strictEqual(engineChip.classList.contains(conversationIdentityEngineOfflineClass), false);
		assert.ok(engineChip.matches(`.${conversationIdentityEngineChipClass}:not(.${conversationIdentityEngineOfflineClass}):not(.conversation-identity-chip-engine--failed)`));

		engineChip.click();
		await Promise.resolve();
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, [OPEN_ENGINE_PREFERENCES_COMMAND_ID]);
		assert.deepStrictEqual((commandService as unknown as { executedArgs: unknown[][] }).executedArgs, [[]]);
	});

	test('engine chip opens Connection while pairingPending even if phase is connected', async () => {
		const stubService = store.add(new ConversationStubService());
		stubService.setEngineConnected(true);

		const { slots, commandService } = mountLens({
			stubService,
			connectionOverrides: {
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
				getConnectionSnapshot: () => ({
					transport: 'ok',
					pairingPending: true,
					channelAlive: true,
					sharedFsRootSent: false,
					capabilities: createEmptyTestCapabilitySnapshot(),
				}),
			},
		});
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;

		assert.ok(engineChip);
		assert.strictEqual(engineChip.textContent, getConnectionPhaseStatusBarText({ kind: 'connected', path: 'direct' }, true));
		assert.strictEqual(engineChip.textContent, 'Waiting for pairing');

		engineChip.click();
		await Promise.resolve();
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, [OPEN_CONNECTION_PREFERENCES_COMMAND_ID]);
		assert.deepStrictEqual((commandService as unknown as { executedArgs: unknown[][] }).executedArgs, [[]]);
	});

	test('engine chip updates when connection phase changes', () => {
		const onDidChangeConnection = new Emitter<UniverseAgentConnectionSnapshot>();
		let phase: ConnectionPhase = { kind: 'disconnected' };

		const { slots } = mountLens({
			connectionOverrides: {
				onDidChangeConnection: onDidChangeConnection.event,
				getConnectionPhase: () => phase,
			},
		});
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;

		assert.strictEqual(engineChip.textContent, 'Engine not connected');
		assert.strictEqual(engineChip.classList.contains(conversationIdentityEngineOfflineClass), true);

		phase = { kind: 'connecting', reason: 'initial' };
		onDidChangeConnection.fire({
			transport: 'idle',
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		});
		assert.strictEqual(engineChip.textContent, 'Connecting…');
		assert.strictEqual(engineChip.classList.contains(conversationIdentityEngineOfflineClass), false);
	});

	test('folder chip is hidden for empty workspace', () => {
		const emptyWorkspace = new TestContextService(new Workspace('empty-workspace', []));
		const { slots } = mountLens({ workspaceContextService: emptyWorkspace });
		const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;

		assert.ok(folderChip);
		assert.strictEqual(folderChip.hidden, true);
	});

	test('branch chip is hidden when SCM has no HEAD', () => {
		const { slots } = mountLens();
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLElement;

		assert.ok(branchChip);
		assert.strictEqual(branchChip.hidden, true);
		assert.strictEqual(getConversationIdentityBranchName(createEmptyScmService()), undefined);
	});

	test('branch chip shows SCM HEAD when available', () => {
		const { slots } = mountLens({ scmService: createScmServiceWithBranch('loop/B') });
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLElement;

		assert.ok(branchChip);
		assert.strictEqual(branchChip.hidden, false);
		assert.strictEqual(branchChip.textContent, 'loop/B');
	});

	test('branch stays hidden when folders[0] has no HEAD and another repo does', () => {
		const folderUri = TestWorkspace.folders[0].uri;
		const scm = createScmServiceWithRepositories([
			createScmRepository(undefined, folderUri, 'folder'),
			createScmRepository('other-branch', URI.file('/other-repo'), 'other'),
		]);
		assert.strictEqual(getConversationIdentityBranchName(scm, folderUri), undefined);

		const { slots } = mountLens({ scmService: scm });
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLElement;
		assert.strictEqual(branchChip.hidden, true);
	});

	test('branch chip uses the folders[0] repository HEAD', () => {
		const folderUri = TestWorkspace.folders[0].uri;
		const scm = createScmServiceWithRepositories([
			createScmRepository('folder-branch', folderUri, 'folder'),
			createScmRepository('other-branch', URI.file('/other-repo'), 'other'),
		]);
		assert.strictEqual(getConversationIdentityBranchName(scm, folderUri), 'folder-branch');
		assert.strictEqual(getConversationIdentityBranchName(scm), undefined);

		const { slots } = mountLens({ scmService: scm });
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLElement;
		assert.strictEqual(branchChip.hidden, false);
		assert.strictEqual(branchChip.textContent, 'folder-branch');
	});

	test('identity strip copy does not mention Copilot or Open Chat', () => {
		const { slots } = mountLens({ scmService: createScmServiceWithBranch('main') });
		const text = getIdentityStrip(slots).textContent ?? '';

		assert.ok(!/copilot/i.test(text));
		assert.ok(!/open chat/i.test(text));
	});

	test('does not leak unhandled rejection when engine chip executeCommand rejects and onUnexpectedError warn-then-rethrows', async () => {
		const paintBoom = new Error('engine chip boom');
		const executed: string[] = [];
		const commandService = new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand<T>(id: string): Promise<T | undefined> {
				executed.push(id);
				return Promise.reject(paintBoom);
			}
		}();
		const { slots } = mountLens({ commandService });
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;
			engineChip.click();
		});
		assert.deepStrictEqual(executed, [OPEN_CONNECTION_PREFERENCES_COMMAND_ID]);
	});

	test('folder chip opens a searchable recents menu and does not reveal in the explorer', async () => {
		const folderUri = TestWorkspace.folders[0].uri;
		const otherUri = URI.file('/other-project');
		const opened: { toOpen: unknown; options: unknown }[] = [];
		const { slots, commandService, actionWidget, host, workspaces } = mountLens();
		host.openWindow = async (toOpen, options) => {
			opened.push({ toOpen, options });
		};
		workspaces.getRecentlyOpened = async () => ({
			files: [],
			workspaces: [
				{ folderUri, label: 'current-dup' },
				{ folderUri: otherUri, label: 'Other', remoteAuthority: 'ssh-remote+dev' },
				{ workspace: { id: 'multi', configPath: URI.file('/multi.code-workspace') } },
			],
		});
		const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;

		assert.strictEqual(folderChip.tagName, 'BUTTON');
		assert.strictEqual(folderChip.getAttribute('aria-haspopup'), 'listbox');
		assert.strictEqual(folderChip.getAttribute('aria-expanded'), 'false');
		assert.ok(folderChip.querySelector('.codicon-chevron-down'));
		assert.ok(engineChip.querySelector('.codicon-chevron-down'));
		assert.strictEqual(engineChip.querySelector('.codicon-chevron-right'), null);
		assert.strictEqual(folderChip.textContent, 'testWorkspace');

		folderChip.click();
		await timeout(0);

		assert.strictEqual(actionWidget.shows.length, 1);
		assert.strictEqual(actionWidget.shows[0].user, 'conversationIdentityFolder');
		assert.strictEqual(actionWidget.shows[0].anchor, folderChip);
		assert.deepStrictEqual(actionWidget.shows[0].listOptions, {
			showFilter: true,
			filterPlaceholder: 'Search folders...',
			minWidth: 280,
		});
		assert.strictEqual(folderChip.getAttribute('aria-expanded'), 'true');
		const actions = menuActions(actionWidget.shows[0]);
		assert.deepStrictEqual(actions.map(item => item.label), ['testWorkspace', 'Other', 'Open Folder…']);
		assert.strictEqual(actions[0].group?.icon, Codicon.check);
		assert.strictEqual(actions[1].group?.icon, Codicon.folder);
		assert.ok(actionWidget.shows[0].items.some(item => item.kind === ActionListItemKind.Header && item.label === 'Recents'));
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, []);

		actionWidget.shows[0].delegate.onSelect(actions[0].item);
		assert.deepStrictEqual(opened, []);
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, []);

		folderChip.click();
		await timeout(0);
		actionWidget.shows.at(-1)!.delegate.onSelect(menuActions(actionWidget.shows.at(-1)!).find(item => item.label === 'Other')!.item);
		assert.deepStrictEqual(opened, [{
			toOpen: [{ folderUri: otherUri }],
			options: { forceReuseWindow: true, remoteAuthority: 'ssh-remote+dev' },
		}]);

		folderChip.click();
		await timeout(0);
		actionWidget.shows.at(-1)!.delegate.onSelect(menuActions(actionWidget.shows.at(-1)!).find(item => item.label === 'Open Folder…')!.item);
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, ['workbench.action.files.openFolder']);
		assert.deepStrictEqual((commandService as unknown as { executedArgs: unknown[][] }).executedArgs, [[]]);
	});

	test('folder chip click toggles the open menu and cancels a menu that is still loading', async () => {
		const { slots, actionWidget, workspaces } = mountLens();
		const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;

		folderChip.click();
		await timeout(0);
		assert.strictEqual(actionWidget.isVisible, true);
		folderChip.click();
		assert.strictEqual(actionWidget.shows.length, 1);
		assert.strictEqual(actionWidget.isVisible, false);
		assert.strictEqual(folderChip.getAttribute('aria-expanded'), 'false');

		let resolveOpened!: (value: IRecentlyOpened) => void;
		workspaces.getRecentlyOpened = () => new Promise(resolve => { resolveOpened = resolve; });
		folderChip.click();
		assert.strictEqual(actionWidget.shows.length, 1);
		folderChip.click();
		resolveOpened({ files: [], workspaces: [] });
		await timeout(0);
		assert.strictEqual(actionWidget.shows.length, 1);
	});

	test('folder menu still opens when recent folders fail to load', async () => {
		const { slots, actionWidget, workspaces } = mountLens();
		workspaces.getRecentlyOpened = async () => { throw new Error('recents down'); };
		const leaks: unknown[] = [];
		const onLeak = (reason: unknown) => leaks.push(reason);
		process.on('unhandledRejection', onLeak);
		try {
			const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
			folderChip.click();
			await timeout(0);
			assert.deepStrictEqual(leaks, []);
			assert.deepStrictEqual(menuActions(actionWidget.shows[0]).map(item => item.label), ['testWorkspace', 'Open Folder…']);
		} finally {
			process.off('unhandledRejection', onLeak);
		}
	});

	test('branch chip opens a searchable local-branch menu and checks out through git.checkout', async () => {
		const folderUri = TestWorkspace.folders[0].uri;
		const scm = createScmServiceWithRepositories([createScmRepository('edit', folderUri, 'git', async () => [
			{ id: 'refs/heads/edit', name: 'edit' },
			{ id: 'refs/heads/main', name: 'main' },
			{ id: 'refs/heads/backup/pre-rebase-1fd2e162', name: 'backup/pre-rebase-1fd2e162' },
			{ id: 'refs/tags/v1', name: 'v1' },
			{ id: 'refs/remotes/origin/main', name: 'origin/main' },
			{ id: 'refs/heads/edit', name: 'edit' },
		])]);
		const { slots, commandService, actionWidget } = mountLens({ scmService: scm });
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLButtonElement;

		assert.strictEqual(branchChip.tagName, 'BUTTON');
		assert.strictEqual(branchChip.getAttribute('aria-haspopup'), 'listbox');
		assert.strictEqual(branchChip.getAttribute('role'), null);
		assert.ok(branchChip.querySelector('.codicon-chevron-down'));
		assert.strictEqual(branchChip.textContent, 'edit');

		branchChip.click();
		await timeout(0);

		assert.strictEqual(actionWidget.shows.length, 1);
		assert.strictEqual(actionWidget.shows[0].user, 'conversationIdentityBranch');
		assert.strictEqual(actionWidget.shows[0].anchor, branchChip);
		assert.deepStrictEqual(actionWidget.shows[0].listOptions, {
			showFilter: true,
			filterPlaceholder: 'Search branches...',
			minWidth: 280,
		});
		const actions = menuActions(actionWidget.shows[0]);
		assert.deepStrictEqual(actions.map(item => item.label), ['edit', 'backup/pre-rebase-1fd2e162', 'main']);
		assert.strictEqual(actions[0].group?.icon, Codicon.check);
		assert.strictEqual(actions[1].group?.icon, Codicon.gitBranch);

		actionWidget.shows[0].delegate.onSelect('edit');
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, []);

		branchChip.click();
		await timeout(0);
		actionWidget.shows.at(-1)!.delegate.onSelect('main');
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, ['git.checkout']);
		assert.deepStrictEqual((commandService as unknown as { executedArgs: unknown[][] }).executedArgs, [[folderUri, 'main']]);
	});

	test('branch menu keeps the current branch when history refs fail', async () => {
		const scm = createScmServiceWithBranch('edit');
		const repository = [...scm.repositories][0];
		const historyProvider = repository.provider.historyProvider.get() as { provideHistoryItemRefs: () => Promise<unknown> };
		historyProvider.provideHistoryItemRefs = async () => { throw new Error('refs down'); };
		const { slots, actionWidget } = mountLens({ scmService: scm });
		const leaks: unknown[] = [];
		const onLeak = (reason: unknown) => leaks.push(reason);
		process.on('unhandledRejection', onLeak);
		try {
			const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLButtonElement;
			branchChip.click();
			await timeout(0);
			assert.deepStrictEqual(leaks, []);
			assert.deepStrictEqual(menuActions(actionWidget.shows[0]).map(item => item.label), ['edit']);
		} finally {
			process.off('unhandledRejection', onLeak);
		}
	});

	test('does not leak unhandled rejection when Open Folder rejects and onUnexpectedError warn-then-rethrows', async () => {
		const paintBoom = new Error('folder chip boom');
		const executed: string[] = [];
		const commandService = new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand<T>(id: string): Promise<T | undefined> {
				executed.push(id);
				return Promise.reject(paintBoom);
			}
		}();
		const { slots, actionWidget } = mountLens({ commandService });
		const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
		folderChip.click();
		await timeout(0);
		const browse = menuActions(actionWidget.shows[0]).find(item => item.label === 'Open Folder…');
		assert.ok(browse);
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			actionWidget.shows[0].delegate.onSelect(browse.item);
		});
		assert.deepStrictEqual(executed, ['workbench.action.files.openFolder']);
	});

	test('does not leak unhandled rejection when branch checkout rejects and onUnexpectedError warn-then-rethrows', async () => {
		const paintBoom = new Error('checkout boom');
		const executed: string[] = [];
		const commandService = new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand<T>(id: string): Promise<T | undefined> {
				executed.push(id);
				return Promise.reject(paintBoom);
			}
		}();
		const scm = createScmServiceWithRepositories([createScmRepository('edit', TestWorkspace.folders[0].uri, 'git', async () => [
			{ id: 'refs/heads/main', name: 'main' },
		])]);
		const { slots, actionWidget } = mountLens({ commandService, scmService: scm });
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLButtonElement;
		branchChip.click();
		await timeout(0);
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			actionWidget.shows[0].delegate.onSelect('main');
		});
		assert.deepStrictEqual(executed, ['git.checkout']);
	});

	test('does not leak unhandled rejection when switching folders rejects and onUnexpectedError warn-then-rethrows', async () => {
		const paintBoom = new Error('open window boom');
		const otherUri = URI.file('/other-project');
		const { slots, actionWidget, host, workspaces } = mountLens();
		workspaces.getRecentlyOpened = async () => ({
			files: [],
			workspaces: [{ folderUri: otherUri, label: 'Other' }],
		});
		host.openWindow = async () => { throw paintBoom; };
		const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
		folderChip.click();
		await timeout(0);
		const other = menuActions(actionWidget.shows[0]).find(item => item.label === 'Other');
		assert.ok(other);
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			actionWidget.shows[0].delegate.onSelect(other.item);
		});
	});

	test('identity strip menu commands double-catch onUnexpectedError', async () => {
		const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/conversation/browser/conversationIdentityStrip.ts`);
		assert.ok(source.includes(`void this.commandService.executeCommand(getEngineStatusCommandId(`));
		assert.ok(source.includes(`)).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(source.includes(`void this.commandService.executeCommand(OPEN_FOLDER_COMMAND_ID).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(source.includes(`void this.commandService.executeCommand(GIT_CHECKOUT_COMMAND_ID, folderUri, name).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(source.includes('void this.hostService.openWindow([{ folderUri: action.folder.folderUri }], {'));
		assert.ok(source.includes('remoteAuthority: action.folder.remoteAuthority ?? null,'));
		assert.ok(!source.includes('revealInExplorer'));
		assert.ok(!source.includes('this.commandService.executeCommand(getEngineStatusCommandId(\n\t\t\t\tthis.uaConnection.getConnectionPhase(),\n\t\t\t\tthis.uaConnection.getConnectionSnapshot().pairingPending,\n\t\t\t));'));
		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\([\s\S]*?\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 3);
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 6);
	});

	test('folder and branch follow the active session work root and engine root has no branch menu', async () => {
		const onDidChangeActiveWorkRoot = store.add(new Emitter<IAgentWorkRoot>());
		const alpha = URI.file('/repo/alpha');
		const beta = URI.file('/repo/beta');
		let current: IAgentWorkRoot = {
			sessionId: 's-a',
			engineIdentityId: 'eng',
			workDir: alpha.path,
			source: 'session',
			access: 'local',
			localRoot: alpha,
			projectKey: `eng\n${alpha.path}`,
		};
		const scm = createScmServiceWithRepositories([
			createScmRepository('alpha-branch', alpha, 'alpha', async () => [
				{ id: 'refs/heads/alpha-branch', name: 'alpha-branch' },
				{ id: 'refs/heads/main', name: 'main' },
			]),
			createScmRepository('beta-branch', beta, 'beta'),
		]);
		const summaries: { sessionId: string; resolve: (value: UniverseAgentReadGitSummaryResult) => void }[] = [];
		const sessionContext = {
			getActiveWorkRoot: () => current,
			onDidChangeActiveWorkRoot: onDidChangeActiveWorkRoot.event,
		} as IAgentSessionContext;
		const { slots, commandService, actionWidget } = mountLens({
			scmService: scm,
			sessionContext,
			connectionOverrides: {
				readGitSummary: request => new Promise(resolve => {
					summaries.push({ sessionId: request.sessionId, resolve });
				}),
			},
		});
		const folderChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityFolderChipClass}`) as HTMLButtonElement;
		const branchChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityBranchChipClass}`) as HTMLButtonElement;
		const branchChevron = () => branchChip.querySelector('.conversation-identity-chip-open') as HTMLElement;
		const folderChevron = () => folderChip.querySelector('.conversation-identity-chip-open') as HTMLElement;

		assert.strictEqual(folderChip.textContent, 'alpha');
		assert.strictEqual(branchChip.hidden, false);
		assert.strictEqual(branchChip.textContent, 'alpha-branch');
		assert.strictEqual(branchChip.getAttribute('aria-haspopup'), 'listbox');
		assert.strictEqual(branchChevron().hidden, false);
		assert.strictEqual(branchChip.classList.contains(conversationIdentityBranchReadOnlyClass), false);

		branchChip.click();
		await timeout(0);
		actionWidget.shows.at(-1)!.delegate.onSelect('main');
		assert.deepStrictEqual((commandService as unknown as { executedArgs: unknown[][] }).executedArgs, [[alpha, 'main']]);

		folderChip.click();
		await timeout(0);
		assert.ok(menuActions(actionWidget.shows.at(-1)!).some(item => item.label === 'testWorkspace'));
		actionWidget.hide(true);

		current = {
			sessionId: 's-b',
			engineIdentityId: 'eng',
			workDir: beta.path,
			source: 'session',
			access: 'local',
			localRoot: beta,
			projectKey: `eng\n${beta.path}`,
		};
		onDidChangeActiveWorkRoot.fire(current);
		assert.strictEqual(folderChip.textContent, 'beta');
		assert.strictEqual(branchChip.textContent, 'beta-branch');
		assert.strictEqual(branchChip.getAttribute('aria-haspopup'), 'listbox');

		current = {
			sessionId: 's-engine',
			engineIdentityId: 'eng',
			workDir: '/remote/gamma',
			source: 'session',
			access: 'engine',
			localRoot: undefined,
			projectKey: 'eng\n/remote/gamma',
		};
		onDidChangeActiveWorkRoot.fire(current);
		assert.strictEqual(folderChip.textContent, 'gamma');
		assert.strictEqual(branchChip.hidden, true);
		assert.strictEqual(summaries.length, 1);
		assert.strictEqual(summaries[0].sessionId, 's-engine');

		current = {
			sessionId: 's-b',
			engineIdentityId: 'eng',
			workDir: beta.path,
			source: 'session',
			access: 'local',
			localRoot: beta,
			projectKey: `eng\n${beta.path}`,
		};
		onDidChangeActiveWorkRoot.fire(current);
		assert.strictEqual(folderChip.textContent, 'beta');
		assert.strictEqual(branchChip.textContent, 'beta-branch');
		summaries[0].resolve({ supported: true, reason: '', branch: 'stale-engine', changeCount: 0 });
		await timeout(0);
		assert.strictEqual(branchChip.textContent, 'beta-branch');
		assert.strictEqual(branchChip.getAttribute('aria-haspopup'), 'listbox');

		current = {
			sessionId: 's-engine',
			engineIdentityId: 'eng',
			workDir: '/remote/gamma',
			source: 'session',
			access: 'engine',
			localRoot: undefined,
			projectKey: 'eng\n/remote/gamma',
		};
		onDidChangeActiveWorkRoot.fire(current);
		assert.strictEqual(summaries.length, 2);
		summaries[1].resolve({ supported: true, reason: '', branch: 'engine-branch', changeCount: 1 });
		await timeout(0);
		assert.strictEqual(folderChip.textContent, 'gamma');
		assert.strictEqual(folderChip.getAttribute('aria-haspopup'), null);
		assert.strictEqual(folderChip.tabIndex, -1);
		assert.strictEqual(folderChevron().hidden, true);
		assert.strictEqual(folderChip.classList.contains(conversationIdentityFolderReadOnlyClass), true);
		assert.ok(!folderChip.getAttribute('aria-label')?.includes('Open the folder list'));
		assert.strictEqual(folderChip.getAttribute('aria-label'), 'Workspace folder: gamma');
		assert.strictEqual(branchChip.hidden, false);
		assert.strictEqual(branchChip.textContent, 'engine-branch');
		assert.strictEqual(branchChip.getAttribute('aria-haspopup'), null);
		assert.strictEqual(branchChip.tabIndex, -1);
		assert.strictEqual(branchChevron().hidden, true);
		assert.strictEqual(branchChip.classList.contains(conversationIdentityBranchReadOnlyClass), true);
		assert.ok(!branchChip.getAttribute('aria-label')?.includes('Open the branch list'));
		const showsBeforeClick = actionWidget.shows.length;
		branchChip.click();
		await timeout(0);
		folderChip.click();
		await timeout(0);
		assert.strictEqual(actionWidget.shows.length, showsBeforeClick);

		current = {
			sessionId: 's-local-again',
			engineIdentityId: 'eng',
			workDir: alpha.path,
			source: 'session',
			access: 'local',
			localRoot: alpha,
			projectKey: `eng\n${alpha.path}`,
		};
		onDidChangeActiveWorkRoot.fire(current);
		assert.strictEqual(branchChip.classList.contains(conversationIdentityBranchReadOnlyClass), false);
		assert.strictEqual(folderChip.classList.contains(conversationIdentityFolderReadOnlyClass), false);
		assert.strictEqual(folderChevron().hidden, false);
		assert.strictEqual(folderChip.getAttribute('aria-haspopup'), 'listbox');
	});
});
