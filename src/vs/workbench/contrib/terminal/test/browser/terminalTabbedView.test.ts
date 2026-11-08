/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { notStrictEqual, ok, strictEqual } from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore, IDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TerminalTabbedView } from '../../browser/terminalTabbedView.js';
import { TerminalTabList, TerminalTabsListSizes } from '../../browser/terminalTabsList.js';
import { ITerminalChatService, ITerminalConfigurationService, ITerminalEditingService, ITerminalGroupService, ITerminalInstance, ITerminalService, TerminalConnectionState } from '../../browser/terminal.js';
import { TestTerminalConfigurationService, TestTerminalGroupService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IEditableData } from '../../../../common/views.js';
import { ITerminalBackend, TerminalSettingId } from '../../../../../platform/terminal/common/terminal.js';
import { ResourceLabels } from '../../../../browser/labels.js';
import { ConfigurationTarget, IConfigurationChangeEvent, IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ITerminalConfiguration } from '../../common/terminal.js';

class TestTerminalServiceTabbedView extends Disposable implements Partial<ITerminalService> {
	readonly onDidChangeInstances = Event.None;
	readonly onDidDisposeInstance: Event<ITerminalInstance>;
	private readonly _onDidDisposeInstance: Emitter<ITerminalInstance>;
	readonly onAnyInstanceTitleChange = Event.None;
	readonly onAnyInstanceIconChange = Event.None;
	readonly onAnyInstancePrimaryStatusChange = Event.None;
	readonly onDidChangeConnectionState = Event.None;
	connectionState = TerminalConnectionState.Connected;

	constructor(store: Pick<DisposableStore, 'add'>) {
		super();
		this._onDidDisposeInstance = store.add(new Emitter<ITerminalInstance>());
		this.onDidDisposeInstance = this._onDidDisposeInstance.event;
	}

	setContainers(parentElement: HTMLElement, terminalContainer: HTMLElement): void {
		parentElement.appendChild(terminalContainer);
	}

	getPrimaryBackend(): ITerminalBackend | undefined {
		return undefined;
	}

	fireDisposeInstance(instance: ITerminalInstance) {
		this._onDidDisposeInstance.fire(instance);
	}
}

class TestTerminalChatServiceTabbedView extends Disposable implements Partial<ITerminalChatService> {
	private readonly _onDidRegisterTerminalInstanceWithToolSession: Emitter<ITerminalInstance>;
	readonly onDidRegisterTerminalInstanceWithToolSession: Event<ITerminalInstance>;
	hiddenInstances: ITerminalInstance[] = [];

	constructor(store: Pick<DisposableStore, 'add'>) {
		super();
		this._onDidRegisterTerminalInstanceWithToolSession = store.add(new Emitter<ITerminalInstance>());
		this.onDidRegisterTerminalInstanceWithToolSession = this._onDidRegisterTerminalInstanceWithToolSession.event;
	}

	getToolSessionTerminalInstances(onlyHidden?: boolean): ITerminalInstance[] {
		return this.hiddenInstances;
	}

	fireRegisterInstance(instance: ITerminalInstance) {
		this._onDidRegisterTerminalInstanceWithToolSession.fire(instance);
	}
}

class TestTerminalEditingService implements ITerminalEditingService {
	_serviceBrand: undefined;
	getEditableData(_instance: ITerminalInstance): IEditableData | undefined { return undefined; }
	setEditable(_instance: ITerminalInstance, _data: IEditableData | null): void { }
	isEditable(_instance: ITerminalInstance | undefined): boolean { return false; }
	getEditingTerminal(): ITerminalInstance | undefined { return undefined; }
	setEditingTerminal(_instance: ITerminalInstance | undefined): void { }
}

interface ITabbedViewInternals {
	readonly _chatEntry: { readonly element: HTMLElement };
	readonly _tabList: TerminalTabList;
	readonly _splitView: { readonly length: number };
	readonly _tabContainer: HTMLElement;
}

function tabbedViewInternals(tabbedView: TerminalTabbedView): ITabbedViewInternals {
	return tabbedView as unknown as ITabbedViewInternals;
}

suite('TerminalTabbedView', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	let terminalService: TestTerminalServiceTabbedView;
	let chatService: TestTerminalChatServiceTabbedView;
	let groupService: TestTerminalGroupService;
	let terminalConfigService: TestTerminalConfigurationService;
	let configurationService: TestConfigurationService;

	function setTabsConfig(enabled: boolean, hideCondition: ITerminalConfiguration['tabs']['hideCondition']) {
		terminalConfigService.setConfig({
			tabs: {
				enabled,
				hideCondition,
				showActiveTerminal: 'always',
				location: 'left',
				focusMode: 'singleClick',
				title: '${process}',
				description: '',
				separator: ' - ',
				allowAgentCliTitle: false
			}
		});
	}

	function setupTabbedView(parent: HTMLElement, hideCondition: ITerminalConfiguration['tabs']['hideCondition'] = 'never') {
		const instantiationService = workbenchInstantiationService(undefined, store);
		terminalService = store.add(new TestTerminalServiceTabbedView(store));
		chatService = store.add(new TestTerminalChatServiceTabbedView(store));
		groupService = new TestTerminalGroupService();
		groupService.instanceIsSplit = () => false;

		instantiationService.stub(ITerminalService, terminalService as unknown as ITerminalService);
		instantiationService.stub(ITerminalChatService, chatService as unknown as ITerminalChatService);
		instantiationService.stub(ITerminalGroupService, groupService as unknown as ITerminalGroupService);
		instantiationService.stub(ITerminalEditingService, new TestTerminalEditingService());

		const origCreateInstance = instantiationService.createInstance.bind(instantiationService);
		instantiationService.createInstance = <T>(descriptor: any, ...args: any[]): T => {
			const instance = origCreateInstance(descriptor, ...args);
			if (descriptor === ResourceLabels || descriptor.name === 'TerminalTabsDragAndDrop') {
				store.add(instance as unknown as IDisposable);
			}
			return instance;
		};

		terminalConfigService = instantiationService.get(ITerminalConfigurationService) as TestTerminalConfigurationService;
		configurationService = instantiationService.get(IConfigurationService) as TestConfigurationService;
		setTabsConfig(true, hideCondition);

		const tabbedView = store.add(instantiationService.createInstance(TerminalTabbedView, parent));
		store.add((tabbedView as unknown as { _splitView: Disposable })._splitView);
		store.add(toDisposable(() => (tabbedView as unknown as { _removeSashListener(): void })._removeSashListener()));
		return tabbedView;
	}

	function attachToDocument<T extends HTMLElement>(element: T): T {
		document.body.appendChild(element);
		store.add(toDisposable(() => element.remove()));
		return element;
	}

	function stubActiveInstance(): { readonly focusWhenReadyCalls: number } {
		const counter = { focusWhenReadyCalls: 0 };
		groupService.activeInstance = {
			focusWhenReady: async () => { counter.focusWhenReadyCalls++; }
		} satisfies Partial<ITerminalInstance> as unknown as ITerminalInstance;
		return counter;
	}

	function showHiddenChatEntry(): ITerminalInstance {
		const instance = { instanceId: 1 } as unknown as ITerminalInstance;
		chatService.hiddenInstances = [instance];
		chatService.fireRegisterInstance(instance);
		return instance;
	}

	function hideHiddenChatEntry(instance: ITerminalInstance): void {
		chatService.hiddenInstances = [];
		terminalService.fireDisposeInstance(instance);
	}

	function disableTabs(): void {
		setTabsConfig(false, 'never');
		const event: IConfigurationChangeEvent = {
			source: ConfigurationTarget.USER,
			affectedKeys: new Set<string>([TerminalSettingId.TabsEnabled]),
			change: { keys: [TerminalSettingId.TabsEnabled], overrides: [] },
			affectsConfiguration: configuration => configuration === TerminalSettingId.TabsEnabled
		};
		configurationService.onDidChangeConfigurationEmitter.fire(event);
	}

	function focusDeleteButton(view: ITabbedViewInternals): HTMLElement {
		const deleteButton = view._chatEntry.element.querySelector<HTMLElement>('.terminal-tabs-chat-entry-delete');
		ok(deleteButton);
		deleteButton.focus();
		strictEqual(document.activeElement, deleteButton);
		return deleteButton;
	}

	test('should adjust tabList layout height when chat entry visibility changes and preserve panel height', () => {
		const parent = document.createElement('div');
		const tabbedView = setupTabbedView(parent);

		let lastTabListHeight: number | undefined;
		const tabList = (tabbedView as unknown as { _tabList: TerminalTabList })._tabList;
		const origLayout = tabList.layout.bind(tabList);
		tabList.layout = (height?: number, width?: number) => {
			lastTabListHeight = height;
			origLayout(height, width);
		};

		// 1. Initial layout with panel size (width=300, height=500)
		tabbedView.layout(300, 500);
		strictEqual(lastTabListHeight, 500);

		// Mock clientHeight of the chat entry element to 22
		const chatEntry = (tabbedView as unknown as { _chatEntry: { element: HTMLElement } })._chatEntry;
		Object.defineProperty(chatEntry.element, 'clientHeight', { value: 22, configurable: true });

		// 2. Chat entry transitions from none to visible
		const mockInstance = { instanceId: 1 } as unknown as ITerminalInstance;
		chatService.hiddenInstances = [mockInstance];
		chatService.fireRegisterInstance(mockInstance);

		strictEqual(lastTabListHeight, 478);
		strictEqual((tabbedView as unknown as { _panelHeight: number })._panelHeight, 500);

		// 3. Chat entry transitions back from visible to none
		chatService.hiddenInstances = [];
		terminalService.fireDisposeInstance(mockInstance);

		strictEqual(lastTabListHeight, 500);
		strictEqual((tabbedView as unknown as { _panelHeight: number })._panelHeight, 500);
	});

	test('should unify has-text and hasText at MidpointViewWidth (63) and snap in _updateListWidth', () => {
		const parent = document.createElement('div');
		const tabbedView = setupTabbedView(parent);

		const tabList = (tabbedView as unknown as { _tabList: TerminalTabList })._tabList;
		const tabContainer = (tabbedView as unknown as { _tabContainer: HTMLElement })._tabContainer;
		const splitView = (tabbedView as unknown as { _splitView: { resizeView(index: number, size: number): void; getViewSize(index: number): number } })._splitView;

		// Initial panel layout
		tabbedView.layout(300, 500);

		// Width 63: both tabList.hasText and tabContainer 'has-text' class should be true
		splitView.resizeView(0, 63);
		strictEqual(tabList.hasText, true);
		strictEqual(tabContainer.classList.contains('has-text'), true);

		// Width 62: both should be false
		splitView.resizeView(0, 62);
		strictEqual(tabList.hasText, false);
		strictEqual(tabContainer.classList.contains('has-text'), false);

		// Snapping behavior in _updateListWidth:
		// Width 62 (< 63 && >= 46) snaps to 46 (NarrowViewWidth)
		(tabbedView as unknown as { _updateListWidth(w: number): void })._updateListWidth(62);
		strictEqual(splitView.getViewSize(0), TerminalTabsListSizes.NarrowViewWidth);
		strictEqual(tabList.hasText, false);
		strictEqual(tabContainer.classList.contains('has-text'), false);

		// Width 63 (>= 63 && < 80) snaps to 80 (WideViewMinimumWidth)
		(tabbedView as unknown as { _updateListWidth(w: number): void })._updateListWidth(63);
		strictEqual(splitView.getViewSize(0), TerminalTabsListSizes.WideViewMinimumWidth);
		strictEqual(tabList.hasText, true);
		strictEqual(tabContainer.classList.contains('has-text'), true);

		// Width 79 (>= 63 && < 80) snaps to 80 (WideViewMinimumWidth)
		(tabbedView as unknown as { _updateListWidth(w: number): void })._updateListWidth(79);
		strictEqual(splitView.getViewSize(0), TerminalTabsListSizes.WideViewMinimumWidth);
		strictEqual(tabList.hasText, true);
		strictEqual(tabContainer.classList.contains('has-text'), true);
	});

	test('moves focus to the tab list when the focused hidden chat entry hides', () => {
		const tabbedView = setupTabbedView(attachToDocument(document.createElement('div')));
		const view = tabbedViewInternals(tabbedView);
		tabbedView.layout(300, 500);
		const instance = showHiddenChatEntry();
		focusDeleteButton(view);

		hideHiddenChatEntry(instance);

		strictEqual(view._chatEntry.element.style.display, 'none');
		ok(view._tabList.getHTMLElement().contains(document.activeElement));
		notStrictEqual(document.activeElement, document.body);
	});

	test('moves focus to the active terminal once when the focused hidden chat entry leaves with the tab tree', () => {
		const tabbedView = setupTabbedView(attachToDocument(document.createElement('div')), 'singleTerminal');
		const view = tabbedViewInternals(tabbedView);
		const activeInstance = stubActiveInstance();
		// Show before the first panel layout: the tab tree is added here, and an entry relayout
		// inside SplitView.addView would hit resizeView while the split view is busy.
		const instance = showHiddenChatEntry();
		strictEqual(view._splitView.length, 2);
		tabbedView.layout(300, 500);
		focusDeleteButton(view);

		hideHiddenChatEntry(instance);

		strictEqual(view._splitView.length, 1);
		strictEqual(activeInstance.focusWhenReadyCalls, 1);
	});

	test('does not move focus when neither the tab tree nor an active terminal can take it', () => {
		const tabbedView = setupTabbedView(attachToDocument(document.createElement('div')), 'singleTerminal');
		const view = tabbedViewInternals(tabbedView);
		// Same order as the previous test, for the same reason.
		const instance = showHiddenChatEntry();
		strictEqual(view._splitView.length, 2);
		tabbedView.layout(300, 500);
		focusDeleteButton(view);

		hideHiddenChatEntry(instance);

		strictEqual(view._splitView.length, 1);
		strictEqual(groupService.activeInstance, undefined);
		strictEqual(document.activeElement, document.body);
	});

	test('leaves focus alone when the hidden chat entry hides without holding focus', () => {
		const tabbedView = setupTabbedView(attachToDocument(document.createElement('div')));
		const view = tabbedViewInternals(tabbedView);
		const activeInstance = stubActiveInstance();
		const input = attachToDocument(document.createElement('input'));
		tabbedView.layout(300, 500);
		const instance = showHiddenChatEntry();
		input.focus();

		hideHiddenChatEntry(instance);

		strictEqual(document.activeElement, input);
		strictEqual(activeInstance.focusWhenReadyCalls, 0);
		ok(!view._tabList.getHTMLElement().contains(document.activeElement));
	});

	test('moves focus to the active terminal when disabling tabs detaches the focused hidden chat entry', () => {
		const tabbedView = setupTabbedView(attachToDocument(document.createElement('div')));
		const view = tabbedViewInternals(tabbedView);
		const activeInstance = stubActiveInstance();
		tabbedView.layout(300, 500);
		showHiddenChatEntry();
		view._chatEntry.element.focus();
		strictEqual(document.activeElement, view._chatEntry.element);

		disableTabs();

		strictEqual(view._splitView.length, 1);
		strictEqual(view._chatEntry.element.isConnected, false);
		strictEqual(activeInstance.focusWhenReadyCalls, 1);
	});

	test('moves focus to the active terminal on mouseleave after the pointer kept the disabled tab tree', () => {
		const tabbedView = setupTabbedView(attachToDocument(document.createElement('div')));
		const view = tabbedViewInternals(tabbedView);
		const activeInstance = stubActiveInstance();
		tabbedView.layout(300, 500);
		showHiddenChatEntry();
		view._chatEntry.element.focus();
		view._tabContainer.dispatchEvent(new MouseEvent('mouseenter'));

		disableTabs();

		strictEqual(view._splitView.length, 2);
		strictEqual(document.activeElement, view._chatEntry.element);
		strictEqual(activeInstance.focusWhenReadyCalls, 0);

		view._tabContainer.dispatchEvent(new MouseEvent('mouseleave'));

		strictEqual(view._splitView.length, 1);
		strictEqual(activeInstance.focusWhenReadyCalls, 1);
	});
});

suite('TerminalTabList', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('layout width >= 63 sets hasText=true, < 63 sets hasText=false', () => {
		const parent = document.createElement('div');
		const instantiationService = workbenchInstantiationService(undefined, store);
		const terminalService = store.add(new TestTerminalServiceTabbedView(store));
		const chatService = store.add(new TestTerminalChatServiceTabbedView(store));
		const groupService = new TestTerminalGroupService();
		groupService.instanceIsSplit = () => false;

		instantiationService.stub(ITerminalService, terminalService as unknown as ITerminalService);
		instantiationService.stub(ITerminalChatService, chatService as unknown as ITerminalChatService);
		instantiationService.stub(ITerminalGroupService, groupService as unknown as ITerminalGroupService);
		instantiationService.stub(ITerminalEditingService, new TestTerminalEditingService());

		const origCreateInstance = instantiationService.createInstance.bind(instantiationService);
		instantiationService.createInstance = <T>(descriptor: any, ...args: any[]): T => {
			const instance = origCreateInstance(descriptor, ...args);
			if (descriptor === ResourceLabels || descriptor.name === 'TerminalTabsDragAndDrop') {
				store.add(instance as unknown as IDisposable);
			}
			return instance;
		};

		const container = document.createElement('div');
		parent.appendChild(container);

		const tabList = store.add(instantiationService.createInstance(TerminalTabList, container));

		tabList.layout(100, 63);
		strictEqual(tabList.hasText, true);

		tabList.layout(100, 62);
		strictEqual(tabList.hasText, false);
	});
});
