/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Dimension, getActiveElement } from '../../../../../base/browser/dom.js';
import { mainWindow } from '../../../../../base/browser/window.js';
import { DeferredPromise, raceTimeout, timeout } from '../../../../../base/common/async.js';
import { errorHandler, getErrorMessage, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { ConversationPart, IConversationPartService, IConversationPartWindowSlots } from '../../../../browser/parts/conversation/conversationPart.js';
import { IConversationEditorPart, IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { EditorService } from '../../../../services/editor/browser/editorService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { createEditorParts, registerTestEditor, TestFileEditorInput, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SideBySideEditorInput } from '../../../../common/editor/sideBySideEditorInput.js';
import '../../browser/conversationEditor.contribution.js';
import { ConversationEditorPane } from '../../browser/conversationEditorPane.js';
import { ConversationSessionChatContribution } from '../../browser/conversationSessionChat.contribution.js';
import { ConversationNavigationContribution } from '../../browser/conversationNavigation.contribution.js';
import { ConversationNavigationService, IConversationNavigationService } from '../../browser/conversationNavigationService.js';
import { ConversationSessionChatService, IConversationSessionChatService } from '../../browser/conversationSessionChatService.js';
import { switchToSession as switchToSessionHelper } from '../../browser/conversationLensSessionBar.js';
import { ConversationSessionWindowService, IConversationSessionWindowService } from '../../browser/conversationSessionWindowService.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import { IConversationReviewNavService } from '../../browser/conversationReviewEntry.js';
import { ConversationEngineRosterService, ENGINE_BIND_FAILED_SESSION_ID, isEngineRosterPlaceholderSessionId } from '../../browser/conversationEngineRosterService.js';
import { getConversationSessionReadiness } from '../../browser/conversationSessionAvailability.js';
import { isConversationEngineLive, isConversationPairingHold } from '../../browser/conversationSessionStatus.js';
import { stubTurnsToSnapshot } from '../../browser/conversationSessionView.js';
import type { ConversationLens } from '../../browser/conversationLens.js';
import { ConversationEditorPaneId, conversationSessionLeafHiddenClass } from '../../common/conversationSessionWindow.js';
import { UA_CLIENT_CHAT_INPUT_AUTO_FOCUS } from '../../common/uaClientSettingsKeys.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IUniverseAgentSessionView, type IUniverseAgentSessionViewFrameEvent } from '../../../../../platform/universeAgent/common/universeAgentSessionView.js';
import type { ViewLeaseId } from '../../../../../platform/universeAgent/common/sessionView/types.js';
import type { ConnectionPhase } from '../../../../../platform/universeAgent/common/connectionHubTypes.js';
import { ConversationChatInput, getConversationChatResource } from '../../common/conversationChatInput.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { stubConversationTimelineLinkServices } from './conversationTimelineLinkTestStubs.js';
import { installConversationLensResizeObserverHarness } from './conversationLensLayoutHarness.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ISCMService } from '../../../scm/common/scm.js';

declare function __readFileInTests(path: string): Promise<string>;

class QuietRosterService extends ConversationStubService {
	seedSessionQuietly(): string {
		const previous = this.model.getActiveSessionId();
		const sessionId = this.model.createSession();
		this.model.switchSession(previous);
		this._onDidChangeSession.fire(sessionId);
		return sessionId;
	}

	fireActiveSession(sessionId: string): void {
		this._onDidChangeActiveSession.fire(sessionId);
	}

	fireDeletedSession(sessionId: string): void {
		this._onDidDeleteSession.fire(sessionId);
	}
}

/** Public SessionView boundary; production FrameSource still owns replicas and fanout. */
class RevealEngineSessionView extends Disposable implements IUniverseAgentSessionView {
	declare readonly _serviceBrand: undefined;
	readonly acquired: { leaseId: string; sessionId: string }[] = [];
	readonly released = new Set<string>();
	private readonly emitters = new Map<string, Emitter<IUniverseAgentSessionViewFrameEvent>>();
	private readonly versions = new Map<string, number>();
	private readonly listening = new Set<string>();
	private readonly didListen = this._register(new Emitter<string>());
	readonly onDidListen = this.didListen.event;

	onDynamicDidApplyFrame(leaseId: string): Event<IUniverseAgentSessionViewFrameEvent> {
		let emitter = this.emitters.get(leaseId);
		if (!emitter) {
			emitter = this._register(new Emitter<IUniverseAgentSessionViewFrameEvent>({
				onDidAddFirstListener: () => queueMicrotask(() => {
					this.emitLease(leaseId);
					this.listening.add(leaseId);
					this.didListen.fire(leaseId);
				}),
			}));
			this.emitters.set(leaseId, emitter);
		}
		return emitter.event;
	}

	async acquireLease(sessionId: string): Promise<string> {
		const leaseId = `reveal:${sessionId}:${this.acquired.length + 1}`;
		this.acquired.push({ leaseId, sessionId });
		return leaseId;
	}
	async whenEngineSessionReady(sessionId: string): Promise<string> { return sessionId; }
	async releaseLease(leaseId: string): Promise<void> { this.released.add(leaseId); }
	async post(): Promise<never> { throw new Error('lease recovery must not write'); }
	async requestResync(): Promise<void> { }
	async acknowledge(): Promise<void> { }
	async requestDetail() { return { ok: false as const, reason: 'unavailable' as const }; }

	hasSessionListener(sessionId: string): boolean {
		return this.acquired.some(lease => lease.sessionId === sessionId && this.listening.has(lease.leaseId) && !this.released.has(lease.leaseId));
	}

	emitSession(sessionId: string, text: string): void {
		for (const lease of this.acquired) {
			if (lease.sessionId === sessionId) {
				this.emitLease(lease.leaseId, text);
			}
		}
	}

	private emitLease(leaseId: string, text?: string): void {
		const lease = this.acquired.find(candidate => candidate.leaseId === leaseId);
		if (!lease || this.released.has(leaseId)) {
			return;
		}
		const projection = stubTurnsToSnapshot(lease.sessionId, text === undefined ? [] : [
			{ id: `${lease.sessionId}-body`, kind: 'user', text },
			{ id: `${lease.sessionId}-permission`, kind: 'confirmation', text: `Permission for ${lease.sessionId}`, status: 'pending' },
		]);
		const version = (this.versions.get(leaseId) ?? 0) + 1;
		this.versions.set(leaseId, version);
		this.emitters.get(leaseId)?.fire({
			leaseId, sessionId: lease.sessionId, applied: { kind: 'baseline' },
			frame: {
				frame: { leaseId: leaseId as ViewLeaseId, generation: 1, frameId: version, version, body: { kind: 'baseline', snapshot: { ...projection.snapshot, sync: { kind: 'live' } } } },
				attribution: [...projection.attribution].map(([itemId, attribution]) => ({ op: 'upsertAttribution', itemId, attribution })),
			},
		});
	}
}

suite('Conversation session window reveal + leaf SessionBar (C)', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForConversationReveal';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForConversationReveal';

	installConversationLensResizeObserverHarness();

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	teardown(async () => {
		await new Promise<void>(resolve => mainWindow.requestAnimationFrame(() => mainWindow.requestAnimationFrame(() => resolve())));
	});

	setup(function () {
		this.timeout(20_000);
		store.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
	});

	function layoutParts(parts: Awaited<ReturnType<typeof createEditorParts>>): void {
		for (const part of parts.conversationParts) {
			part.layout(800, 600, 0, 0);
		}
	}

	function trackEditors(parts: Awaited<ReturnType<typeof createEditorParts>>): void {
		for (const part of parts.conversationParts) {
			for (const editor of part.activeGroup.editors) {
				store.add(editor);
			}
		}
	}

	async function waitForPane(part: IConversationEditorPart, openErrors: unknown[] = [], parts?: Awaited<ReturnType<typeof createEditorParts>>): Promise<ConversationEditorPane> {
		await part.whenReady;
		const deadline = Date.now() + 3000;
		while (Date.now() < deadline) {
			const pane = part.activeGroup.activeEditorPane;
			if (pane instanceof ConversationEditorPane) {
				if (parts) {
					trackEditors(parts);
				}
				return pane;
			}
			await timeout(20);
		}
		const detail = openErrors.map(error => error instanceof Error ? error.stack ?? error.message : String(error)).join('\n');
		throw new Error(`ConversationEditorPane not ready for ${part.sessionKey}; got ${part.activeGroup.activeEditorPane?.getId()}${detail ? `\n${detail}` : ''}`);
	}

	function partFor(parts: Awaited<ReturnType<typeof createEditorParts>>, sessionKey: string): IConversationEditorPart {
		const part = parts.conversationParts.find(candidate => candidate.sessionKey === sessionKey);
		assert.ok(part, `missing part ${sessionKey}`);
		return part;
	}

	function visibleLeafKeys(windowService: ConversationSessionWindowService): string[] {
		return [...windowService.getVisibleSessionKeys()];
	}

	function hideButton(windowService: ConversationSessionWindowService, sessionKey: string): HTMLButtonElement | null {
		return windowService.getLeafSlots(sessionKey)?.sessionBar.querySelector('.conversation-session-leaf-hide') as HTMLButtonElement | null;
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

	function createLightweightWindowHarness(options?: { delaySlots?: boolean }) {
		const rosterService = store.add(new QuietRosterService());
		const gridHost = document.createElement('div');
		document.body.appendChild(gridHost);
		store.add({ dispose: () => gridHost.remove() });

		const onDidCreateSlots = new Emitter<IConversationPartWindowSlots>();
		store.add(onDidCreateSlots);

		let throwOnCreate = false;
		let rejectWhenReady = false;
		const conversationParts: IConversationEditorPart[] = [];
		const editorGroupsService = {
			createConversationEditorPart: (_parent: unknown, sessionKey: string) => {
				if (throwOnCreate) {
					throw new Error('reveal boom');
				}
				let whenReady: Promise<void> = Promise.resolve();
				if (rejectWhenReady) {
					const rejected = Promise.reject(new Error('whenReady boom'));
					// Keep the rejection observed. Awaiters still reject.
					void rejected.catch(() => { });
					whenReady = rejected;
				}
				const part = { sessionKey, whenReady, activeGroup: { focus: () => { }, activeEditorPane: { getId: () => ConversationEditorPaneId } } } as unknown as IConversationEditorPart;
				conversationParts.push(part);
				return part;
			},
			disposeConversationEditorPart: (sessionKey: string) => {
				const index = conversationParts.findIndex(part => part.sessionKey === sessionKey);
				if (index >= 0) {
					conversationParts.splice(index, 1);
				}
			},
			setFocusedConversationLeaf: () => { },
			getFocusedConversationLeaf: () => undefined,
			get conversationParts() {
				return conversationParts;
			},
		} as unknown as IEditorGroupsService;

		let onNotifyError: ((message: string | Error) => void) | undefined;
		const sessionWindowService = store.add(new ConversationSessionWindowService(
			{
				onDidCreateSlots: onDidCreateSlots.event,
				onDidFocus: Event.None,
				getSlots: () => options?.delaySlots
					? undefined
					: { sessionBar: document.createElement('div'), sessionWindowGrid: gridHost, editorPartHost: undefined },
				setFocusedLeafContainer: () => { },
				focus: () => { },
			} as unknown as IConversationPartService,
			editorGroupsService,
			rosterService,
			new NullLogService(),
			{
				error: (message: string | Error) => {
					onNotifyError?.(message);
				},
			} as INotificationService,
		));

		return {
			sessionWindowService,
			rosterService,
			conversationParts,
			setThrowOnCreate(value: boolean) {
				throwOnCreate = value;
			},
			setRejectWhenReady(value: boolean) {
				rejectWhenReady = value;
			},
			setNotifyError(handler: (message: string | Error) => void) {
				onNotifyError = handler;
			},
			attachSlots() {
				onDidCreateSlots.fire({
					sessionBar: document.createElement('div'),
					sessionWindowGrid: gridHost,
					editorPartHost: undefined,
				});
			},
		};
	}

	async function collectLeafConversationLenses(part: IConversationEditorPart): Promise<ConversationLens[]> {
		const group = part.activeGroup;
		const lenses: ConversationLens[] = [];
		for (const editor of group.editors) {
			await group.openEditor(editor);
			const pane = group.activeEditorPane;
			assert.ok(pane instanceof ConversationEditorPane, `missing ConversationEditorPane for ${editor.resource}`);
			const lens = pane.activeConversationLens;
			assert.ok(lens, `each conversation tab must expose a ConversationLens (${editor.resource})`);
			lenses.push(lens);
		}
		return lenses;
	}

	function countLeafChrome(windowService: ConversationSessionWindowService, conversationPart: ConversationPart): { bars: number; navs: number; partSlotBars: number } {
		let bars = 0;
		let navs = 0;
		for (const key of windowService.getVisibleSessionKeys()) {
			const leaf = windowService.getLeafSlots(key);
			assert.ok(leaf);
			bars += leaf.container.querySelectorAll('.conversation-lens-session-bar').length;
			navs += leaf.container.querySelectorAll('.conversation-window-nav').length;
		}
		const partSlotBars = conversationPart.getSlots()?.sessionBar.querySelectorAll('.conversation-lens-session-bar').length ?? 0;
		return { bars, navs, partSlotBars };
	}

	function stubLensRuntimeServices(instantiationService: ReturnType<typeof workbenchInstantiationService>): void {
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
		instantiationService.stub(IExplorerService, {
			_serviceBrand: undefined,
			select: async () => { },
		} as unknown as IExplorerService);
		instantiationService.stub(ISCMService, {
			_serviceBrand: undefined,
			get repositories() { return []; },
			get repositoryCount() { return 0; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService);
	}

	async function createRevealHarness() {
		return createRevealHarnessWithRoster(store.add(new QuietRosterService()), createConversationConnectionTestStub());
	}

	async function createRevealHarnessWithRoster<R extends ConversationStubService>(rosterService: R, connection: IUniverseAgentConnection, engine = false) {
		const openErrors: unknown[] = [];
		const instantiationService = workbenchInstantiationService({
			configurationService: () => new TestConfigurationService({
				workbench: { editor: { enablePreview: false } },
				[UA_CLIENT_CHAT_INPUT_AUTO_FOCUS]: false,
			}),
		}, store);
		instantiationService.stub(ILogService, {
			error: (error: unknown) => { openErrors.push(error); },
			warn: () => { },
			info: () => { },
			trace: () => { },
			debug: () => { },
			flush: () => { },
			getLevel: () => 0,
			setLevel: () => { },
			onDidChangeLogLevel: Event.None,
		} as unknown as ILogService);
		instantiationService.stub(IConversationRosterService, rosterService);
		instantiationService.stub(IUniverseAgentConnection, connection);
		stubLensRuntimeServices(instantiationService);
		stubConversationTimelineLinkServices(instantiationService);
		instantiationService.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));

		const parts = await createEditorParts(instantiationService, disposables);
		store.add(parts);
		instantiationService.stub(IEditorGroupsService, parts);
		const editorService = disposables.add(instantiationService.createInstance(EditorService, undefined));
		instantiationService.stub(IEditorService, editorService);

		const conversationPart = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		conversationPart.create(parent);
		instantiationService.stub(IConversationPartService, conversationPart);

		const sessionChatService = disposables.add(instantiationService.createInstance(ConversationSessionChatService));
		instantiationService.stub(IConversationSessionChatService, sessionChatService);
		const sessionWindowService = disposables.add(instantiationService.createInstance(ConversationSessionWindowService));
		instantiationService.stub(IConversationSessionWindowService, sessionWindowService);
		const navigationService = disposables.add(instantiationService.createInstance(ConversationNavigationService));
		instantiationService.stub(IConversationNavigationService, navigationService);

		store.add(instantiationService.createInstance(ConversationSessionChatContribution));
		store.add(instantiationService.createInstance(ConversationNavigationContribution));

		const primaryId = rosterService.getActiveSessionId();
		await sessionWindowService.ensurePrimaryWindow(primaryId);
		const primaryPart = partFor(parts, primaryId);
		if (engine) {
			await waitForEnginePane(primaryPart);
		} else {
			await waitForPane(primaryPart, openErrors, parts);
		}
		layoutParts(parts);
		trackEditors(parts);

		return { instantiationService, editorService, parts, conversationPart, rosterService, sessionWindowService, sessionChatService, primaryId, openErrors };
	}

	async function bounded<T>(promise: Promise<T>, message: string): Promise<T> {
		const result = await raceTimeout(promise.then(value => ({ value })), 3000);
		assert.ok(result, message);
		return result.value;
	}

	async function waitForEnginePane(part: IConversationEditorPart): Promise<ConversationEditorPane> {
		await bounded(part.whenReady, 'engine leaf part must become ready');
		if (!(part.activeGroup.activeEditorPane instanceof ConversationEditorPane)) {
			const ready = Event.toPromise(Event.filter(part.activeGroup.onDidActiveEditorChange,
				() => part.activeGroup.activeEditorPane instanceof ConversationEditorPane));
			try {
				await bounded(ready, 'real engine ConversationEditorPane must open');
			} finally {
				ready.cancel();
			}
		}
		const pane = part.activeGroup.activeEditorPane;
		assert.ok(pane instanceof ConversationEditorPane);
		return pane;
	}

	async function createEngineRevealHarness(beforePane?: (roster: ConversationEngineRosterService) => void) {
		type Catalog = Awaited<ReturnType<IUniverseAgentConnection['listSessions']>>;
		const requests: { started: DeferredPromise<void>; result: DeferredPromise<Catalog> }[] = [];
		const allRequests: typeof requests = [];
		let phase: ConnectionPhase = { kind: 'disconnected' };
		let pairingPending = false;
		const connectionEmitter = store.add(new Emitter<ReturnType<IUniverseAgentConnection['getConnectionSnapshot']>>());
		const base = createConversationConnectionTestStub();
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => isConversationEngineLive(phase, pairingPending),
			getConnectionPhase: () => phase,
			getTransportState: () => 'ok',
			getConnectionSnapshot: () => ({ ...base.getConnectionSnapshot(), transport: 'ok', channelAlive: phase.kind !== 'disconnected', pairingPending, engineIdentityId: 'reveal-engine', linkId: 1 }),
			onDidChangeConnection: connectionEmitter.event,
			listSessions: () => {
				const request = requests.shift();
				assert.ok(request, 'every real catalog request must have an explicit Deferred');
				void request.started.complete();
				return request.result.p;
			},
		});
		const sessionView = store.add(new RevealEngineSessionView());
		const rosterService = store.add(new ConversationEngineRosterService(connection, sessionView, { _serviceBrand: undefined, shouldAdvertise: () => true }));
		// Every pending list settles before service teardown, including failed setup paths.
		store.add(toDisposable(() => {
			for (const request of allRequests) {
				if (!request.result.isSettled) {
					void request.result.complete({ sessions: [] });
				}
			}
		}));
		const deferCatalog = () => {
			const request = { started: new DeferredPromise<void>(), result: new DeferredPromise<Catalog>() };
			requests.push(request);
			allRequests.push(request);
			return request;
		};
		const notify = (kind: 'live' | 'disconnected' | 'connected pairing' | 'connecting pairing') => {
			pairingPending = kind === 'connected pairing' || kind === 'connecting pairing';
			phase = kind === 'disconnected' ? { kind: 'disconnected' }
				: kind === 'connecting pairing' ? { kind: 'connecting', reason: 'initial' }
					: { kind: 'connected', path: 'loopback' };
			connectionEmitter.fire(connection.getConnectionSnapshot());
		};
		const catalog: Catalog = { sessions: [{ sessionId: 'lease-s1', title: 'Lease s1' }, { sessionId: 'lease-s2', title: 'Lease s2' }] };
		const initial = deferCatalog();
		notify('live');
		await bounded(initial.started.p, 'initial real catalog must start');
		await initial.result.complete(catalog);
		await bounded(rosterService.whenEngineCatalogRefreshComplete(), 'initial real catalog must finish');
		assert.strictEqual(getConversationSessionReadiness(rosterService), 'ready');
		beforePane?.(rosterService);
		const harness = await createRevealHarnessWithRoster(rosterService, connection, true);
		const pane = await waitForEnginePane(partFor(harness.parts, harness.primaryId));
		const lens = pane.activeConversationLens;
		assert.ok(lens);
		assert.ok(lens.sessionViewLease, 'initial real visible owner must have a lease');
		if (lens.sessionViewLease.snapshot.sessionId !== harness.primaryId) {
			const baseline = Event.toPromise(lens.sessionViewLease.onDidApplyFrame);
			try {
				await bounded(baseline, 'initial host baseline must reach the Pane lease');
			} finally {
				baseline.cancel();
			}
		}
		assert.strictEqual(lens.sessionViewLease.snapshot.sessionId, harness.primaryId);
		return { ...harness, pane, lens, connection, sessionView, deferCatalog, notify, catalog };
	}

	type EngineRevealHarness = Awaited<ReturnType<typeof createEngineRevealHarness>>;

	function assertVisibleMissing(harness: EngineRevealHarness, pane = harness.pane, key = harness.primaryId): ConversationLens {
		const lens = pane.activeConversationLens;
		assert.ok(lens);
		assert.strictEqual(lens.boundSessionId, key);
		assert.strictEqual(lens.isDisposed, false);
		assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible(key), true);
		assert.strictEqual(lens.sessionViewBindingSuspended, false);
		assert.strictEqual(lens.sessionViewLease, undefined, 'real connection/Binding must naturally remove the empty owner lease');
		return lens;
	}

	async function startEmptyCatalogRefresh(harness: EngineRevealHarness, reconnect = false) {
		const request = harness.deferCatalog();
		if (reconnect) {
			harness.notify('disconnected');
		}
		harness.notify('live');
		await bounded(request.started.p, 'real replacement listSessions must start');
		assert.strictEqual(getConversationSessionReadiness(harness.rosterService), 'loading');
		assert.strictEqual(harness.pane.activeConversationLens, harness.lens);
		assertVisibleMissing(harness);
		return request;
	}

	async function completeCatalog(harness: EngineRevealHarness, request: ReturnType<EngineRevealHarness['deferCatalog']>): Promise<void> {
		await request.result.complete(harness.catalog);
		await bounded(harness.rosterService.whenEngineCatalogRefreshComplete(), 'real catalog must settle');
		assert.strictEqual(getConversationSessionReadiness(harness.rosterService), 'ready');
	}

	function observePaneBinds(lens: ConversationLens): () => number {
		let calls = 0;
		const original = lens.bindSessionView;
		lens.bindSessionView = sessionId => {
			calls++;
			original.call(lens, sessionId);
		};
		store.add(toDisposable(() => { lens.bindSessionView = original; }));
		return () => calls;
	}

	async function assertEngineFramePaints(harness: EngineRevealHarness, pane: ConversationEditorPane, sessionId: string, text: string): Promise<void> {
		const lens = pane.activeConversationLens;
		assert.ok(lens);
		const lease = lens.sessionViewLease;
		assert.ok(lease, 'this actual Pane must own the recovered lease');
		assert.strictEqual(lease.sessionId, sessionId);
		if (!harness.sessionView.hasSessionListener(sessionId)) {
			const listening = Event.toPromise(Event.filter(harness.sessionView.onDidListen, () => harness.sessionView.hasSessionListener(sessionId)));
			try {
				await bounded(listening, 'actual host lease acquire and frame listener must complete');
			} finally {
				listening.cancel();
			}
		}
		const column = pane.getReadingColumn();
		assert.ok(column);
		const painted = new DeferredPromise<void>();
		const check = () => {
			const body = column.querySelector(`.conversation-lens-turn[data-turn-id="${sessionId}-body"] .conversation-lens-turn-body`);
			const pending = column.querySelector(`.conversation-lens-confirmation-seat[data-turn-id="${sessionId}-permission"]`);
			if (body?.textContent === text && pending?.textContent?.includes(`Permission for ${sessionId}`)) {
				void painted.complete();
			}
		};
		const observer = new MutationObserver(check);
		observer.observe(column, { childList: true, characterData: true, subtree: true });
		const admitted = Event.toPromise(lease.onDidApplyFrame);
		try {
			harness.sessionView.emitSession(sessionId, text);
			await bounded(admitted, 'frame must be admitted by the actual Pane lease');
			pane.layout({ width: 800, height: 600 });
			check();
			await bounded(painted.p, 'actual Pane turn and pending seat must paint through TimelineHost');
			assert.strictEqual(lens.sessionViewLease, lease);
			assert.strictEqual(lease.snapshot.timeline.length, 2);
			assert.strictEqual(lease.snapshot.pendingActions.length, 1);
		} finally {
			observer.disconnect();
			admitted.cancel();
		}
	}

	async function waitForSessionPane(
		harness: Awaited<ReturnType<typeof createRevealHarness>>,
		sessionKey: string,
	): Promise<ConversationEditorPane> {
		return waitForPane(partFor(harness.parts, sessionKey), harness.openErrors, harness.parts);
	}

	suite('visible engine lease recovery', () => {
		test('L1 same visible empty owner recovers its own lease after same-session catalog ready without reveal', async () => {
			const harness = await createEngineRevealHarness();
			const { pane, lens, primaryId, rosterService } = harness;
			const input = pane.input;
			assert.ok(input);
			assert.strictEqual(lens.lastAttachedEntries.length, 0);
			assert.strictEqual(lens.sessionViewLease?.snapshot.timeline.length, 0);
			const pending = await startEmptyCatalogRefresh(harness, true);
			assert.strictEqual(pane.input, input);
			let activeChanges = 0;
			const activeListener = store.add(rosterService.onDidChangeActiveSession(() => { activeChanges++; }));
			await completeCatalog(harness, pending);
			assert.strictEqual(rosterService.getActiveSessionId(), primaryId);
			assert.strictEqual(activeChanges, 0, 'same-session recovery must not rely on an active-id event');
			assert.strictEqual(pane.input, input);
			assert.strictEqual(pane.activeConversationLens, lens);
			assert.strictEqual(lens.boundSessionId, primaryId);
			assert.strictEqual(lens.isDisposed, false);
			assert.strictEqual(isConversationEngineLive(harness.connection.getConnectionPhase(), harness.connection.getConnectionSnapshot().pairingPending), true);
			assert.strictEqual(isConversationPairingHold(harness.connection), false);
			assert.ok(lens.sessionViewLease, 'catalog ready must restore this visible Pane lease without hide/reveal');
			assert.strictEqual(lens.sessionViewLease.sessionId, primaryId);
			activeListener.dispose();
			await assertEngineFramePaints(harness, pane, primaryId, 'L1 recovered Pane body');
		});

		test('L2 continuously live nonempty owner keeps lease snapshot entries and text through catalog pending failure and ready', async () => {
			const harness = await createEngineRevealHarness();
			await assertEngineFramePaints(harness, harness.pane, harness.primaryId, 'L2 keep this body');
			const lease = harness.lens.sessionViewLease;
			assert.ok(lease);
			const snapshot = lease.snapshot;
			const entries = harness.lens.lastAttachedEntries;
			const input = harness.pane.input;
			const assertKept = () => {
				assert.strictEqual(harness.pane.input, input);
				assert.strictEqual(harness.pane.activeConversationLens, harness.lens);
				assert.strictEqual(harness.connection.getConnectionSnapshot().engineIdentityId, 'reveal-engine');
				assert.strictEqual(isConversationEngineLive(harness.connection.getConnectionPhase(), harness.connection.getConnectionSnapshot().pairingPending), true);
				assert.strictEqual(isConversationPairingHold(harness.connection), false);
				assert.strictEqual(harness.rosterService.getActiveSessionId(), harness.primaryId);
				assert.strictEqual(harness.lens.boundSessionId, harness.primaryId);
				assert.strictEqual(harness.lens.sessionViewLease, lease);
				assert.strictEqual(lease.snapshot, snapshot);
				assert.strictEqual(harness.lens.lastAttachedEntries, entries);
				assert.strictEqual(harness.pane.getReadingColumn()?.querySelector(`.conversation-lens-turn[data-turn-id="${harness.primaryId}-body"] .conversation-lens-turn-body`)?.textContent, 'L2 keep this body');
			};
			const failed = harness.deferCatalog();
			harness.notify('live');
			await bounded(failed.started.p, 'same-live catalog refresh must start');
			assert.strictEqual(getConversationSessionReadiness(harness.rosterService), 'loading');
			assertKept();
			await failed.result.error(new Error('catalog unavailable'));
			await bounded(harness.rosterService.whenEngineCatalogRefreshComplete(), 'failed real list must settle');
			assert.strictEqual(getConversationSessionReadiness(harness.rosterService), 'unavailable');
			assertKept();
			const recovered = harness.deferCatalog();
			harness.notify('live');
			await bounded(recovered.started.p, 'same-live recovery list must start');
			assertKept();
			await completeCatalog(harness, recovered);
			assertKept();
		});

		test('L3 loading and real list rejection leave a visible empty owner missing until successful ready', async () => {
			const harness = await createEngineRevealHarness();
			const failed = await startEmptyCatalogRefresh(harness);
			const binds = observePaneBinds(harness.lens);
			assertVisibleMissing(harness);
			await failed.result.error(new Error('listSessions rejected'));
			await bounded(harness.rosterService.whenEngineCatalogRefreshComplete(), 'real rejected list must settle');
			assert.strictEqual(getConversationSessionReadiness(harness.rosterService), 'unavailable');
			assertVisibleMissing(harness);
			assert.strictEqual(binds(), 0);
			const recovery = await startEmptyCatalogRefresh(harness);
			const beforeReady = binds();
			await completeCatalog(harness, recovery);
			assert.strictEqual(binds() - beforeReady, 1, 'the session-ready listener must call the real Pane bind once');
			await assertEngineFramePaints(harness, harness.pane, harness.primaryId, 'L3 catalog recovery');
		});

		for (const state of ['disconnected', 'connected pairing', 'connecting pairing'] as const) {
			test(`L3 ${state} QueueReader session window keeps a naturally missing visible owner unbound`, async () => {
				let harness: EngineRevealHarness | undefined;
				let armed = false;
				let binds: (() => number) | undefined;
				const order: string[] = [];
				const capture = (position: 'before' | 'after') => {
					assert.ok(harness);
					assert.ok(binds);
					const lens = harness.pane.activeConversationLens;
					assert.ok(lens);
					return {
						position, pane: harness.pane, input: harness.pane.input, lens,
						bound: lens.boundSessionId, visible: harness.sessionWindowService.isSessionWindowVisible(harness.primaryId),
						suspended: lens.sessionViewBindingSuspended, disposed: lens.isDisposed, lease: lens.sessionViewLease,
						phase: harness.connection.getConnectionPhase().kind, pairing: harness.connection.getConnectionSnapshot().pairingPending,
						connected: harness.rosterService.isEngineConnected(), readiness: getConversationSessionReadiness(harness.rosterService),
						queue: harness.rosterService.getMessageQueueState(harness.primaryId).readState, bindCalls: binds(),
					};
				};
				const samples: ReturnType<typeof capture>[] = [];
				harness = await createEngineRevealHarness(roster => {
					store.add(roster.onDidChangeSession(id => {
						if (armed && id === 'lease-s1' && samples.length === 0 && roster.getMessageQueueState(id).readState === 'stale') {
							order.push('session before');
							samples.push(capture('before'));
						}
					}));
				});
				const current = harness;
				binds = observePaneBinds(current.lens);
				store.add(current.rosterService.onDidChangeSession(id => {
					if (armed && id === current.primaryId && samples.length === 1) {
						order.push('session after');
						samples.push(capture('after'));
					}
				}));
				const pending = await startEmptyCatalogRefresh(current);
				assert.strictEqual(current.rosterService.getMessageQueueState(current.primaryId).readState, 'unsupported');
				const beforeCalls = binds();
				const input = current.pane.input;
				armed = true;
				order.push('UA start');
				current.notify(state);
				order.push('UA return');
				armed = false;
				assert.deepStrictEqual(order, ['UA start', 'session before', 'session after', 'UA return'], 'QueueReader must expose the actual independent callback window');
				assert.strictEqual(samples.length, 2);
				for (const sample of samples) {
					assert.strictEqual(sample.pane, current.pane);
					assert.strictEqual(sample.input, input);
					assert.strictEqual(sample.lens, current.lens);
					assert.strictEqual(sample.bound, current.primaryId);
					assert.strictEqual(sample.visible, true);
					assert.strictEqual(sample.suspended, false);
					assert.strictEqual(sample.disposed, false);
					assert.strictEqual(sample.lease, undefined);
					assert.strictEqual(sample.phase, state === 'disconnected' ? 'disconnected' : state === 'connecting pairing' ? 'connecting' : 'connected');
					assert.strictEqual(sample.pairing, state !== 'disconnected');
					assert.strictEqual(sample.connected, false);
					assert.strictEqual(sample.readiness, 'ready');
					assert.strictEqual(sample.queue, 'stale');
					assert.strictEqual(sample.bindCalls, beforeCalls, 'new reconcile must not bind within the non-live callback window');
				}
				// Later existing connection callbacks may legitimately bind a cache; drain that scope separately.
				await pending.result.complete(current.catalog);
				await bounded(current.rosterService.whenEngineCatalogRefreshComplete(), 'stale pending catalog must drain');
				const recovery = await startEmptyCatalogRefresh(current);
				await completeCatalog(current, recovery);
				await assertEngineFramePaints(current, current.pane, current.primaryId, `L3 ${state} restored`);
			});
		}

		test('L4 hidden suspended owner stays unbound through failed and ready catalogs until public restore', async () => {
			const harness = await createEngineRevealHarness();
			await harness.sessionWindowService.openSessionBeside('lease-s2');
			const pane = await waitForEnginePane(partFor(harness.parts, 'lease-s2'));
			trackEditors(harness.parts);
			const lens = pane.activeConversationLens;
			assert.ok(lens?.sessionViewLease);
			harness.sessionWindowService.hideSessionWindow('lease-s2');
			assert.strictEqual(lens.sessionViewBindingSuspended, true);
			assert.strictEqual(lens.sessionViewLease, undefined);
			const binds = observePaneBinds(lens);
			const failed = harness.deferCatalog();
			harness.notify('live');
			await bounded(failed.started.p, 'hidden control real list must start');
			await failed.result.error(new Error('hidden catalog failure'));
			await bounded(harness.rosterService.whenEngineCatalogRefreshComplete(), 'hidden failure must settle');
			assert.strictEqual(lens.sessionViewLease, undefined);
			assert.strictEqual(binds(), 0);
			const ready = harness.deferCatalog();
			harness.notify('live');
			await bounded(ready.started.p, 'hidden recovery list must start');
			await completeCatalog(harness, ready);
			assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible('lease-s2'), false);
			assert.strictEqual(lens.sessionViewBindingSuspended, true);
			assert.strictEqual(lens.sessionViewLease, undefined);
			assert.strictEqual(binds(), 0);
			harness.sessionWindowService.restoreSessionWindow('lease-s2');
			assert.strictEqual(lens.sessionViewBindingSuspended, false);
			assert.strictEqual(lens.sessionViewLease?.sessionId, 'lease-s2');
			await assertEngineFramePaints(harness, pane, 'lease-s2', 'L4 public restore');
			const retiredLease = lens.sessionViewLease;
			assert.ok(retiredLease);
			const retainedObserver = store.add(harness.rosterService.acquireSessionView('lease-s2'));
			assert.notStrictEqual(retainedObserver, retiredLease);
			const hostLease = harness.sessionView.acquired.find(lease => lease.sessionId === 'lease-s2' && !harness.sessionView.released.has(lease.leaseId));
			assert.ok(hostLease, 'the restored Pane and observer must share an acquired s2 host lease');
			let retiredFrames = 0;
			store.add(retiredLease.onDidApplyFrame(() => { retiredFrames++; }));
			const removed = harness.deferCatalog();
			harness.notify('live');
			await bounded(removed.started.p, 'public removal catalog must start');
			const survivingCatalog = { sessions: harness.catalog.sessions.filter(session => session.sessionId !== 'lease-s2') };
			await removed.result.complete(survivingCatalog);
			await bounded(harness.rosterService.whenEngineCatalogRefreshComplete(), 'public prune must settle');
			assert.strictEqual(harness.sessionWindowService.getLeafSlots('lease-s2'), undefined);
			assert.strictEqual(harness.sessionWindowService.isSessionWindowHidden('lease-s2'), false);
			assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible('lease-s2'), false);
			assert.strictEqual(lens.isDisposed, true);
			const retiredSnapshot = retiredLease.snapshot;
			const framesAfterRemoval = retiredFrames;
			const observed = Event.toPromise(retainedObserver.onDidApplyFrame);
			try {
				harness.sessionView.emitSession('lease-s2', 'L4 retained observer only');
				await bounded(observed, 'the live retained observer must admit the post-prune host frame');
				assert.notStrictEqual(retainedObserver.snapshot, retiredSnapshot);
				assert.strictEqual(retiredLease.snapshot, retiredSnapshot, 'the disposed Pane lease must no longer receive shared host snapshots');
				assert.strictEqual(retiredFrames, framesAfterRemoval);
			} finally {
				observed.cancel();
				retainedObserver.dispose();
			}
			assert.strictEqual(harness.sessionView.released.has(hostLease.leaseId), true, 'the retired Pane and roster must release their ownership before the final observer releases the host');
			const afterRemoval = binds();
			const late = harness.deferCatalog();
			harness.notify('live');
			await bounded(late.started.p, 'post-removal catalog must start');
			await late.result.complete(survivingCatalog);
			await bounded(harness.rosterService.whenEngineCatalogRefreshComplete(), 'post-removal catalog must settle');
			assert.strictEqual(binds(), afterRemoval, 'later ready notices cannot revive the removed non-hidden leaf');
			assert.strictEqual(retiredLease.snapshot, retiredSnapshot);
			assert.strictEqual(retiredFrames, framesAfterRemoval);
			assert.strictEqual(harness.sessionView.released.has(hostLease.leaseId), true);
			await assertEngineFramePaints(harness, harness.pane, harness.primaryId, 'L4 surviving owner');
		});

		test('L4 an unmounted non-hidden bound key cannot reconcile before its public leaf exists', async () => {
			const harness = await createEngineRevealHarness();
			const pending = await startEmptyCatalogRefresh(harness);
			const input = store.add(new ConversationChatInput(getConversationChatResource('lease-s2', 'unmounted')));
			const part = partFor(harness.parts, harness.primaryId);
			await harness.editorService.openEditor(input, undefined, part.activeGroup);
			const pane = part.activeGroup.activeEditorPane;
			assert.ok(pane instanceof ConversationEditorPane);
			const lens = pane.activeConversationLens;
			assert.ok(lens);
			assert.strictEqual(pane.input, input);
			assert.strictEqual(lens.boundSessionId, 'lease-s2');
			assert.strictEqual(lens.sessionViewLease, undefined);
			assert.strictEqual(lens.sessionViewBindingSuspended, false);
			assert.strictEqual(harness.sessionWindowService.isSessionWindowHidden('lease-s2'), false);
			assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible('lease-s2'), false);
			const binds = observePaneBinds(lens);
			await completeCatalog(harness, pending);
			assert.strictEqual(lens.sessionViewLease, undefined);
			assert.strictEqual(binds(), 0, 'not-hidden is not evidence of a visible leaf');
			await harness.sessionWindowService.openSessionBeside('lease-s2');
			const mounted = await waitForEnginePane(partFor(harness.parts, 'lease-s2'));
			trackEditors(harness.parts);
			await assertEngineFramePaints(harness, mounted, 'lease-s2', 'L4 mounted successor');
		});

		for (const action of ['clearInput', 'dispose', 'switch input'] as const) {
			test(`L5 ${action} during real catalog pending cannot revive the captured owner`, async () => {
				const harness = await createEngineRevealHarness();
				const pending = await startEmptyCatalogRefresh(harness);
				const oldInput = harness.pane.input;
				const oldLens = harness.lens;
				const oldBinds = observePaneBinds(oldLens);
				if (action === 'clearInput') {
					harness.pane.clearInput();
				} else if (action === 'dispose') {
					harness.pane.dispose();
				} else {
					const input = store.add(new ConversationChatInput(getConversationChatResource(harness.primaryId, 'successor')));
					await harness.editorService.openEditor(input, undefined, partFor(harness.parts, harness.primaryId).activeGroup);
					assert.strictEqual(harness.pane.input, input);
					assert.notStrictEqual(harness.pane.input, oldInput);
				}
				const beforeReady = oldBinds();
				await completeCatalog(harness, pending);
				if (action === 'switch input') {
					assert.strictEqual(harness.pane.activeConversationLens?.boundSessionId, harness.primaryId);
					assert.strictEqual(oldBinds() - beforeReady, 1, 'only the current input listener may reconcile');
					assert.strictEqual(harness.pane.activeConversationLens?.sessionViewLease?.sessionId, harness.primaryId);
				} else {
					assert.strictEqual(harness.pane.activeConversationLens, undefined);
					assert.strictEqual(oldLens.isDisposed, true);
					assert.strictEqual(oldBinds(), beforeReady, 'late catalog/session notices cannot bind the retired owner');
				}
			});
		}

		test('L6 repeated real session notices keep the recovered lease and continue delivering frames', async () => {
			const harness = await createEngineRevealHarness();
			const pending = await startEmptyCatalogRefresh(harness);
			await completeCatalog(harness, pending);
			await assertEngineFramePaints(harness, harness.pane, harness.primaryId, 'L6 first frame');
			const lease = harness.lens.sessionViewLease;
			assert.ok(lease);
			const count = harness.sessionView.acquired.length;
			for (let i = 0; i < 2; i++) {
				const refresh = harness.deferCatalog();
				harness.notify('live');
				await bounded(refresh.started.p, 'duplicate real refresh must start');
				await completeCatalog(harness, refresh);
				assert.strictEqual(harness.lens.sessionViewLease, lease);
				assert.strictEqual(harness.sessionView.acquired.length, count, 'observation owners must not imply a new physical acquisition');
			}
			await assertEngineFramePaints(harness, harness.pane, harness.primaryId, 'L6 later frame');
			assert.strictEqual(harness.lens.sessionViewLease, lease);
		});

		test('L7 two pinned visible owners recover their own bounds from one active-session catalog notice', async () => {
			const harness = await createEngineRevealHarness();
			await harness.sessionWindowService.openSessionBeside('lease-s2');
			const second = await waitForEnginePane(partFor(harness.parts, 'lease-s2'));
			trackEditors(harness.parts);
			const lens2 = second.activeConversationLens;
			assert.ok(lens2?.sessionViewLease);
			await harness.sessionWindowService.revealSessionWindow(harness.primaryId);
			assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible(harness.primaryId), true);
			assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible('lease-s2'), true);
			const pending = await startEmptyCatalogRefresh(harness);
			assertVisibleMissing(harness, second, 'lease-s2');
			const active = harness.rosterService.getActiveSessionId();
			const notified: string[] = [];
			store.add(harness.rosterService.onDidChangeSession(id => { notified.push(id); }));
			await completeCatalog(harness, pending);
			assert.ok(notified.includes(active));
			assert.ok(!notified.includes('lease-s2'), 'the inactive pinned leaf cannot rely on its own event id');
			assert.strictEqual(harness.pane.activeConversationLens, harness.lens);
			assert.strictEqual(second.activeConversationLens, lens2);
			assert.strictEqual(harness.lens.sessionViewLease?.sessionId, harness.primaryId);
			assert.strictEqual(lens2.sessionViewLease?.sessionId, 'lease-s2');
			assert.notStrictEqual(harness.lens.sessionViewLease, lens2.sessionViewLease);
			await assertEngineFramePaints(harness, harness.pane, harness.primaryId, 'L7 first leaf only');
			await assertEngineFramePaints(harness, second, 'lease-s2', 'L7 second leaf only');
			assert.ok(!harness.pane.getReadingColumn()?.textContent?.includes('L7 second leaf only'));
			assert.ok(!second.getReadingColumn()?.textContent?.includes('L7 first leaf only'));
		});
	});

	test('8 single-leaf reveal A→B→A keeps one visible primary without hide button', async () => {
		const harness = await createRevealHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();

		await sessionWindowService.revealSessionWindow(b);
		const partB = partFor(parts, b);
		await waitForSessionPane(harness, b);
		assert.deepStrictEqual(visibleLeafKeys(sessionWindowService), [b]);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), b);
		assert.strictEqual(partB.sessionKey, b);
		assert.strictEqual(parts.getActiveConversationEditorPart()?.sessionKey, b);
		assert.ok(sessionWindowService.isSessionWindowHidden(primaryId));
		assert.strictEqual(partFor(parts, primaryId).sessionKey, primaryId);
		assert.strictEqual(hideButton(sessionWindowService, b)?.hidden, true);

		await sessionWindowService.revealSessionWindow(primaryId);
		await waitForSessionPane(harness, primaryId);
		assert.deepStrictEqual(visibleLeafKeys(sessionWindowService), [primaryId]);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), primaryId);
		assert.strictEqual(hideButton(sessionWindowService, primaryId)?.hidden, true);
	});

	test('hide focused secondary leaf moves focus to primary', async () => {
		const harness = createLightweightWindowHarness();
		await timeout(0);
		const primaryId = harness.rosterService.getActiveSessionId();
		await harness.sessionWindowService.ensurePrimaryWindow(primaryId);
		const secondaryId = harness.rosterService.seedSessionQuietly();
		await harness.sessionWindowService.openSessionBeside(secondaryId);
		await harness.sessionWindowService.revealSessionWindow(secondaryId);
		assert.strictEqual(harness.sessionWindowService.getFocusedLeafSessionKey(), secondaryId);

		harness.sessionWindowService.hideSessionWindow(secondaryId);

		assert.strictEqual(harness.sessionWindowService.isSessionWindowHidden(secondaryId), true);
		assert.strictEqual(harness.sessionWindowService.getFocusedLeafSessionKey(), primaryId);
		const primaryLeaf = harness.sessionWindowService.getLeafSlots(primaryId)!;
		const active = getActiveElement();
		assert.ok(
			primaryLeaf.container === active || primaryLeaf.container.contains(active),
			'focus must leave the hidden leaf and land on the visible primary',
		);
	});

	test('8 two visible leaves: reveal already-visible leaf focuses it', async () => {
		const harness = await createRevealHarness();
		const { parts, sessionWindowService, rosterService, primaryId, conversationPart } = harness;
		const b = rosterService.seedSessionQuietly();
		await sessionWindowService.openSessionBeside(b);
		await waitForSessionPane(harness, b);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);

		await sessionWindowService.revealSessionWindow(b);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
		assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), b);
		assert.strictEqual(rosterService.getActiveSessionId(), b);
		assert.strictEqual(parts.getActiveConversationEditorPart()?.sessionKey, b);
		const leafB = sessionWindowService.getLeafSlots(b);
		assert.ok(leafB);
		const active = getActiveElement();
		assert.ok(
			leafB.container === active || leafB.container.contains(active),
			'focus must stay in the revealed leaf, not snap back to primary',
		);
		const chrome = countLeafChrome(sessionWindowService, conversationPart);
		assert.strictEqual(chrome.bars, 2);
		assert.strictEqual(partFor(parts, primaryId).sessionKey, primaryId);
		assert.strictEqual(partFor(parts, b).sessionKey, b);
	});

	test('cancelled already-visible reveal does not switch the active session back', async () => {
		const harness = await createRevealHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		await sessionWindowService.openSessionBeside(b);
		const paneA = await waitForSessionPane(harness, primaryId);
		const paneB = await waitForSessionPane(harness, b);
		assert.ok(paneA.leafSessionBarHost);
		assert.ok(paneB.leafSessionBarHost);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);

		let releaseA = () => { };
		const gate = new Promise<void>(resolve => { releaseA = resolve; });
		(partFor(parts, primaryId) as { whenReady: Promise<void> }).whenReady = gate;

		const switched: string[] = [];
		const originalSwitch = rosterService.switchSession.bind(rosterService);
		rosterService.switchSession = (sessionId: string) => {
			switched.push(sessionId);
			originalSwitch(sessionId);
		};

		const first = paneA.leafSessionBarHost.switchLeafSession(primaryId);
		try {
			await timeout(0);
			await paneB.leafSessionBarHost.switchLeafSession(b);
			assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), b);
			assert.strictEqual(rosterService.getActiveSessionId(), b);
			switched.length = 0;
			releaseA();
			await first;
			assert.deepStrictEqual(switched, []);
			assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), b);
			assert.strictEqual(rosterService.getActiveSessionId(), b);
		} finally {
			releaseA();
		}
	});

	test('hide during pane-less reveal wait does not steal focus or the active session', async function () {
		this.timeout(15_000);
		const harness = createLightweightWindowHarness();
		await timeout(0);
		const { sessionWindowService, rosterService, conversationParts } = harness;
		const primaryId = rosterService.getActiveSessionId();
		await sessionWindowService.ensurePrimaryWindow(primaryId);
		const secondaryId = rosterService.seedSessionQuietly();
		await sessionWindowService.openSessionBeside(secondaryId);
		assert.strictEqual(sessionWindowService.isSessionWindowVisible(primaryId), true);
		assert.strictEqual(sessionWindowService.isSessionWindowVisible(secondaryId), true);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);

		const secondaryPart = conversationParts.find(part => part.sessionKey === secondaryId);
		assert.ok(secondaryPart);
		const group = secondaryPart.activeGroup as { activeEditorPane?: { getId(): string }; onDidActiveEditorChange?: Event<unknown> };
		group.activeEditorPane = undefined;
		group.onDidActiveEditorChange = Event.None;

		await sessionWindowService.revealSessionWindow(primaryId);
		assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), primaryId);
		assert.strictEqual(rosterService.getActiveSessionId(), primaryId);
		const primaryLeaf = sessionWindowService.getLeafSlots(primaryId)!;
		const activeBefore = getActiveElement();
		assert.ok(
			primaryLeaf.container === activeBefore || primaryLeaf.container.contains(activeBefore),
			'primary must own focus before the stalled reveal',
		);

		const switched: string[] = [];
		const originalSwitch = rosterService.switchSession.bind(rosterService);
		rosterService.switchSession = (sessionId: string) => {
			switched.push(sessionId);
			originalSwitch(sessionId);
		};

		let settled = false;
		const reveal = sessionWindowService.revealSessionWindow(secondaryId).finally(() => { settled = true; });
		await timeout(0);
		assert.strictEqual(settled, false, 'reveal must still be waiting for an editor pane');
		assert.strictEqual(sessionWindowService.isSessionWindowVisible(secondaryId), true);

		sessionWindowService.hideSessionWindow(secondaryId);
		assert.strictEqual(sessionWindowService.isSessionWindowHidden(secondaryId), true);
		assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), primaryId);
		assert.strictEqual(rosterService.getActiveSessionId(), primaryId);
		const activeDuring = getActiveElement();
		assert.ok(
			primaryLeaf.container === activeDuring || primaryLeaf.container.contains(activeDuring),
			'focus must stay on the primary while the hidden leaf is still waiting',
		);

		await reveal;
		assert.strictEqual(settled, true);
		assert.strictEqual(sessionWindowService.isSessionWindowHidden(secondaryId), true);
		assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), primaryId);
		assert.strictEqual(rosterService.getActiveSessionId(), primaryId);
		const activeAfter = getActiveElement();
		assert.ok(
			primaryLeaf.container === activeAfter || primaryLeaf.container.contains(activeAfter),
			'focus must stay on the primary after the pane wait ends',
		);
		assert.deepStrictEqual(switched, []);
	});

	test('10 SelectBox path on real pane changes the leaf (PRD-002 #1)', async () => {
		const harness = await createRevealHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		const pane = await waitForSessionPane(harness, primaryId);
		assert.ok(pane.leafSessionBarHost);
		await pane.leafSessionBarHost!.switchLeafSession(b);
		await waitForSessionPane(harness, b);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), b);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 1);
		assert.ok(partFor(parts, b).activeGroup.activeEditor);
	});

	test('10 two visible leaves: SelectBox on one leaf replaces that leaf with a third session', async () => {
		const harness = await createRevealHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		const c = rosterService.seedSessionQuietly();
		await sessionWindowService.openSessionBeside(b);
		const paneB = await waitForSessionPane(harness, b);
		assert.ok(paneB.leafSessionBarHost);
		await paneB.leafSessionBarHost!.switchLeafSession(c);
		await waitForSessionPane(harness, c);
		const visible = visibleLeafKeys(sessionWindowService);
		assert.strictEqual(visible.length, 2);
		assert.ok(visible.includes(primaryId), 'the other leaf must stay');
		assert.ok(visible.includes(c), 'the operated leaf must become the third session');
		assert.ok(!visible.includes(b), 'the operated leaf must not remain');
		assert.strictEqual(partFor(parts, primaryId).sessionKey, primaryId);
		assert.strictEqual(partFor(parts, c).sessionKey, c);
		assert.strictEqual(sessionWindowService.isSessionWindowHidden(b), true);
	});

	test('does not leak unhandled rejection when switchToSession switchLeafSession rejects and onUnexpectedError warn-then-rethrows', async () => {
		const harness = await createRevealHarness();
		const pane = await waitForSessionPane(harness, harness.primaryId);
		assert.ok(pane.leafSessionBarHost);
		const paintBoom = new Error('switch boom');
		pane.leafSessionBarHost.switchLeafSession = async () => {
			throw paintBoom;
		};
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			pane.leafSessionBarHost!.switchToSession('other-session');
		});
	});

	test('does not leak unhandled rejection when SelectBox helper switchToSession switchLeafSession rejects and onUnexpectedError warn-then-rethrows', async () => {
		const harness = await createRevealHarness();
		const pane = await waitForSessionPane(harness, harness.primaryId);
		assert.ok(pane.leafSessionBarHost);
		const paintBoom = new Error('switch boom');
		pane.leafSessionBarHost.switchLeafSession = async () => {
			throw paintBoom;
		};
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			switchToSessionHelper(pane.leafSessionBarHost!, 'other-session');
		});
	});

	test('SelectBox helper switchToSession fire-and-forget voids double-catch onUnexpectedError', async () => {
		const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/conversation/browser/conversationLensSessionBar.ts`);
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.ok(source.includes(`void host.switchLeafSession(sessionId)${doubleCatch}`));
		assert.ok(!source.includes('void host.switchLeafSession(sessionId);'));
	});

	test('10 New Session in stub path becomes the only visible leaf', async () => {
		const harness = await createRevealHarness();
		const { sessionWindowService, rosterService, primaryId } = harness;
		const pane = await waitForSessionPane(harness, primaryId);
		assert.ok(pane.leafSessionBarHost);
		pane.leafSessionBarHost!.createNewSession();
		const deadline = Date.now() + 3000;
		let newId = rosterService.getActiveSessionId();
		while (newId === primaryId && Date.now() < deadline) {
			await timeout(20);
			newId = rosterService.getActiveSessionId();
		}
		assert.notStrictEqual(newId, primaryId);
		await waitForSessionPane(harness, newId);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 1);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), newId);
		assert.strictEqual(hideButton(sessionWindowService, newId)?.hidden, true);
		assert.strictEqual(sessionWindowService.isSessionWindowHidden(primaryId), true);
	});

	test('13 each visible leaf has exactly one SessionBar and window-nav; Part slot has none', async () => {
		const harness = await createRevealHarness();
		const { sessionWindowService, rosterService, conversationPart, primaryId } = harness;
		const b = rosterService.seedSessionQuietly();
		const c = rosterService.seedSessionQuietly();

		await sessionWindowService.revealSessionWindow(b);
		await waitForSessionPane(harness, b);
		await sessionWindowService.revealSessionWindow(c);
		await waitForSessionPane(harness, c);
		await sessionWindowService.revealSessionWindow(primaryId);
		await waitForSessionPane(harness, primaryId);
		let chrome = countLeafChrome(sessionWindowService, conversationPart);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 1);
		assert.strictEqual(chrome.bars, 1);
		assert.strictEqual(chrome.navs, 1);
		assert.strictEqual(chrome.partSlotBars, 0);

		await sessionWindowService.openSessionBeside(b);
		await waitForSessionPane(harness, b);
		chrome = countLeafChrome(sessionWindowService, conversationPart);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
		assert.strictEqual(chrome.bars, 2);
		assert.strictEqual(chrome.navs, 2);
		assert.strictEqual(chrome.partSlotBars, 0);
	});

	test('13b leaf SessionBar and container receive is-narrow when pane width is under 450px', async () => {
		const harness = await createRevealHarness();
		const { sessionWindowService, primaryId } = harness;
		const pane = await waitForSessionPane(harness, primaryId);
		const leaf = sessionWindowService.getLeafSlots(primaryId)!;

		pane.layout(new Dimension(500, 600));
		assert.ok(leaf.sessionBar.classList.contains('is-medium'));
		assert.ok(!leaf.sessionBar.classList.contains('is-narrow'));

		pane.layout(new Dimension(400, 600));
		assert.ok(leaf.sessionBar.classList.contains('is-narrow'));
		assert.ok(leaf.container.classList.contains('is-narrow'));
		assert.ok(!leaf.sessionBar.classList.contains('is-compact'));

		pane.layout(new Dimension(250, 600));
		assert.ok(leaf.sessionBar.classList.contains('is-narrow'));
		assert.ok(leaf.sessionBar.classList.contains('is-compact'));

		pane.layout(new Dimension(950, 600));
		assert.ok(!leaf.sessionBar.classList.contains('is-narrow'));
		assert.ok(!leaf.container.classList.contains('is-narrow'));
		assert.ok(!leaf.sessionBar.classList.contains('is-compact'));
	});

	test('14 reveal mounts overlay so openSubAgent does not throw', async () => {
		const harness = await createRevealHarness();
		const { sessionWindowService, sessionChatService, rosterService } = harness;
		const b = rosterService.seedSessionQuietly();
		await sessionWindowService.revealSessionWindow(b);
		await waitForSessionPane(harness, b);
		await sessionChatService.openSubAgent(b, 'tool-from-reveal', 'Reveal tool');
		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(b), true);
	});

	test('15 latest-wins reveal ends on B; bind-failed sentinel does not create a leaf', async () => {
		const { sessionWindowService, rosterService, primaryId } = await createRevealHarness();
		const a = rosterService.seedSessionQuietly();
		const b = rosterService.seedSessionQuietly();
		const first = sessionWindowService.revealSessionWindow(a);
		const second = sessionWindowService.revealSessionWindow(b);
		await Promise.all([first, second]);
		assert.deepStrictEqual(visibleLeafKeys(sessionWindowService), [b]);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), b);

		const keysBefore = [...sessionWindowService.getAllLeafSessionKeys()];
		rosterService.fireActiveSession(ENGINE_BIND_FAILED_SESSION_ID);
		await timeout(20);
		assert.deepStrictEqual([...sessionWindowService.getAllLeafSessionKeys()], keysBefore);
		assert.strictEqual(sessionWindowService.getLeafSlots(ENGINE_BIND_FAILED_SESSION_ID), undefined);
		assert.ok(sessionWindowService.getLeafSlots(primaryId) || sessionWindowService.getLeafSlots(b));
	});

	test('onDidDeleteSession disposes visible leaf when bind-failed skips reveal', async () => {
		const harness = createLightweightWindowHarness();
		await timeout(0);
		const sessionId = harness.rosterService.getActiveSessionId();
		await harness.sessionWindowService.ensurePrimaryWindow(sessionId);
		assert.deepStrictEqual(visibleLeafKeys(harness.sessionWindowService), [sessionId]);
		assert.ok(harness.conversationParts.some(part => part.sessionKey === sessionId));

		harness.rosterService.fireActiveSession(ENGINE_BIND_FAILED_SESSION_ID);
		harness.rosterService.fireDeletedSession(sessionId);

		assert.deepStrictEqual(visibleLeafKeys(harness.sessionWindowService), []);
		assert.strictEqual(harness.sessionWindowService.getPrimarySessionKey(), undefined);
		assert.ok(!harness.sessionWindowService.getAllLeafSessionKeys().includes(sessionId));
		assert.ok(!harness.conversationParts.some(part => part.sessionKey === sessionId));
	});

	test('onDidDeleteSession disposes a hidden leaf and its editor part', async () => {
		const harness = await createRevealHarness();
		const { parts, sessionWindowService, rosterService, primaryId } = harness;
		const secondaryId = rosterService.seedSessionQuietly();
		await sessionWindowService.openSessionBeside(secondaryId);
		await waitForSessionPane(harness, secondaryId);

		assert.strictEqual(sessionWindowService.isSessionWindowHidden(primaryId), true);
		assert.ok(sessionWindowService.getLeafSlots(primaryId));
		assert.ok(parts.conversationParts.some(part => part.sessionKey === primaryId));

		rosterService.fireDeletedSession(primaryId);

		assert.strictEqual(sessionWindowService.getLeafSlots(primaryId), undefined);
		assert.ok(!parts.conversationParts.some(part => part.sessionKey === primaryId));
		assert.deepStrictEqual(visibleLeafKeys(sessionWindowService), [secondaryId]);
	});

	test('15 stub-seed untitled onDidChangeActiveSession still reveals', async () => {
		const harness = await createRevealHarness();
		const { sessionWindowService, rosterService } = harness;
		assert.ok(isEngineRosterPlaceholderSessionId('untitled'));
		assert.ok(rosterService.getSessions().some(session => session.id === 'untitled'));
		const b = rosterService.seedSessionQuietly();
		await sessionWindowService.revealSessionWindow(b);
		await waitForSessionPane(harness, b);
		assert.strictEqual(sessionWindowService.isSessionWindowHidden('untitled'), true);

		rosterService.fireActiveSession('untitled');
		await waitForSessionPane(harness, 'untitled');
		assert.strictEqual(sessionWindowService.isSessionWindowVisible('untitled'), true);
		assert.deepStrictEqual(visibleLeafKeys(sessionWindowService), ['untitled']);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), 'untitled');
	});

	test('15 reveal create failure rolls back part + leaf and rebuilds the same key', async () => {
		const rosterService = store.add(new QuietRosterService());
		const gridHost = document.createElement('div');
		document.body.appendChild(gridHost);
		store.add({ dispose: () => gridHost.remove() });

		const conversationParts: IConversationEditorPart[] = [];
		let throwOnCreate = false;
		const editorGroupsService = {
			createConversationEditorPart: (_parent: unknown, sessionKey: string) => {
				if (throwOnCreate) {
					throw new Error('reveal boom');
				}
				const part = { sessionKey, whenReady: Promise.resolve(), activeGroup: { focus: () => { }, activeEditorPane: { getId: () => ConversationEditorPaneId } } } as unknown as IConversationEditorPart;
				conversationParts.push(part);
				return part;
			},
			disposeConversationEditorPart: (sessionKey: string) => {
				const index = conversationParts.findIndex(part => part.sessionKey === sessionKey);
				if (index >= 0) {
					conversationParts.splice(index, 1);
				}
			},
			setFocusedConversationLeaf: () => { },
			getFocusedConversationLeaf: () => undefined,
			get conversationParts() {
				return conversationParts;
			},
		} as unknown as IEditorGroupsService;

		const errors: string[] = [];
		const sessionWindowService = store.add(new ConversationSessionWindowService(
			{
				onDidCreateSlots: Event.None,
				onDidFocus: Event.None,
				getSlots: () => ({ sessionBar: document.createElement('div'), sessionWindowGrid: gridHost, editorPartHost: undefined }),
				setFocusedLeafContainer: () => { },
				focus: () => { },
			} as unknown as IConversationPartService,
			editorGroupsService,
			rosterService,
			new NullLogService(),
			{
				error: (message: string | Error) => {
					errors.push(typeof message === 'string' ? message : getErrorMessage(message));
				},
			} as INotificationService,
		));

		await timeout(0);
		const primaryId = rosterService.getActiveSessionId();
		await sessionWindowService.ensurePrimaryWindow(primaryId);
		const target = rosterService.seedSessionQuietly();
		throwOnCreate = true;
		await sessionWindowService.revealSessionWindow(target);

		assert.ok(errors.some(error => error.includes('reveal boom')));
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), primaryId);
		assert.strictEqual(sessionWindowService.getLeafSlots(target), undefined);
		assert.ok(!sessionWindowService.getAllLeafSessionKeys().includes(target));
		assert.ok(!conversationParts.some(part => part.sessionKey === target));

		throwOnCreate = false;
		await sessionWindowService.revealSessionWindow(target);
		assert.ok(sessionWindowService.getLeafSlots(target));
		assert.ok(conversationParts.some(part => part.sessionKey === target));
		assert.ok(sessionWindowService.getLeafSlots(target)?.container.isConnected);
	});

	async function openTwoLightweightLeaves() {
		const errors: string[] = [];
		const harness = createLightweightWindowHarness();
		harness.setNotifyError(message => {
			errors.push(typeof message === 'string' ? message : getErrorMessage(message));
		});
		await timeout(0);
		const primaryId = harness.rosterService.getActiveSessionId();
		await harness.sessionWindowService.ensurePrimaryWindow(primaryId);
		const secondaryId = harness.rosterService.seedSessionQuietly();
		await harness.sessionWindowService.openSessionBeside(secondaryId);
		assert.strictEqual(harness.sessionWindowService.getVisibleWindowCount(), 2);
		assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible(primaryId), true);
		assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible(secondaryId), true);
		const incomingId = harness.rosterService.seedSessionQuietly();
		return { harness, errors, primaryId, secondaryId, incomingId };
	}

	test('secondary replace create failure restores the outgoing leaf and notifies', async () => {
		const { harness, errors, primaryId, secondaryId, incomingId } = await openTwoLightweightLeaves();
		const { sessionWindowService, conversationParts } = harness;
		harness.setThrowOnCreate(true);
		await sessionWindowService.revealSessionWindow(incomingId, { replace: secondaryId });

		assert.strictEqual(sessionWindowService.isSessionWindowVisible(secondaryId), true);
		assert.strictEqual(sessionWindowService.isSessionWindowVisible(primaryId), true);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
		assert.strictEqual(sessionWindowService.getLeafSlots(incomingId), undefined);
		assert.ok(!sessionWindowService.getAllLeafSessionKeys().includes(incomingId));
		assert.ok(!conversationParts.some(part => part.sessionKey === incomingId));
		assert.ok(errors.some(error => error.includes('reveal boom')));
	});

	test('secondary replace whenReady failure restores the outgoing leaf and notifies', async () => {
		const { harness, errors, primaryId, secondaryId, incomingId } = await openTwoLightweightLeaves();
		const { sessionWindowService, conversationParts } = harness;
		harness.setRejectWhenReady(true);
		await sessionWindowService.revealSessionWindow(incomingId, { replace: secondaryId });

		assert.strictEqual(sessionWindowService.isSessionWindowVisible(secondaryId), true);
		assert.strictEqual(sessionWindowService.isSessionWindowVisible(primaryId), true);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
		assert.strictEqual(sessionWindowService.getLeafSlots(incomingId), undefined);
		assert.ok(!sessionWindowService.getAllLeafSessionKeys().includes(incomingId));
		assert.ok(!conversationParts.some(part => part.sessionKey === incomingId));
		assert.ok(errors.some(error => error.includes('whenReady boom')));
	});

	test('primary replace create failure does not hide the old primary', async () => {
		const { harness, errors, primaryId, secondaryId, incomingId } = await openTwoLightweightLeaves();
		const { sessionWindowService } = harness;
		harness.setThrowOnCreate(true);
		await sessionWindowService.revealSessionWindow(incomingId, { replace: primaryId });

		assert.strictEqual(sessionWindowService.isSessionWindowVisible(primaryId), true);
		assert.strictEqual(sessionWindowService.isSessionWindowHidden(primaryId), false);
		assert.strictEqual(sessionWindowService.isSessionWindowVisible(secondaryId), true);
		assert.strictEqual(sessionWindowService.getPrimarySessionKey(), primaryId);
		assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
		assert.strictEqual(sessionWindowService.getLeafSlots(incomingId), undefined);
		assert.ok(!sessionWindowService.getAllLeafSessionKeys().includes(incomingId));
		assert.ok(errors.some(error => error.includes('reveal boom')));
	});

	test('17 hiding a leaf releases its lens lease and restore reacquires it', async () => {
		const harness = await createRevealHarness();
		const { parts, sessionWindowService, rosterService, primaryId, sessionChatService } = harness;
		await sessionChatService.openExtensionTab(primaryId, 'fork-lease', { title: 'Fork lease' });
		const paneA = await waitForSessionPane(harness, primaryId);
		const partA = partFor(parts, primaryId);
		const tabCount = partA.activeGroup.count;
		assert.ok(tabCount >= 2);
		assert.ok(paneA.activeConversationLens);

		const b = rosterService.seedSessionQuietly();
		await sessionWindowService.revealSessionWindow(b);
		await waitForSessionPane(harness, b);
		assert.strictEqual(sessionWindowService.isSessionWindowHidden(primaryId), true);
		assert.strictEqual(partA.activeGroup.count, tabCount);
		const hiddenLenses = await collectLeafConversationLenses(partA);
		assert.strictEqual(hiddenLenses.length, tabCount);
		for (const lens of hiddenLenses) {
			assert.strictEqual(lens.sessionViewLease, undefined);
		}
		assert.strictEqual(partA.sessionKey, primaryId);
		const hiddenLeaf = sessionWindowService.getLeafSlots(primaryId)?.container;
		assert.ok(hiddenLeaf?.classList.contains(conversationSessionLeafHiddenClass));
		const staleBanner = hiddenLeaf?.querySelector('.conversation-lens-stale-snapshot') as HTMLElement | null;
		assert.ok(!staleBanner || staleBanner.hidden || !staleBanner.textContent);

		await sessionWindowService.revealSessionWindow(primaryId);
		const paneA2 = await waitForSessionPane(harness, primaryId);
		const restoredLenses = await collectLeafConversationLenses(partFor(parts, primaryId));
		assert.strictEqual(restoredLenses.length, tabCount);
		for (const lens of restoredLenses) {
			assert.ok(lens.sessionViewLease, 'restore must reacquire sessionViewLease on every leaf lens');
		}
		assert.ok(paneA2.activeConversationLens?.sessionViewLease, 'restore must reacquire sessionViewLease');
	});

	test('does not leak unhandled rejection when onDidChangeActiveSession reveal catch-path notice throws and onUnexpectedError warn-then-rethrows', async () => {
		// revealSessionWindow already catches create throw; a lone inner reject does not leak.
		// The void onDidChangeActiveSession call site still needs `.catch` when the catch-path notice throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		const harness = createLightweightWindowHarness();
		await timeout(0);
		const primaryId = harness.rosterService.getActiveSessionId();
		await harness.sessionWindowService.ensurePrimaryWindow(primaryId);
		const target = harness.rosterService.seedSessionQuietly();
		harness.setThrowOnCreate(true);
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			harness.setNotifyError(() => {
				throw paintBoom;
			});
			harness.rosterService.fireActiveSession(target);
		});
	});

	test('does not leak unhandled rejection when attachGrid pending reveal catch-path notice throws and onUnexpectedError warn-then-rethrows', async () => {
		// revealSessionWindow already catches create throw; a lone inner reject does not leak.
		// The void attachGrid pending call site still needs `.catch` when the catch-path notice throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		const harness = createLightweightWindowHarness({ delaySlots: true });
		const target = harness.rosterService.seedSessionQuietly();
		harness.setThrowOnCreate(true);
		await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
			harness.setNotifyError(() => {
				throw paintBoom;
			});
			void harness.sessionWindowService.revealSessionWindow(target, { replace: harness.rosterService.getActiveSessionId() });
			harness.attachSlots();
		});
	});

	test('session window fire-and-forget voids double-catch onUnexpectedError', async () => {
		const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/conversation/browser/conversationSessionWindowService.ts`);
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.ok(source.includes(`void this.revealSessionWindow(sessionKey)${doubleCatch}`));
		assert.ok(source.includes(`void this.revealSessionWindow(pending.sessionKey, pending.options)${doubleCatch}`));
		assert.ok(source.includes(`void this.ensurePrimaryWindow(this.rosterService.getActiveSessionId())${doubleCatch}`));
		assert.ok(!source.includes('void this.revealSessionWindow(sessionKey);'));
		assert.ok(!source.includes('void this.revealSessionWindow(pending.sessionKey, pending.options);'));
		assert.ok(!source.includes('void this.ensurePrimaryWindow(this.rosterService.getActiveSessionId());'));
	});
});
