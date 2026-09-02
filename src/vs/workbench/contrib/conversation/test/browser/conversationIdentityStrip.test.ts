/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
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
import { Workspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { ConversationPart, IConversationLensSlots } from '../../../../browser/parts/conversation/conversationPart.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ISCMRepository, ISCMService } from '../../../scm/common/scm.js';
import { TestContextService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import { IConversationReviewNavService } from '../../common/conversationReviewEntry.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationLens } from '../../browser/conversationLens.js';
import {
	conversationIdentityBranchChipClass,
	conversationIdentityEngineChipClass,
	conversationIdentityFolderChipClass,
	conversationIdentityStripClass,
	getConversationIdentityBranchName,
} from '../../browser/conversationIdentityStrip.js';
import { getConnectionPhaseStatusBarText } from '../../browser/conversationSessionStatus.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import {
	conversationLensPhasePreFirstClass,
	conversationLensPrefirstHeroClass,
} from '../../browser/conversationLensDockStrings.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID, OPEN_ENGINE_PREFERENCES_COMMAND_ID } from '../../common/uaPreferencesPanes.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { TestClipboardService } from '../../../../../platform/clipboard/test/common/testClipboardService.js';

const LENS_LAYOUT_WIDTH = 640;
const LENS_LAYOUT_HEIGHT = 480;

suite('ConversationIdentityStrip', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(overrides: Partial<IUniverseAgentConnection> = {}): IUniverseAgentConnection {
		return {
			_serviceBrand: undefined,
			isEngineConnected: () => false,
			getConnectionPhase: () => ({ kind: 'disconnected' }),
			getTransportState: () => 'idle',
			getConnectionSnapshot: () => ({
				transport: 'idle',
				pairingPending: false,
				channelAlive: false,
				capabilities: { methods: [], toolFamilies: [] },
			}),
			getCapabilitySnapshot: () => ({ methods: [], toolFamilies: [] }),
			onDidChangeConnection: Event.None,
			onDidFileMutation: Event.None,
			onDidTurnSettle: Event.None,
			connect: async () => ({ sessionToken: undefined, workDir: undefined, methods: [] }),
			connectProfile: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
			disconnect: async () => { },
			listSessions: async () => ({ sessions: [] }),
			createSession: async () => ({ sessionId: 's' }),
			deleteSession: async () => { },
			getHistory: async () => ({ events: [] }),
			subscribeSessionEventStream: () => ({ dispose: () => { } }),
			chat: async () => { },
			listSkills: async () => ({ skills: [] }),
			setSkillEnabled: async () => ({ ok: true }),
			getSkillInfo: async () => ({ name: '', content: '', source: 'unknown', enabled: false }),
			listAgentProfiles: async () => ({ profiles: [] }),
			saveAgentProfile: async (request) => ({ profile: request.profile }),
			deleteAgentProfile: async () => ({ ok: true }),
			resetAgentProfile: async () => ({ ok: true }),
			listMcpServers: async () => ({ servers: [] }),
			toggleMcpServer: async () => ({ ok: true }),
			addMcpServer: async () => ({ ok: true }),
			updateMcpServer: async () => ({ ok: true }),
			removeMcpServer: async () => ({ ok: true }),
			listTools: async () => ({ tools: [] }),
			...overrides,
		};
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

	function createScmServiceWithBranch(branchName: string): ISCMService {
		const historyItemRef = observableValue('historyItemRef', { id: 'HEAD', name: branchName });
		const historyProvider = {
			historyItemRef,
			historyItemRemoteRef: observableValue('remote', undefined),
			historyItemBaseRef: observableValue('base', undefined),
			historyItemRefChanges: observableValue('changes', { added: [], removed: [], modified: [], silent: true }),
		};
		const provider = {
			id: 'git',
			providerId: 'git',
			label: 'Git',
			name: 'Git',
			groups: [],
			onDidChangeResourceGroups: Event.None,
			onDidChangeResources: Event.None,
			historyProvider: observableValue('historyProvider', historyProvider),
			dispose: () => { },
		};
		const repository = { id: 'git', provider, dispose: () => { } } as unknown as ISCMRepository;
		return {
			_serviceBrand: undefined,
			get repositories() { return [repository]; },
			get repositoryCount() { return 1; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => repository,
		} as unknown as ISCMService;
	}

	function mountLens(options?: {
		workspaceContextService?: IWorkspaceContextService;
		scmService?: ISCMService;
		commandService?: ICommandService;
		stubService?: ConversationStubService;
		connectionOverrides?: Partial<IUniverseAgentConnection>;
	}): { part: ConversationPart; slots: IConversationLensSlots; commandService: ICommandService; stubService: ConversationStubService } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const storageService = store.add(new TestStorageService());
		instantiationService.stub(IStorageService, storageService);
		const stubService = options?.stubService ?? store.add(new ConversationStubService());
		const clipboardService = new TestClipboardService();
		const commandService = options?.commandService ?? new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			readonly executed: string[] = [];
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand<T>(id: string): Promise<T | undefined> {
				this.executed.push(id);
				return Promise.resolve(undefined);
			}
		}();
		const explorerService = {
			_serviceBrand: undefined,
			select: async () => { },
		} as unknown as IExplorerService;

		instantiationService.stub(IConversationRosterService, stubService);
		instantiationService.stub(IUniverseAgentConnection, createConnectionStub(options?.connectionOverrides));
		instantiationService.stub(IConversationTimelineRevealService, {
			_serviceBrand: undefined,
			registerLens: () => ({ dispose: () => { } }),
			revealItem: () => { },
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

		const part = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		parent.classList.add('monaco-workbench');
		parent.style.width = `${LENS_LAYOUT_WIDTH}px`;
		parent.style.height = `${LENS_LAYOUT_HEIGHT}px`;
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));
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
		store.add(instantiationService.createInstance(ConversationLens, slots));

		return { part, slots, commandService, stubService };
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
		const instantiationService = workbenchInstantiationService(undefined, store);
		const storageService = store.add(new TestStorageService());
		instantiationService.stub(IStorageService, storageService);
		const stubService = store.add(new ConversationStubService());
		const clipboardService = new TestClipboardService();
		const commandService = new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			readonly executed: string[] = [];
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand<T>(id: string): Promise<T | undefined> {
				this.executed.push(id);
				return Promise.resolve(undefined);
			}
		}();
		instantiationService.stub(IConversationRosterService, stubService);
		instantiationService.stub(IUniverseAgentConnection, createConnectionStub());
		instantiationService.stub(IConversationTimelineRevealService, {
			_serviceBrand: undefined,
			registerLens: () => ({ dispose: () => { } }),
			revealItem: () => { },
		});
		instantiationService.stub(IConversationReviewNavService, {
			_serviceBrand: undefined,
			onDidChange: Event.None,
			getReviewNavForSession: () => [],
		});
		instantiationService.stub(IClipboardService, clipboardService);
		instantiationService.stub(ICommandService, commandService);
		instantiationService.stub(IExplorerService, {
			_serviceBrand: undefined,
			select: async () => { },
		} as unknown as IExplorerService);
		instantiationService.stub(ISCMService, createEmptyScmService());

		const part = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		parent.classList.add('monaco-workbench');
		parent.style.width = `${LENS_LAYOUT_WIDTH}px`;
		parent.style.height = `${LENS_LAYOUT_HEIGHT}px`;
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));
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
		store.add(instantiationService.createInstance(ConversationLens, slots));

		const emptySessionId = stubService.createSession();
		assert.strictEqual(stubService.getTurns(emptySessionId).length, 0);

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

		assert.strictEqual(slots.sessionBar.querySelector(`.${conversationIdentityStripClass}`), null);
		assert.strictEqual(slots.dock.querySelector(`.${conversationIdentityStripClass}`), null);
		assert.strictEqual(slots.sessionBar.querySelector(`.${conversationIdentityEngineChipClass}`), null);
		assert.strictEqual(slots.dock.querySelector(`.${conversationIdentityEngineChipClass}`), null);
	});

	test('engine chip shows disconnected copy and opens Connection preferences', async () => {
		const { slots, commandService } = mountLens();
		const engineChip = getIdentityStrip(slots).querySelector(`.${conversationIdentityEngineChipClass}`) as HTMLButtonElement;

		assert.ok(engineChip);
		assert.strictEqual(engineChip.textContent, getConnectionPhaseStatusBarText({ kind: 'disconnected' }));
		assert.strictEqual(engineChip.textContent, 'Engine not connected');

		engineChip.click();
		await Promise.resolve();
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, [OPEN_CONNECTION_PREFERENCES_COMMAND_ID]);
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

		engineChip.click();
		await Promise.resolve();
		assert.deepStrictEqual((commandService as unknown as { executed: string[] }).executed, [OPEN_ENGINE_PREFERENCES_COMMAND_ID]);
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

		phase = { kind: 'connecting', reason: 'initial' };
		onDidChangeConnection.fire({
			transport: 'connecting',
			pairingPending: false,
			channelAlive: false,
			capabilities: { methods: [], toolFamilies: [] },
		});
		assert.strictEqual(engineChip.textContent, 'Connecting…');
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

	test('identity strip copy does not mention Copilot or Open Chat', () => {
		const { slots } = mountLens({ scmService: createScmServiceWithBranch('main') });
		const text = getIdentityStrip(slots).textContent ?? '';

		assert.ok(!/copilot/i.test(text));
		assert.ok(!/open chat/i.test(text));
	});
});
