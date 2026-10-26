/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { DisposableStore, IDisposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestCommandService } from '../../../../../editor/test/browser/editorTestServices.js';
import { IActionViewItemFactory, IActionViewItemService } from '../../../../../platform/actions/browser/actionViewItemService.js';
import { IMenu, IMenuActionOptions, IMenuService, MenuId } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { ContextKeyService } from '../../../../../platform/contextkey/browser/contextKeyService.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { MockContextKeyService, MockKeybindingService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryServiceShape } from '../../../../../platform/telemetry/common/telemetryUtils.js';
import { IsAuxiliaryWindowContext, IsSessionsWindowContext } from '../../../../../workbench/common/contextkeys.js';
import { IsPhoneLayoutContext } from '../../../../common/contextkeys.js';
import { IMobileSessionFilterChipHost } from '../../../../browser/parts/mobile/mobileSessionFilterChips.js';
import { SessionStatus } from '../../../../services/sessions/common/session.js';
import { AgentHostShortcutsWidget } from '../../browser/agentHostShortcutsWidget.js';
import { SessionsView } from '../../browser/views/sessionsView.js';

class TestActionViewItemService implements IActionViewItemService {
	declare _serviceBrand: undefined;
	readonly onDidChange = Event.None;
	register(_menu: MenuId, _commandId: string | MenuId, _provider: IActionViewItemFactory): { dispose(): void } {
		return { dispose: () => { } };
	}
	lookUp(_menu: MenuId, _commandId: string | MenuId): IActionViewItemFactory | undefined {
		return undefined;
	}
}

class TestMenuService implements IMenuService {
	declare readonly _serviceBrand: undefined;
	createMenu(_id: MenuId): IMenu {
		return {
			onDidChange: Event.None,
			dispose: () => { },
			getActions: () => [],
		};
	}
	getMenuActions(_id: MenuId, _contextKeyService: unknown, _options?: IMenuActionOptions) { return []; }
	getMenuContexts() { return new Set<string>(); }
	resetHiddenStates() { }
}

function createInstantiationService(disposables: DisposableStore, contextKeyService: IContextKeyService): TestInstantiationService {
	const instantiationService = disposables.add(new TestInstantiationService());
	instantiationService.set(IMenuService, new TestMenuService());
	instantiationService.set(IActionViewItemService, new TestActionViewItemService());
	instantiationService.set(IContextKeyService, contextKeyService);
	instantiationService.set(IContextMenuService, {
		_serviceBrand: undefined,
		onDidShowContextMenu: Event.None,
		onDidHideContextMenu: Event.None,
		showContextMenu: () => { },
	});
	instantiationService.set(IKeybindingService, new MockKeybindingService());
	instantiationService.set(ICommandService, new TestCommandService(instantiationService));
	instantiationService.set(ITelemetryService, new NullTelemetryServiceShape());
	return instantiationService;
}

function createContainer(disposables: DisposableStore): HTMLElement {
	const container = document.createElement('div');
	document.body.appendChild(container);
	disposables.add({ dispose: () => container.remove() });
	return container;
}

function createWidget(disposables: DisposableStore): { container: HTMLElement; widget: AgentHostShortcutsWidget } {
	const container = createContainer(disposables);
	const instantiationService = createInstantiationService(disposables, new MockContextKeyService());
	const widget = instantiationService.createInstance(AgentHostShortcutsWidget, container, undefined);
	disposables.add(widget);
	return { container, widget };
}

suite('AgentHostShortcutsWidget', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('renders an always-expanded toolbar with content and no collapse affordance', () => {
		const testDisposables = disposables.add(new DisposableStore());
		const { container } = createWidget(testDisposables);

		const toolbar = container.querySelector<HTMLElement>('.agent-host-toolbar');
		const content = container.querySelector<HTMLElement>('.agent-host-toolbar-content');

		assert.deepStrictEqual({
			toolbarPresent: !!toolbar,
			contentPresent: !!content,
			collapsed: toolbar?.classList.contains('collapsed') ?? false,
			hasChevron: !!container.querySelector('.ai-customization-chevron, .agent-host-toolbar-chevron'),
		}, {
			toolbarPresent: true,
			contentPresent: true,
			collapsed: false,
			hasChevron: false,
		});
	});

	test('keeps divider and toolbar as direct flex children and removes only owned nodes', () => {
		const testDisposables = disposables.add(new DisposableStore());
		const { container, widget } = createWidget(testDisposables);

		container.style.display = 'flex';
		container.style.flexDirection = 'column';
		const unrelated = document.createElement('div');
		container.prepend(unrelated);
		const separator = container.querySelector<HTMLElement>('.agent-host-toolbar-separator')!;
		const toolbar = container.querySelector<HTMLElement>('.agent-host-toolbar')!;
		assert.deepStrictEqual({
			children: [...container.children],
			separatorShrink: separator.ownerDocument.defaultView!.getComputedStyle(separator).flexShrink,
			toolbarShrink: toolbar.ownerDocument.defaultView!.getComputedStyle(toolbar).flexShrink,
		}, { children: [unrelated, separator, toolbar], separatorShrink: '0', toolbarShrink: '0' });
		widget.dispose();
		assert.deepStrictEqual([...container.children], [unrelated]);
	});
});

interface IResponsiveControlsHarness {
	readonly sessionsContainer: HTMLElement;
	readonly headerRow: HTMLElement;
	readonly headerLabel: HTMLElement;
	readonly headerActions: HTMLElement;
	readonly filterChipsContainer: HTMLElement;
	readonly sessionsControl: IMobileSessionFilterChipHost;
	readonly responsiveControls: DisposableStore;
	readonly agentHostShortcutsWidget: MutableDisposable<AgentHostShortcutsWidget>;
	readonly scopedContextKeyService: IContextKeyService;
	readonly instantiationService: TestInstantiationService;
	responsiveControlsPhone: boolean | undefined;
	isFindWidgetOpen: boolean;
	_register<T extends IDisposable>(value: T): T;
	updateResponsiveControls(): void;
	updateHeaderLayout(): void;
	updateAgentHostShortcutsWidget(): void;
	layoutSidebarSplitView(): void;
	openFind(): void;
	openSortGroupSheet(): void;
}

const registerResponsiveControls = Reflect.get(SessionsView.prototype, 'registerResponsiveControls') as (this: IResponsiveControlsHarness) => void;
const updateResponsiveControls = Reflect.get(SessionsView.prototype, 'updateResponsiveControls') as (this: IResponsiveControlsHarness) => void;
const updateHeaderLayout = Reflect.get(SessionsView.prototype, 'updateHeaderLayout') as (this: IResponsiveControlsHarness) => void;
const registerAgentHostShortcutsWidget = Reflect.get(SessionsView.prototype, 'registerAgentHostShortcutsWidget') as (this: IResponsiveControlsHarness) => void;
const updateAgentHostShortcutsWidget = Reflect.get(SessionsView.prototype, 'updateAgentHostShortcutsWidget') as (this: IResponsiveControlsHarness) => void;

suite('SessionsView responsive controls (D1370)', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function createHarness(phone: boolean) {
		const store = disposables.add(new DisposableStore());
		const contextKeyService = store.add(new ContextKeyService(new TestConfigurationService()));
		const phoneLayout = IsPhoneLayoutContext.bindTo(contextKeyService);
		phoneLayout.set(phone);
		const sessionsWindow = IsSessionsWindowContext.bindTo(contextKeyService);
		sessionsWindow.set(true);
		const auxiliaryWindow = IsAuxiliaryWindowContext.bindTo(contextKeyService);
		const instantiationService = createInstantiationService(store, contextKeyService);
		const container = createContainer(store);
		container.classList.toggle('phone-layout', phone);
		const headerRow = container.appendChild(document.createElement('div'));
		const headerLabel = headerRow.appendChild(document.createElement('span'));
		headerLabel.style.width = '100px';
		const headerActions = headerRow.appendChild(document.createElement('div'));
		const filterChipsContainer = container.appendChild(document.createElement('div'));
		const excluded = new Set<SessionStatus>();
		let findCalls = 0;
		const host: IResponsiveControlsHarness = {
			sessionsContainer: container, headerRow, headerLabel, headerActions, filterChipsContainer,
			sessionsControl: {
				onDidUpdate: Event.None,
				isStatusExcluded: status => excluded.has(status),
				setStatusExcluded: (status, value) => {
					if (value) {
						excluded.add(status);
					} else {
						excluded.delete(status);
					}
				},
			},
			responsiveControls: store.add(new DisposableStore()),
			agentHostShortcutsWidget: store.add(new MutableDisposable<AgentHostShortcutsWidget>()),
			scopedContextKeyService: contextKeyService, instantiationService,
			responsiveControlsPhone: undefined, isFindWidgetOpen: false,
			_register: value => store.add(value),
			updateResponsiveControls: () => updateResponsiveControls.call(host),
			updateHeaderLayout: () => updateHeaderLayout.call(host),
			updateAgentHostShortcutsWidget: () => updateAgentHostShortcutsWidget.call(host),
			layoutSidebarSplitView: () => { },
			openFind: () => { findCalls++; },
			openSortGroupSheet: () => { },
		};
		registerResponsiveControls.call(host);
		// The production caller registers this only on web. Exercise the same
		// lifecycle here without relying on the Electron test runner's platform.
		registerAgentHostShortcutsWidget.call(host);
		const state = () => ({
			headerToolbars: headerActions.querySelectorAll('.monaco-toolbar').length,
			chips: filterChipsContainer.querySelectorAll('.mobile-session-filter-chip').length,
			hostToolbars: container.querySelectorAll('.agent-host-toolbar').length,
			dividers: container.querySelectorAll('.agent-host-toolbar-separator').length,
			phoneHeader: headerRow.classList.contains('phone-layout-empty'),
		});
		return { container, host, state, phoneLayout, sessionsWindow, auxiliaryWindow, findCalls: () => findCalls };
	}

	const desktopState = { headerToolbars: 1, chips: 0, hostToolbars: 1, dividers: 1, phoneHeader: false };
	const phoneState = { headerToolbars: 0, chips: 5, hostToolbars: 0, dividers: 0, phoneHeader: true };

	test('desktop to phone to desktop follows context before the CSS class catches up', () => {
		const h = createHarness(false);
		assert.deepStrictEqual(h.state(), desktopState);
		const oldToolbar = h.container.querySelector('.agent-host-toolbar')!;
		h.phoneLayout.set(true); // Workbench.layout publishes context first.
		assert.deepStrictEqual({ state: h.state(), oldConnected: oldToolbar.isConnected }, { state: phoneState, oldConnected: false });
		h.container.classList.add('phone-layout');
		h.phoneLayout.set(false);
		assert.deepStrictEqual(h.state(), desktopState);
	});

	test('phone startup and repeated round trips create one toolbar set and release old listeners', () => {
		const h = createHarness(true);
		assert.deepStrictEqual(h.state(), phoneState);
		const oldFind = h.host.filterChipsContainer.querySelector<HTMLElement>('.icon-only')!;
		const completed = h.host.filterChipsContainer.querySelector<HTMLElement>('.mobile-session-filter-chip')!;
		completed.click();
		for (let i = 0; i < 3; i++) {
			h.phoneLayout.set(false);
			assert.deepStrictEqual(h.state(), desktopState);
			h.phoneLayout.set(true);
			assert.deepStrictEqual(h.state(), phoneState);
		}
		oldFind.click();
		h.host.filterChipsContainer.querySelector<HTMLElement>('.icon-only')!.click();
		assert.deepStrictEqual({
			findCalls: h.findCalls(),
			completedActive: h.host.filterChipsContainer.querySelector('.mobile-session-filter-chip')!.getAttribute('aria-pressed'),
		}, { findCalls: 1, completedActive: 'true' });
	});

	test('Host toolbar respects sessions/auxiliary window gates and ignores unrelated context', () => {
		const h = createHarness(false);
		const toolbar = h.container.querySelector('.agent-host-toolbar');
		h.host.scopedContextKeyService.createKey<boolean>('unrelated', false).set(true);
		assert.strictEqual(h.container.querySelector('.agent-host-toolbar'), toolbar);
		h.auxiliaryWindow.set(true);
		assert.strictEqual(h.state().hostToolbars, 0);
		h.auxiliaryWindow.set(false);
		assert.strictEqual(h.state().hostToolbars, 1);
		h.sessionsWindow.set(false);
		assert.strictEqual(h.state().hostToolbars, 0);
		h.sessionsWindow.set(true);
		assert.deepStrictEqual(h.state(), desktopState);
	});
});
