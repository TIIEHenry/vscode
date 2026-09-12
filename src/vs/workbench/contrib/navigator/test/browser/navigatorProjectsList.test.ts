/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { WorkbenchObjectTree } from '../../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IRecentlyOpened, IWorkspacesService } from '../../../../../platform/workspaces/common/workspaces.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../../platform/workspace/common/workspace.js';
import { testWorkspace, Workspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { IViewContainerModel, IViewDescriptorService, ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import { IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { IWorkbenchLayoutService } from '../../../../services/layout/browser/layoutService.js';
import { TestContextService } from '../../../../test/common/workbenchTestServices.js';
import { TestHostService, TestWorkspacesService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { isConversationPairingHold } from '../../../conversation/browser/conversationSessionStatus.js';
import { ConversationStubService, IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { NAVIGATOR_STALE_SNAPSHOT_COPY } from '../../common/navigatorAgentTreeEmptyState.js';
import { NAVIGATOR_PROJECTS_VIEW_ID } from '../../browser/navigatorStubView.js';
import { INavigatorLocalFolderEntry, NavigatorProjectsView, navigatorProjectsRecentsFailureMessage } from '../../browser/navigatorProjectsList.js';
import { INavigatorProjectsTreeNode } from '../../browser/navigatorProjectsTree.js';
import { CONVERSATION_STUB_SEED_SESSIONS } from '../../../conversation/browser/conversationStubModel.js';
import { createNavigatorConnectionTestStub } from '../common/navigatorConnectionTestStub.js';

suite('NavigatorProjectsView', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	class WorkspacesWithRecents extends TestWorkspacesService {
		constructor(private readonly recents: IRecentlyOpened) {
			super();
		}

		override async getRecentlyOpened(): Promise<IRecentlyOpened> {
			return this.recents;
		}
	}

	function getViewTree(view: NavigatorProjectsView): WorkbenchObjectTree<unknown, void> {
		return (view as unknown as { tree: WorkbenchObjectTree<unknown, void> }).tree;
	}

	function getViewEntries(view: NavigatorProjectsView): INavigatorLocalFolderEntry[] {
		return (view as unknown as { getLocalFolderEntries: () => INavigatorLocalFolderEntry[] }).getLocalFolderEntries();
	}

	function countTreeLeaves(view: NavigatorProjectsView): number {
		const tree = getViewTree(view);
		const root = tree.getNode(null);
		let count = 0;
		const visit = (node: typeof root): void => {
			for (const child of node?.children ?? []) {
				if (!child.children.length) {
					count++;
				}
				visit(child);
			}
		};
		visit(root);
		return count;
	}

	function getFilterInput(view: NavigatorProjectsView): HTMLInputElement | null {
		return view.element.querySelector('.navigator-projects-inline-filter-input');
	}

	function isFilterVisible(view: NavigatorProjectsView): boolean {
		const filter = view.element.querySelector('.navigator-projects-inline-filter') as HTMLElement | null;
		return filter !== null && filter.style.display !== 'none';
	}

	async function setFilterQuery(view: NavigatorProjectsView, query: string): Promise<void> {
		const input = getFilterInput(view);
		assert.ok(input, 'filter input must exist');
		input.value = query;
		input.dispatchEvent(new globalThis.Event('input'));
		await new Promise<void>(resolve => setTimeout(resolve, 0));
	}

	function getViewTreeNodes(view: NavigatorProjectsView): INavigatorProjectsTreeNode[] {
		return (view as unknown as { treeNodes: INavigatorProjectsTreeNode[] }).treeNodes;
	}

	function findTreeNode(
		nodes: readonly INavigatorProjectsTreeNode[],
		predicate: (node: INavigatorProjectsTreeNode) => boolean,
	): INavigatorProjectsTreeNode | undefined {
		for (const node of nodes) {
			if (predicate(node)) {
				return node;
			}
			const nested = node.children ? findTreeNode(node.children, predicate) : undefined;
			if (nested) {
				return nested;
			}
		}
		return undefined;
	}

	function collectSessionIds(nodes: readonly INavigatorProjectsTreeNode[]): string[] {
		const ids: string[] = [];
		for (const node of nodes) {
			if (node.kind === 'session' && node.sessionId) {
				ids.push(node.sessionId);
			}
			if (node.children) {
				ids.push(...collectSessionIds(node.children));
			}
		}
		return ids;
	}

	function openTreeNode(view: NavigatorProjectsView, node: INavigatorProjectsTreeNode, browserEvent?: UIEvent): void {
		(view as unknown as {
			openTreeNode(node: INavigatorProjectsTreeNode | undefined, browserEvent?: UIEvent): void;
		}).openTreeNode(node, browserEvent);
	}

	async function flushMicrotasks(): Promise<void> {
		await new Promise<void>(resolve => setTimeout(resolve, 0));
	}

	async function mountView(options?: {
		contextService?: TestContextService;
		workspacesService?: IWorkspacesService;
		rosterService?: ConversationStubService;
		uaConnection?: IUniverseAgentConnection;
		patchHost?: (host: TestHostService) => void;
	}): Promise<NavigatorProjectsView> {
		const contextService = options?.contextService ?? new TestContextService(new Workspace('empty-workspace', []));
		const workspacesService = options?.workspacesService ?? new TestWorkspacesService();
		const rosterService = store.add(options?.rosterService ?? new ConversationStubService());
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IWorkspaceContextService, contextService);
		instantiationService.stub(IWorkspacesService, workspacesService);
		instantiationService.stub(IConversationRosterService, rosterService);
		instantiationService.stub(IUniverseAgentConnection, options?.uaConnection ?? createNavigatorConnectionTestStub());
		if (options?.patchHost) {
			options.patchHost(instantiationService.get(IHostService) as TestHostService);
		}
		instantiationService.stub(IWorkbenchLayoutService, {
			isVisible: () => true,
			setPartHidden: async () => { },
		});
		instantiationService.stub(IConversationPartService, { focus: () => { } });
		const stubViewContainer = {
			id: 'navigator-projects-test-container',
			title: { value: 'Projects', original: 'Projects' },
		} as ViewContainer;
		instantiationService.stub(IViewDescriptorService, {
			onDidChangeLocation: Event.None,
			getViewLocationById(_id: string): ViewContainerLocation {
				return ViewContainerLocation.Sidebar;
			},
			getViewDescriptorById(_id: string): null {
				return null;
			},
			getViewContainerByViewId(_id: string): ViewContainer | null {
				return stubViewContainer;
			},
			getViewContainerModel(_viewContainer: ViewContainer): IViewContainerModel {
				return {
					title: stubViewContainer.title.value,
					onDidChangeContainerInfo: Event.None,
				} as IViewContainerModel;
			},
			getDefaultContainerById(_id: string): ViewContainer | null {
				return stubViewContainer;
			},
		});

		const view = store.add(instantiationService.createInstance(NavigatorProjectsView, {
			id: NAVIGATOR_PROJECTS_VIEW_ID,
			title: 'Projects',
		}));
		const container = document.createElement('div');
		view.render();
		container.appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);

		await new Promise<void>(resolve => setTimeout(resolve, 0));

		return view;
	}

	test('empty workspace with no recents shows welcome', async () => {
		const view = await mountView();
		assert.strictEqual(view.shouldShowWelcome(), true);
		assert.strictEqual(getViewEntries(view).length, 0);
	});

	test('open folder workspace lists the folder and hides welcome', async () => {
		const folderUri = URI.file('/projects/demo');
		const contextService = new TestContextService(testWorkspace(folderUri));
		const view = await mountView({ contextService });

		assert.strictEqual(view.shouldShowWelcome(), false);
		const entries = getViewEntries(view);
		assert.strictEqual(entries.length, 1);
		assert.strictEqual(entries[0].resource.toString(), folderUri.toString());
		assert.ok(entries[0].id.startsWith('current:'));

		const list = countTreeLeaves(view);
		assert.strictEqual(list, 1);
		assert.strictEqual(contextService.getWorkbenchState(), WorkbenchState.FOLDER);
	});

	test('recent folders are listed without conversation session ids', async () => {
		const recentFolder = URI.file('/projects/recent-one');
		const workspacesService = new WorkspacesWithRecents({
			workspaces: [{ folderUri: recentFolder, label: 'recent-one' }],
			files: [],
		});
		const view = await mountView({ workspacesService });

		assert.strictEqual(view.shouldShowWelcome(), false);
		const entries = getViewEntries(view);
		assert.strictEqual(entries.length, 1);
		assert.strictEqual(entries[0].resource.toString(), recentFolder.toString());
		assert.ok(entries[0].id.startsWith('recent:'));

		const sessionIds = new Set(CONVERSATION_STUB_SEED_SESSIONS.map(session => session.id));
		for (const entry of entries) {
			assert.ok(!sessionIds.has(entry.id), `project entry must not use conversation session id ${entry.id}`);
			assert.ok(!entry.id.startsWith('session-'), `project entry must not look like a session id: ${entry.id}`);
		}
	});

	test('empty query shows current folder and recent entries', async () => {
		const currentFolder = URI.file('/projects/current');
		const recentFolder = URI.file('/projects/recent-two');
		const contextService = new TestContextService(testWorkspace(currentFolder));
		const workspacesService = new WorkspacesWithRecents({
			workspaces: [{ folderUri: recentFolder, label: 'recent-two' }],
			files: [],
		});
		const view = await mountView({ contextService, workspacesService });

		assert.strictEqual(getViewEntries(view).length, 2);
		assert.strictEqual(countTreeLeaves(view), 2);
	});

	test('query matches name case-insensitively', async () => {
		const folderUri = URI.file('/projects/DemoProject');
		const contextService = new TestContextService(testWorkspace(folderUri));
		const view = await mountView({ contextService });

		await setFilterQuery(view, 'demo');
		assert.strictEqual(countTreeLeaves(view), 1);

		await setFilterQuery(view, 'DEMO');
		assert.strictEqual(countTreeLeaves(view), 1);
	});

	test('query matches description parent path', async () => {
		const recentFolder = URI.file('/home/user/my-projects/alpha');
		const workspacesService = new WorkspacesWithRecents({
			workspaces: [{ folderUri: recentFolder, label: '/home/user/my-projects/alpha' }],
			files: [],
		});
		const view = await mountView({ workspacesService });

		await setFilterQuery(view, 'my-projects');
		assert.strictEqual(countTreeLeaves(view), 1);
		assert.strictEqual(getViewEntries(view)[0]?.name, 'alpha');
	});

	test('non-match yields empty list and keeps welcome hidden when recents exist', async () => {
		const recentFolder = URI.file('/projects/recent-one');
		const workspacesService = new WorkspacesWithRecents({
			workspaces: [{ folderUri: recentFolder, label: 'recent-one' }],
			files: [],
		});
		const view = await mountView({ workspacesService });

		await setFilterQuery(view, 'zzz-no-match');
		assert.strictEqual(countTreeLeaves(view), 0);
		assert.strictEqual(view.shouldShowWelcome(), false);
		assert.strictEqual(getViewEntries(view).length, 1);
	});

	test('clear or empty query restores full list', async () => {
		const recentFolder = URI.file('/projects/recent-one');
		const workspacesService = new WorkspacesWithRecents({
			workspaces: [{ folderUri: recentFolder, label: 'recent-one' }],
			files: [],
		});
		const view = await mountView({ workspacesService });

		await setFilterQuery(view, 'zzz-no-match');
		assert.strictEqual(countTreeLeaves(view), 0);

		await setFilterQuery(view, '');
		assert.strictEqual(countTreeLeaves(view), 1);
	});

	test('filter input is shown when entries exist', async () => {
		const folderUri = URI.file('/projects/demo');
		const contextService = new TestContextService(testWorkspace(folderUri));
		const view = await mountView({ contextService });

		assert.ok(isFilterVisible(view));
		const input = getFilterInput(view);
		assert.ok(input);
		assert.strictEqual(input.placeholder, 'Filter projects');
	});

	test('welcome path does not require filter input', async () => {
		const view = await mountView();

		assert.strictEqual(view.shouldShowWelcome(), true);
		assert.ok(!isFilterVisible(view));
	});

	test('getRecentlyOpened throw on first paint of empty workspace hides welcome and shows failure copy without unhandled rejection', async () => {
		class WorkspacesThrowOnFirst extends TestWorkspacesService {
			override async getRecentlyOpened(): Promise<IRecentlyOpened> {
				throw new Error('getRecentlyOpened boom');
			}
		}

		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const view = await mountView({
				workspacesService: new WorkspacesThrowOnFirst(),
			});
			await flushMicrotasks();
			await new Promise<void>(resolve => setImmediate(() => resolve()));

			assert.deepStrictEqual(unhandledRejections, []);
			assert.strictEqual(getViewEntries(view).length, 0);
			assert.strictEqual(view.shouldShowWelcome(), false);

			const expectedCopy = navigatorProjectsRecentsFailureMessage(new Error('getRecentlyOpened boom'));
			const failureNote = findTreeNode(getViewTreeNodes(view), node => node.id === 'local:recents-failed' && node.kind === 'note');
			assert.ok(failureNote, 'recents failure note must be in the tree');
			assert.strictEqual(failureNote.label, expectedCopy);

			const status = view.element.querySelector('.navigator-projects-recents-status') as HTMLElement | null;
			assert.ok(status, 'recents failure status must exist');
			assert.notStrictEqual(status.style.display, 'none');
			assert.strictEqual(status.textContent, expectedCopy);
			assert.ok(status.textContent.includes('Unable to load recent folders'));
			assert.ok(status.textContent.includes('getRecentlyOpened boom'));

			const paneBody = view.element.querySelector('.pane-body') as HTMLElement | null;
			assert.ok(paneBody, 'pane body must exist');
			assert.strictEqual(paneBody.classList.contains('welcome'), false, 'welcome class would hide recents status via CSS');
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('getRecentlyOpened throw on first paint keeps current folder and shows failure copy without unhandled rejection', async () => {
		const currentFolder = URI.file('/projects/current-first-paint');
		const contextService = new TestContextService(testWorkspace(currentFolder));
		class WorkspacesThrowOnFirst extends TestWorkspacesService {
			override async getRecentlyOpened(): Promise<IRecentlyOpened> {
				throw new Error('getRecentlyOpened boom');
			}
		}

		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const view = await mountView({
				contextService,
				workspacesService: new WorkspacesThrowOnFirst(),
			});
			await flushMicrotasks();
			await new Promise<void>(resolve => setImmediate(() => resolve()));

			assert.deepStrictEqual(unhandledRejections, []);
			const entries = getViewEntries(view);
			assert.strictEqual(entries.length, 1);
			assert.ok(entries[0].id.startsWith('current:'));
			assert.strictEqual(entries[0].resource.toString(), currentFolder.toString());
			assert.strictEqual(view.shouldShowWelcome(), false);

			const expectedCopy = navigatorProjectsRecentsFailureMessage(new Error('getRecentlyOpened boom'));
			const failureNote = findTreeNode(getViewTreeNodes(view), node => node.id === 'local:recents-failed' && node.kind === 'note');
			assert.ok(failureNote, 'recents failure note must be in the tree');
			assert.strictEqual(failureNote.label, expectedCopy);

			const status = view.element.querySelector('.navigator-projects-recents-status') as HTMLElement | null;
			assert.ok(status, 'recents failure status must exist');
			assert.notStrictEqual(status.style.display, 'none');
			assert.strictEqual(status.textContent, expectedCopy);
			assert.ok(status.textContent.includes('Unable to load recent folders'));
			assert.ok(status.textContent.includes('getRecentlyOpened boom'));
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('getRecentlyOpened throw after first paint keeps last-good tree without unhandled rejection', async () => {
		const recentFolder = URI.file('/projects/recent-keep');
		const onDidChangeRecentlyOpened = store.add(new Emitter<void>());
		class WorkspacesThrowAfterSuccess extends TestWorkspacesService {
			throwOnNext = false;
			override readonly onDidChangeRecentlyOpened = onDidChangeRecentlyOpened.event;
			override async getRecentlyOpened(): Promise<IRecentlyOpened> {
				if (this.throwOnNext) {
					throw new Error('getRecentlyOpened boom');
				}
				return {
					workspaces: [{ folderUri: recentFolder, label: 'recent-keep' }],
					files: [],
				};
			}
		}
		const workspacesService = new WorkspacesThrowAfterSuccess();
		const view = await mountView({ workspacesService });

		const lastGoodEntries = getViewEntries(view).map(entry => entry.id);
		const lastGoodLeaves = countTreeLeaves(view);
		assert.strictEqual(lastGoodEntries.length, 1);
		assert.strictEqual(lastGoodLeaves, 1);

		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			workspacesService.throwOnNext = true;
			onDidChangeRecentlyOpened.fire();
			await flushMicrotasks();
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(unhandledRejections, []);
			assert.deepStrictEqual(getViewEntries(view).map(entry => entry.id), lastGoodEntries);
			assert.strictEqual(countTreeLeaves(view), lastGoodLeaves);
			assert.strictEqual(getViewEntries(view)[0]?.resource.toString(), recentFolder.toString());
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('rebuildTree throw after live paint keeps leftover rows and marks stale', async () => {
		const folderUri = URI.file('/projects/live-keep');
		const contextService = new TestContextService(testWorkspace(folderUri));
		const rosterService = new ConversationStubService();
		rosterService.setEngineConnected(true);
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const baseConnection = createNavigatorConnectionTestStub({
			getNavigatorCapability: () => 'SUPPORTED',
		});
		let throwOnSnapshot = false;
		const uaConnection = createNavigatorConnectionTestStub({
			getNavigatorCapability: () => 'SUPPORTED',
			onDidChangeConnection: onDidChangeConnection.event,
			getConnectionSnapshot: () => {
				if (throwOnSnapshot) {
					throw new Error('snapshot boom');
				}
				return baseConnection.getConnectionSnapshot();
			},
		});
		const view = await mountView({
			contextService,
			rosterService,
			uaConnection,
		});

		const leftoverSessionIds = collectSessionIds(getViewTreeNodes(view));
		const leftoverFolderIds = getViewEntries(view).map(entry => entry.id);
		assert.ok(leftoverSessionIds.length > 0, 'live paint must have leftover session rows');
		assert.ok(leftoverFolderIds.length > 0, 'live paint must have leftover folder rows');
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:stale-snapshot'),
			undefined,
			'live paint must not already look stale',
		);

		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			throwOnSnapshot = true;
			onDidChangeConnection.fire(baseConnection.getConnectionSnapshot());
			await flushMicrotasks();
			await new Promise<void>(resolve => setImmediate(() => resolve()));

			assert.deepStrictEqual(unhandledRejections, []);
			assert.deepStrictEqual(getViewEntries(view).map(entry => entry.id), leftoverFolderIds);
			assert.deepStrictEqual(collectSessionIds(getViewTreeNodes(view)), leftoverSessionIds);

			const staleNote = findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:stale-snapshot' && node.kind === 'note');
			assert.ok(staleNote, 'rebuild throw must mark leftover stale');
			assert.strictEqual(staleNote.label, NAVIGATOR_STALE_SNAPSHOT_COPY);

			const status = view.element.querySelector('.navigator-projects-recents-status') as HTMLElement | null;
			assert.ok(status, 'existing recents status must surface the rebuild failure');
			assert.notStrictEqual(status.style.display, 'none');
			assert.strictEqual(status.textContent, NAVIGATOR_STALE_SNAPSHOT_COPY);
			assert.strictEqual(view.shouldShowWelcome(), false);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('openWindow reject on local-folder click is swallowed; session row only switchSession', async () => {
		class SwitchTrackingRoster extends ConversationStubService {
			readonly switchSessionCalls: string[] = [];
			override switchSession(sessionId: string): void {
				this.switchSessionCalls.push(sessionId);
				super.switchSession(sessionId);
			}
		}

		const folderUri = URI.file('/projects/open-folder');
		const contextService = new TestContextService(testWorkspace(folderUri));
		const rosterService = new SwitchTrackingRoster();
		rosterService.setEngineConnected(true);
		const uaConnection = createNavigatorConnectionTestStub({
			getNavigatorCapability: () => 'SUPPORTED',
		});
		const openWindowCalls: unknown[] = [];

		const view = await mountView({
			contextService,
			rosterService,
			uaConnection,
			patchHost: host => {
				host.openWindow = async (...args: unknown[]) => {
					openWindowCalls.push(args);
					return Promise.reject(new Error('openWindow boom'));
				};
			},
		});
		const folderNode = findTreeNode(getViewTreeNodes(view), node => node.kind === 'local-folder');
		const sessionNode = findTreeNode(getViewTreeNodes(view), node => node.kind === 'session' && !!node.sessionId);
		assert.ok(folderNode, 'local-folder node must exist');
		assert.ok(sessionNode?.sessionId, 'session node must exist');

		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			openTreeNode(view, folderNode, new MouseEvent('click'));
			await flushMicrotasks();
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(unhandledRejections, []);
			assert.strictEqual(openWindowCalls.length, 1);
			assert.deepStrictEqual(rosterService.switchSessionCalls, []);

			openTreeNode(view, sessionNode);
			await flushMicrotasks();
			assert.deepStrictEqual(rosterService.switchSessionCalls, [sessionNode.sessionId]);
			assert.strictEqual(openWindowCalls.length, 1);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('live paint leftover stays while pairingPending then true disconnect stays stale', async () => {
		const folderUri = URI.file('/projects/pairing-keep');
		const contextService = new TestContextService(testWorkspace(folderUri));
		class ProductionLikeRoster extends ConversationStubService {
			private connected = false;
			pairingPending = false;
			override isEngineConnected(): boolean {
				return this.connected && !this.pairingPending;
			}
			override setEngineConnected(connected: boolean): void {
				this.connected = connected;
				super.setEngineConnected(this.connected && !this.pairingPending);
			}
			setPairingPending(pending: boolean): void {
				this.pairingPending = pending;
				super.setEngineConnected(this.connected && !this.pairingPending);
			}
		}
		const rosterService = new ProductionLikeRoster();
		rosterService.setEngineConnected(true);
		let pairingPending = false;
		let phaseKind: 'connected' | 'disconnected' = 'connected';
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const baseConnection = createNavigatorConnectionTestStub({
			getNavigatorCapability: () => 'SUPPORTED',
		});
		const uaConnection = createNavigatorConnectionTestStub({
			getNavigatorCapability: () => 'SUPPORTED',
			getConnectionPhase: () => phaseKind === 'connected' ? { kind: 'connected', path: 'direct' } : { kind: 'disconnected' },
			getConnectionSnapshot: () => ({
				...baseConnection.getConnectionSnapshot(),
				workDir: '/engine/work',
				pairingPending,
			}),
			onDidChangeConnection: onDidChangeConnection.event,
		});
		const view = await mountView({
			contextService,
			rosterService,
			uaConnection,
		});

		const leftoverSessionIds = collectSessionIds(getViewTreeNodes(view));
		const leftoverFolderIds = getViewEntries(view).map(entry => entry.id);
		assert.ok(leftoverSessionIds.length > 0, 'live paint must have leftover session rows');
		assert.ok(leftoverFolderIds.length > 0, 'live paint must have leftover folder rows');
		assert.ok(
			findTreeNode(getViewTreeNodes(view), node => node.kind === 'workdir'),
			'live paint must have leftover workDir',
		);
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:stale-snapshot'),
			undefined,
			'live paint must not already look stale',
		);
		assert.strictEqual(view.shouldShowWelcome(), false);
		assert.strictEqual(isConversationPairingHold(uaConnection), false);

		pairingPending = true;
		rosterService.setPairingPending(true);
		onDidChangeConnection.fire(uaConnection.getConnectionSnapshot());
		await flushMicrotasks();
		await new Promise<void>(resolve => setImmediate(() => resolve()));

		assert.strictEqual(uaConnection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(uaConnection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(uaConnection), true);
		assert.strictEqual(rosterService.isEngineConnected(), false, 'production stub is connected && !pairingPending');
		assert.deepStrictEqual(collectSessionIds(getViewTreeNodes(view)), leftoverSessionIds, 'pairing-hold must keep leftover session rows');
		assert.deepStrictEqual(getViewEntries(view).map(entry => entry.id), leftoverFolderIds, 'pairing-hold must keep leftover folder rows');
		assert.ok(
			findTreeNode(getViewTreeNodes(view), node => node.kind === 'workdir'),
			'pairing-hold must keep leftover workDir',
		);
		assert.strictEqual(view.shouldShowWelcome(), false, 'pairing-hold leftover must not flip to welcome');
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:stale-snapshot'),
			undefined,
			'pairing-hold leftover must not flip to disconnected stale as if never connected',
		);

		pairingPending = false;
		phaseKind = 'disconnected';
		rosterService.setEngineConnected(false);
		onDidChangeConnection.fire(uaConnection.getConnectionSnapshot());
		await flushMicrotasks();
		await new Promise<void>(resolve => setImmediate(() => resolve()));

		assert.strictEqual(isConversationPairingHold(uaConnection), false);
		assert.deepStrictEqual(collectSessionIds(getViewTreeNodes(view)), leftoverSessionIds, 'true disconnect after pairing must keep leftover session rows');
		assert.deepStrictEqual(getViewEntries(view).map(entry => entry.id), leftoverFolderIds, 'true disconnect after pairing must keep leftover folder rows');
		const staleNote = findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:stale-snapshot' && node.kind === 'note');
		assert.ok(staleNote, 'true disconnect after pairing must mark leftover stale');
		assert.strictEqual(staleNote.label, NAVIGATOR_STALE_SNAPSHOT_COPY);
		assert.strictEqual(view.shouldShowWelcome(), false);
	});

	test('first-pull pairingPending without leftover stays empty and welcome', async () => {
		const rosterService = new ConversationStubService();
		const uaConnection = createNavigatorConnectionTestStub({
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getConnectionSnapshot: () => ({
				...createNavigatorConnectionTestStub().getConnectionSnapshot(),
				pairingPending: true,
			}),
		});
		const view = await mountView({
			rosterService,
			uaConnection,
		});

		assert.strictEqual(isConversationPairingHold(uaConnection), true);
		assert.strictEqual(rosterService.isEngineConnected(), false);
		assert.strictEqual(collectSessionIds(getViewTreeNodes(view)).length, 0, 'first-pull pairing must not install leftover session rows');
		assert.strictEqual(getViewEntries(view).length, 0, 'first-pull pairing must not install leftover folder rows');
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.kind === 'workdir'),
			undefined,
			'first-pull pairing must not install leftover workDir',
		);
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:stale-snapshot'),
			undefined,
			'first-pull pairing must stay honest empty without a leftover stale note',
		);
		assert.strictEqual(view.shouldShowWelcome(), true, 'first-pull pairing with no leftover stays welcome');
	});

	test('leftover-looks-live first-pull pairing without leftover stays empty and welcome', async () => {
		const rosterService = new ConversationStubService();
		rosterService.setEngineConnected(true);
		const uaConnection = createNavigatorConnectionTestStub({
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getConnectionSnapshot: () => ({
				...createNavigatorConnectionTestStub().getConnectionSnapshot(),
				pairingPending: true,
			}),
		});
		const view = await mountView({
			rosterService,
			uaConnection,
		});

		assert.strictEqual(rosterService.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(uaConnection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(uaConnection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(uaConnection), true);
		assert.strictEqual(collectSessionIds(getViewTreeNodes(view)).length, 0, 'leftover-looks-live first-pull must not paint live session chrome');
		assert.strictEqual(getViewEntries(view).length, 0, 'leftover-looks-live first-pull must not install leftover folder rows');
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.kind === 'workdir'),
			undefined,
			'leftover-looks-live first-pull must not paint live workDir chrome',
		);
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:root'),
			undefined,
			'leftover-looks-live first-pull must not paint live engine root chrome',
		);
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:session-list-loading'),
			undefined,
			'leftover-looks-live first-pull must not paint live Reading chrome',
		);
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:stale-snapshot'),
			undefined,
			'leftover-looks-live first-pull must stay honest empty without a leftover stale note',
		);
		assert.strictEqual(view.shouldShowWelcome(), true, 'leftover-looks-live first-pull with no leftover stays welcome');
	});

	test('leftover-looks-live first-pull after onDidChangeEngineConnection(true) stays empty and welcome', async () => {
		const rosterService = new ConversationStubService();
		const uaConnection = createNavigatorConnectionTestStub({
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getConnectionSnapshot: () => ({
				...createNavigatorConnectionTestStub().getConnectionSnapshot(),
				pairingPending: true,
			}),
		});
		const view = await mountView({
			rosterService,
			uaConnection,
		});

		assert.strictEqual(isConversationPairingHold(uaConnection), true);
		assert.strictEqual(rosterService.isEngineConnected(), false);
		assert.strictEqual(view.shouldShowWelcome(), true, 'pairing-hold first-pull before leftover-looks-live event stays welcome');

		rosterService.setEngineConnected(true);
		await flushMicrotasks();
		await new Promise<void>(resolve => setImmediate(() => resolve()));

		assert.strictEqual(rosterService.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(uaConnection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(uaConnection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(uaConnection), true);
		assert.strictEqual(
			(view as unknown as { wasEverConnected: boolean }).wasEverConnected,
			false,
			'leftover-looks-live onDidChangeEngineConnection(true) must not flip wasEverConnected',
		);
		assert.strictEqual(collectSessionIds(getViewTreeNodes(view)).length, 0, 'leftover-looks-live event first-pull must not paint live session chrome');
		assert.strictEqual(getViewEntries(view).length, 0, 'leftover-looks-live event first-pull must not install leftover folder rows');
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.kind === 'workdir'),
			undefined,
			'leftover-looks-live event first-pull must not paint live workDir chrome',
		);
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:root'),
			undefined,
			'leftover-looks-live event first-pull must not paint ever-connected engine root chrome',
		);
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:session-list-loading'),
			undefined,
			'leftover-looks-live event first-pull must not paint live Reading chrome',
		);
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:stale-snapshot'),
			undefined,
			'leftover-looks-live event first-pull must stay honest empty without leftover-as-live stale chrome',
		);
		assert.strictEqual(view.shouldShowWelcome(), true, 'leftover-looks-live event first-pull with no leftover stays welcome');
	});

	test('leftover-looks-live pairing-hold keeps leftover rows without live chrome rebuild', async () => {
		const folderUri = URI.file('/projects/looks-live-keep');
		const contextService = new TestContextService(testWorkspace(folderUri));
		class LooksLiveRoster extends ConversationStubService {
			override isEngineConnected(): boolean {
				return true;
			}
		}
		const rosterService = new LooksLiveRoster();
		rosterService.setEngineConnected(true);
		let pairingPending = false;
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const baseConnection = createNavigatorConnectionTestStub({
			getNavigatorCapability: () => 'SUPPORTED',
		});
		const uaConnection = createNavigatorConnectionTestStub({
			getNavigatorCapability: () => 'SUPPORTED',
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getConnectionSnapshot: () => ({
				...baseConnection.getConnectionSnapshot(),
				workDir: '/engine/work',
				pairingPending,
			}),
			onDidChangeConnection: onDidChangeConnection.event,
		});
		const view = await mountView({
			contextService,
			rosterService,
			uaConnection,
		});

		const leftoverSessionIds = collectSessionIds(getViewTreeNodes(view));
		const leftoverFolderIds = getViewEntries(view).map(entry => entry.id);
		assert.ok(leftoverSessionIds.length > 0, 'live paint must have leftover session rows');
		assert.ok(leftoverFolderIds.length > 0, 'live paint must have leftover folder rows');
		assert.ok(
			findTreeNode(getViewTreeNodes(view), node => node.kind === 'workdir'),
			'live paint must have leftover workDir',
		);
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:stale-snapshot'),
			undefined,
			'live paint must not already look stale',
		);
		assert.strictEqual(view.shouldShowWelcome(), false);
		assert.strictEqual(isConversationPairingHold(uaConnection), false);
		assert.strictEqual(rosterService.isEngineConnected(), true);

		pairingPending = true;
		onDidChangeConnection.fire(uaConnection.getConnectionSnapshot());
		await flushMicrotasks();
		await new Promise<void>(resolve => setImmediate(() => resolve()));

		assert.strictEqual(uaConnection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(uaConnection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(uaConnection), true);
		assert.strictEqual(rosterService.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.deepStrictEqual(collectSessionIds(getViewTreeNodes(view)), leftoverSessionIds, 'leftover-looks-live KEEP must keep leftover session rows');
		assert.deepStrictEqual(getViewEntries(view).map(entry => entry.id), leftoverFolderIds, 'leftover-looks-live KEEP must keep leftover folder rows');
		assert.ok(
			findTreeNode(getViewTreeNodes(view), node => node.kind === 'workdir'),
			'leftover-looks-live KEEP must keep leftover workDir',
		);
		assert.strictEqual(view.shouldShowWelcome(), false, 'leftover-looks-live KEEP leftover must not flip to welcome');
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:stale-snapshot'),
			undefined,
			'leftover-looks-live KEEP leftover must not rebuild as disconnected stale',
		);
	});

	test('true connected without pairing still paints live engine projects chrome', async () => {
		const rosterService = new ConversationStubService();
		rosterService.setEngineConnected(true);
		const uaConnection = createNavigatorConnectionTestStub({
			getNavigatorCapability: () => 'SUPPORTED',
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getConnectionSnapshot: () => ({
				...createNavigatorConnectionTestStub().getConnectionSnapshot(),
				workDir: '/engine/live',
				pairingPending: false,
			}),
		});
		const view = await mountView({
			rosterService,
			uaConnection,
		});

		assert.strictEqual(rosterService.isEngineConnected(), true);
		assert.strictEqual(isConversationPairingHold(uaConnection), false);
		assert.ok(
			findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:root'),
			'true connected without pairing must paint live engine root',
		);
		assert.ok(
			findTreeNode(getViewTreeNodes(view), node => node.kind === 'workdir'),
			'true connected without pairing must paint live workDir',
		);
		assert.ok(collectSessionIds(getViewTreeNodes(view)).length > 0, 'true connected without pairing must paint live session rows');
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:stale-snapshot'),
			undefined,
			'true connected without pairing must not look stale',
		);
		assert.strictEqual(view.shouldShowWelcome(), false);
	});

	test('true disconnect first-pull stays empty and welcome', async () => {
		const rosterService = new ConversationStubService();
		const uaConnection = createNavigatorConnectionTestStub({
			getConnectionPhase: () => ({ kind: 'disconnected' }),
			getConnectionSnapshot: () => ({
				...createNavigatorConnectionTestStub().getConnectionSnapshot(),
				pairingPending: false,
			}),
		});
		const view = await mountView({
			rosterService,
			uaConnection,
		});

		assert.strictEqual(rosterService.isEngineConnected(), false);
		assert.strictEqual(isConversationPairingHold(uaConnection), false);
		assert.strictEqual(collectSessionIds(getViewTreeNodes(view)).length, 0);
		assert.strictEqual(
			findTreeNode(getViewTreeNodes(view), node => node.id === 'engine:root'),
			undefined,
			'true disconnect first-pull must stay disconnect tree',
		);
		assert.strictEqual(view.shouldShowWelcome(), true);
	});
});
