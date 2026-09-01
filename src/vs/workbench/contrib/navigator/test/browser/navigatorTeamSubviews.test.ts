/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions as ViewExtensions, IViewContainerModel, IViewDescriptorService, IViewsRegistry, ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { OPEN_NAVIGATOR_TEAM_INSPECT_COMMAND_ID } from '../../browser/agentInspectIds.js';
import '../../browser/navigator.contribution.js';
import { NAVIGATOR_TEAM_VIEW_ID } from '../../browser/navigatorStubView.js';
import {
	INavigatorTeamMember,
	NAVIGATOR_TEAM_SHOW_MEMBERS_COMMAND_ID,
	NAVIGATOR_TEAM_SHOW_TASKS_COMMAND_ID,
	NavigatorTeamView,
} from '../../browser/navigatorTeamList.js';

const TEAM_MEMBERS_EMPTY_COPY = 'No team members yet';
const TEAM_TASKS_EMPTY_COPY = 'No tasks yet';

suite('Navigator Team subviews', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountTeamView(): NavigatorTeamView {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const stubViewContainer = {
			id: 'navigator-team-test-container',
			title: { value: 'Team', original: 'Team' },
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

		const view = store.add(instantiationService.createInstance(NavigatorTeamView, {
			id: NAVIGATOR_TEAM_VIEW_ID,
			title: 'Team',
		}));
		const container = document.createElement('div');
		view.render();
		container.appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);
		return view;
	}

	function getFilterInput(view: NavigatorTeamView): HTMLInputElement | null {
		return view.element.querySelector('.navigator-team-inline-filter-input');
	}

	function setMemberEntries(view: NavigatorTeamView, entries: { id: string; label: string }[]): void {
		(view as unknown as { setMemberEntries: (entries: { id: string; label: string }[]) => void }).setMemberEntries(entries);
	}

	function setTaskEntries(view: NavigatorTeamView, entries: { id: string; label: string }[]): void {
		(view as unknown as { setTaskEntries: (entries: { id: string; label: string }[]) => void }).setTaskEntries(entries);
	}

	async function setFilterQuery(view: NavigatorTeamView, query: string): Promise<void> {
		const input = getFilterInput(view);
		assert.ok(input, 'filter input must exist');
		input.value = query;
		input.dispatchEvent(new globalThis.Event('input'));
		await new Promise<void>(resolve => setTimeout(resolve, 0));
	}

	test('ViewTitle registers Members, Tasks, and Inspect actions for Team', () => {
		const viewTitleItems = MenuRegistry.getMenuItems(MenuId.ViewTitle).filter(isIMenuItem);
		const membersItem = viewTitleItems.find(item => item.command.id === NAVIGATOR_TEAM_SHOW_MEMBERS_COMMAND_ID);
		const tasksItem = viewTitleItems.find(item => item.command.id === NAVIGATOR_TEAM_SHOW_TASKS_COMMAND_ID);
		const inspectItem = viewTitleItems.find(item => item.command.id === OPEN_NAVIGATOR_TEAM_INSPECT_COMMAND_ID);

		assert.ok(membersItem, 'Team ViewTitle must expose Members');
		assert.ok(tasksItem, 'Team ViewTitle must expose Tasks');
		assert.ok(inspectItem, 'Team ViewTitle must still expose Inspect');
	});

	test('defaults to Members subview with honest empty state', () => {
		const view = mountTeamView();

		assert.strictEqual(view.getActiveSubview(), 'members');

		const membersSubview = view.element.querySelector('.navigator-team-subview.active');
		assert.ok(membersSubview, 'expected active members subview');
		assert.ok(membersSubview.classList.contains('navigator-team-subview'));

		const membersEmpty = view.element.querySelector('.navigator-team-subview.active .navigator-stub-empty');
		assert.ok(membersEmpty);
		assert.strictEqual(membersEmpty?.textContent, TEAM_MEMBERS_EMPTY_COPY);
		assert.ok(!membersEmpty?.textContent?.match(/copilot/i));
		assert.ok(!membersEmpty?.textContent?.match(/not connected/i));

		const tasksEmpty = view.element.querySelector('.navigator-team-subview:not(.active) .navigator-stub-empty');
		assert.ok(tasksEmpty);
		assert.strictEqual(tasksEmpty?.textContent, TEAM_TASKS_EMPTY_COPY);
	});

	test('showTasks reveals Tasks empty list', () => {
		const view = mountTeamView();

		view.showTasks();
		assert.strictEqual(view.getActiveSubview(), 'tasks');
		assert.strictEqual(view.shouldShowWelcome(), false);

		const activeSubview = view.element.querySelector('.navigator-team-subview.active');
		assert.ok(activeSubview?.querySelector('.navigator-team-tasks-list'));

		const tasksEmpty = activeSubview?.querySelector('.navigator-stub-empty');
		assert.ok(tasksEmpty);
		assert.strictEqual(tasksEmpty?.textContent, TEAM_TASKS_EMPTY_COPY);
		assert.ok(!tasksEmpty?.textContent?.match(/copilot/i));
		assert.ok(!tasksEmpty?.textContent?.match(/open chat/i));
		assert.ok(!/\(command:/.test(tasksEmpty?.textContent ?? ''));
	});

	test('switches between Members and Tasks subviews', () => {
		const view = mountTeamView();

		view.showTasks();
		assert.strictEqual(view.getActiveSubview(), 'tasks');

		let activeSubview = view.element.querySelector('.navigator-team-subview.active');
		assert.ok(activeSubview?.querySelector('.navigator-team-tasks-list'));

		view.showMembers();
		assert.strictEqual(view.getActiveSubview(), 'members');

		activeSubview = view.element.querySelector('.navigator-team-subview.active');
		assert.ok(activeSubview?.querySelector('.navigator-team-list'));
	});

	test('creates WorkbenchList bodies without engine data or fake task rows', () => {
		const view = mountTeamView();

		const membersList = (view as unknown as { membersList: WorkbenchList<INavigatorTeamMember> }).membersList;
		const tasksList = (view as unknown as { tasksList: WorkbenchList<{ id: string; label: string }> }).tasksList;

		assert.ok(membersList, 'expected WorkbenchList for members');
		assert.ok(tasksList, 'expected WorkbenchList for tasks');
		assert.strictEqual(membersList.length, 0);
		assert.strictEqual(tasksList.length, 0);
		assert.strictEqual(view.element.querySelector('.chat-widget'), null);
		assert.strictEqual(view.element.querySelector('.chat-setup'), null);
		assert.strictEqual(view.element.querySelector('.navigator-team-type-filter'), null);
		assert.strictEqual(view.element.querySelector('.navigator-panel-body-filter-status'), null);
	});

	test('body-top filter sits above subview content with Filter team placeholder', () => {
		const view = mountTeamView();

		const filter = view.element.querySelector('.navigator-team-inline-filter');
		assert.ok(filter, 'expected body-top filter chrome');

		const input = getFilterInput(view);
		assert.ok(input);
		assert.strictEqual(input?.placeholder, 'Filter team');
		assert.strictEqual(input?.getAttribute('aria-label'), 'Filter team');

		const body = view.element.querySelector('.navigator-team-view');
		assert.ok(body);
		const children = Array.from(body!.children);
		assert.strictEqual(children[0], filter, 'filter must be first in body');
		assert.ok(children[1]?.classList.contains('navigator-team-subview'));

		const clearButton = view.element.querySelector('.navigator-team-inline-filter-clear') as HTMLElement | null;
		assert.ok(clearButton);
		assert.strictEqual(filter?.classList.contains('has-text'), false);

		assert.strictEqual(view.element.querySelector('.navigator-team-type-filter'), null);
		assert.strictEqual(view.element.querySelector('.navigator-panel-body-filter-status'), null);
	});

	test('shouldShowWelcome is false so filter is not covered by welcome overlay', () => {
		const view = mountTeamView();
		assert.strictEqual(view.shouldShowWelcome(), false);
	});

	test('shared filter query live-filters members and tasks lists', async () => {
		const view = mountTeamView();

		setMemberEntries(view, [
			{ id: 'm1', label: 'Alpha Member' },
			{ id: 'm2', label: 'Beta Member' },
		]);
		setTaskEntries(view, [
			{ id: 't1', label: 'Alpha Task' },
			{ id: 't2', label: 'Gamma Task' },
		]);

		const membersList = (view as unknown as { membersList: WorkbenchList<INavigatorTeamMember> }).membersList;
		const tasksList = (view as unknown as { tasksList: WorkbenchList<{ id: string; label: string }> }).tasksList;

		assert.strictEqual(membersList.length, 2);
		assert.strictEqual(tasksList.length, 2);

		await setFilterQuery(view, 'alpha');

		assert.strictEqual(membersList.length, 1);
		assert.strictEqual(tasksList.length, 1);
		assert.strictEqual(membersList.element(0)?.label, 'Alpha Member');
		assert.strictEqual(tasksList.element(0)?.label, 'Alpha Task');

		view.showTasks();
		assert.strictEqual(view.getActiveSubview(), 'tasks');
		assert.strictEqual(getFilterInput(view)?.value, 'alpha');
		assert.strictEqual(tasksList.length, 1);

		const filter = view.element.querySelector('.navigator-team-inline-filter');
		const activeSubview = view.element.querySelector('.navigator-team-subview.active');
		assert.ok(filter && activeSubview);
		assert.ok(filter!.compareDocumentPosition(activeSubview!) & Node.DOCUMENT_POSITION_FOLLOWING);
	});

	test('unfiltered empty keeps honest empty copy and hides list', () => {
		const view = mountTeamView();

		const membersEmpty = view.element.querySelector('.navigator-team-subview.active .navigator-stub-empty') as HTMLElement | null;
		const membersList = view.element.querySelector('.navigator-team-list') as HTMLElement | null;
		assert.ok(membersEmpty);
		assert.ok(membersList);
		assert.strictEqual(membersEmpty.style.display, 'block');
		assert.strictEqual(membersList.style.display, 'none');
		assert.strictEqual(membersEmpty.textContent, TEAM_MEMBERS_EMPTY_COPY);
	});

	test('Team view descriptor registers NavigatorTeamView ctor', () => {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const descriptor = viewsRegistry.getView(NAVIGATOR_TEAM_VIEW_ID);
		assert.ok(descriptor);
		assert.strictEqual(descriptor.ctorDescriptor.ctor, NavigatorTeamView);
	});
});
