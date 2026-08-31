/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { IRecentlyOpened, IWorkspacesService } from '../../../../../platform/workspaces/common/workspaces.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../../platform/workspace/common/workspace.js';
import { testWorkspace, Workspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { IViewContainerModel, IViewDescriptorService, ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import { TestContextService } from '../../../../test/common/workbenchTestServices.js';
import { TestWorkspacesService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { NAVIGATOR_PROJECTS_VIEW_ID } from '../../browser/navigatorStubView.js';
import { INavigatorProjectEntry, NavigatorProjectsView } from '../../browser/navigatorProjectsList.js';
import { CONVERSATION_STUB_SEED_SESSIONS } from '../../../conversation/browser/conversationStubModel.js';

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

	function getViewList(view: NavigatorProjectsView): WorkbenchList<INavigatorProjectEntry> {
		return (view as unknown as { list: WorkbenchList<INavigatorProjectEntry> }).list;
	}

	function getViewEntries(view: NavigatorProjectsView): INavigatorProjectEntry[] {
		return (view as unknown as { entries: INavigatorProjectEntry[] }).entries;
	}

	async function mountView(options?: {
		contextService?: TestContextService;
		workspacesService?: IWorkspacesService;
	}): Promise<NavigatorProjectsView> {
		const contextService = options?.contextService ?? new TestContextService(new Workspace('empty-workspace', []));
		const workspacesService = options?.workspacesService ?? new TestWorkspacesService();
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IWorkspaceContextService, contextService);
		instantiationService.stub(IWorkspacesService, workspacesService);
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

		const list = getViewList(view);
		assert.strictEqual(list.length, 1);
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
});
