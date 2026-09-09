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
import { IRecentlyOpened, IWorkspacesService } from '../../../../../platform/workspaces/common/workspaces.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../../platform/workspace/common/workspace.js';
import { testWorkspace, Workspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { IViewContainerModel, IViewDescriptorService, ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import { IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { IWorkbenchLayoutService } from '../../../../services/layout/browser/layoutService.js';
import { TestContextService } from '../../../../test/common/workbenchTestServices.js';
import { TestHostService, TestWorkspacesService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationStubService, IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { NAVIGATOR_PROJECTS_VIEW_ID } from '../../browser/navigatorStubView.js';
import { INavigatorLocalFolderEntry, NavigatorProjectsView, navigatorProjectsRecentsFailureMessage } from '../../browser/navigatorProjectsList.js';
import { INavigatorProjectsTreeNode } from '../../common/navigatorProjectsTree.js';
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
});
