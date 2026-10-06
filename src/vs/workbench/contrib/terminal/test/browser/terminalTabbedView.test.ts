/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { strictEqual } from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore, IDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TerminalTabbedView } from '../../browser/terminalTabbedView.js';
import { TerminalTabList, TerminalTabsListSizes } from '../../browser/terminalTabsList.js';
import { ITerminalChatService, ITerminalConfigurationService, ITerminalEditingService, ITerminalGroupService, ITerminalInstance, ITerminalService, TerminalConnectionState } from '../../browser/terminal.js';
import { TestTerminalConfigurationService, TestTerminalGroupService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IEditableData } from '../../../../common/views.js';
import { ITerminalBackend } from '../../../../../platform/terminal/common/terminal.js';
import { ResourceLabels } from '../../../../browser/labels.js';

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

suite('TerminalTabbedView', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	let terminalService: TestTerminalServiceTabbedView;
	let chatService: TestTerminalChatServiceTabbedView;
	let groupService: TestTerminalGroupService;

	function setupTabbedView(parent: HTMLElement) {
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

		const configService = instantiationService.get(ITerminalConfigurationService) as TestTerminalConfigurationService;
		configService.setConfig({
			tabs: {
				enabled: true,
				hideCondition: 'never',
				showActiveTerminal: 'always',
				location: 'left',
				focusMode: 'singleClick',
				title: '${process}',
				description: '',
				separator: ' - ',
				allowAgentCliTitle: false
			}
		} as any);

		const tabbedView = store.add(instantiationService.createInstance(TerminalTabbedView, parent));
		store.add((tabbedView as unknown as { _splitView: Disposable })._splitView);
		store.add(toDisposable(() => (tabbedView as unknown as { _removeSashListener(): void })._removeSashListener()));
		return tabbedView;
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
