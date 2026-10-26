/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getWindow } from '../../../../base/browser/dom.js';
import { timeout } from '../../../../base/common/async.js';
import { Color, RGBA } from '../../../../base/common/color.js';
import { Event } from '../../../../base/common/event.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { getErrorMessage } from '../../../../base/common/errors.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { asCssVariableName, getColorRegistry } from '../../../../platform/theme/common/colorRegistry.js';
import { ConversationPart, IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IViewContainerModel, IViewDescriptorService, ViewContainer, ViewContainerLocation } from '../../../common/views.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { TestEditorService, TestLayoutService, workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { CONVERSATION_SESSIONS_VIEW_ID, ConversationSessionsView } from './conversationSessionsView.js';
import { ConversationStubService, IConversationRosterService } from './conversationStubService.js';
import { createConversationConnectionTestStub } from '../test/common/conversationConnectionTestStub.js';
import { stubConversationTimelineLinkServices } from '../test/browser/conversationTimelineLinkTestStubs.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ColorThemeData } from '../../../services/themes/common/colorThemeData.js';
import { COLOR_THEME_DARK_INITIAL_COLORS, COLOR_THEME_LIGHT_INITIAL_COLORS } from '../../../services/themes/common/workbenchThemeService.js';

suite('ConversationSessionsView (browser co-located)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const stubViewContainer = {
		id: 'conversation-sessions-colocated-test-container',
		title: { value: 'Sessions', original: 'Sessions' },
	} as ViewContainer;

	function createViewDescriptorServiceStub(): IViewDescriptorService {
		return new class extends mock<IViewDescriptorService>() {
			override onDidChangeLocation = Event.None;
			override getViewLocationById(_id: string): ViewContainerLocation {
				return ViewContainerLocation.Sidebar;
			}
			override getViewDescriptorById(_id: string) {
				return null;
			}
			override getViewContainerByViewId(_id: string): ViewContainer | null {
				return stubViewContainer;
			}
			override getViewContainerModel(_viewContainer: ViewContainer): IViewContainerModel {
				return {
					title: stubViewContainer.title.value,
					onDidChangeContainerInfo: Event.None,
				} as IViewContainerModel;
			}
			override getDefaultContainerById(_id: string): ViewContainer | null {
				return stubViewContainer;
			}
		}();
	}

	async function setFilterQuery(view: ConversationSessionsView, query: string): Promise<void> {
		const input = view.element.querySelector('.conversation-sessions-inline-filter-input') as HTMLInputElement | null;
		assert.ok(input, 'filter input must exist');
		input.value = query;
		input.dispatchEvent(new globalThis.Event('input'));
		await new Promise<void>(resolve => setTimeout(resolve, 0));
	}

	function getVisibleSessionTitles(view: ConversationSessionsView): string[] {
		return [...view.element.querySelectorAll('.conversation-sessions-item-label')]
			.map(label => label.textContent ?? '');
	}

	function mountView(stubService?: ConversationStubService): { view: ConversationSessionsView; stubService: ConversationStubService } {
		const service = stubService ?? store.add(new ConversationStubService());
		const layoutService = new class extends TestLayoutService {
			override isVisible(part: Parts): boolean {
				return part === Parts.CONVERSATION_PART ? true : super.isVisible(part);
			}
		}();
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, service);
		instantiationService.stub(IWorkbenchLayoutService, layoutService);
		instantiationService.stub(IViewDescriptorService, createViewDescriptorServiceStub());
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		instantiationService.stub(INotificationService, {
			error: (message: string | Error) => {
				void (typeof message === 'string' ? message : getErrorMessage(message));
			},
		} as INotificationService);
		stubConversationTimelineLinkServices(instantiationService);
		instantiationService.stub(IEditorService, store.add(new TestEditorService()));

		const conversationPart = store.add(instantiationService.createInstance(ConversationPart));
		conversationPart.create(document.createElement('div'));
		instantiationService.stub(IConversationPartService, conversationPart);

		const view = store.add(instantiationService.createInstance(ConversationSessionsView, {
			id: CONVERSATION_SESSIONS_VIEW_ID,
			title: 'Sessions',
		}));
		const container = document.createElement('div');
		view.render();
		container.appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);
		return { view, stubService: service };
	}

	test('inline filter keeps the active session visible when its title does not match', async () => {
		const { view, stubService } = mountView();
		const alphaId = stubService.getActiveSessionId();
		stubService.renameSession(alphaId, 'Alpha roster item');
		const betaId = stubService.createSession();
		stubService.renameSession(betaId, 'Beta roster item');
		stubService.switchSession(betaId);

		await setFilterQuery(view, 'alpha');

		const titles = getVisibleSessionTitles(view);
		assert.strictEqual(stubService.getActiveSessionId(), betaId);
		assert.ok(titles.includes('Beta roster item'), 'active session must stay in the filtered roster');
		assert.ok(titles.includes('Alpha roster item'));
		assert.strictEqual(titles.length, 2);
		assert.ok(view.element.querySelector('.conversation-sessions-item-active .conversation-sessions-item-label')?.textContent === 'Beta roster item');
		assert.ok(view.element.querySelector('.conversation-sessions-item-active .conversation-sessions-item-more'));
		assert.ok(view.element.querySelector('.conversation-sessions-item-icon--waiting, .conversation-sessions-item-icon--idle, .conversation-sessions-item-icon--running, .conversation-sessions-item-icon--failed'));
	});

	function paintedColor(...layers: string[]): Color {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 1;
		const context = canvas.getContext('2d')!;
		for (const layer of layers) {
			context.fillStyle = layer;
			context.fillRect(0, 0, 1, 1);
		}
		const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
		return new Color(new RGBA(r, g, b, a / 255));
	}

	const rosterThemes = [
		{ name: 'Light+', selector: 'vs', colors: {} },
		{ name: 'UniverseAgentStudio Light', selector: 'vs', colors: COLOR_THEME_LIGHT_INITIAL_COLORS },
		{ name: 'UniverseAgentStudio Dark', selector: 'vs-dark', colors: COLOR_THEME_DARK_INITIAL_COLORS },
		{ name: 'High Contrast Dark', selector: 'hc-black', colors: {} },
		{ name: 'High Contrast Light', selector: 'hc-light', colors: {} },
	];

	for (const theme of rosterThemes) {
		test(`${theme.name}: selected session text follows the real list across focus changes`, async function () {
			// The Electron unit runner keeps its BrowserWindow hidden. These CSS
			// focus checks run in the browser runner with an actually focused page.
			const testWindow = getWindow(document.body);
			testWindow.focus();
			await timeout(0);
			if (!testWindow.document.hasFocus()) {
				this.skip();
			}

			const stylesheet = document.createElement('link');
			stylesheet.rel = 'stylesheet';
			stylesheet.href = new URL('./media/conversationSessions.css', import.meta.url).href;
			store.add(toDisposable(() => stylesheet.remove()));
			await new Promise<void>((resolve, reject) => {
				stylesheet.onload = () => resolve();
				stylesheet.onerror = () => reject(new Error('Session roster stylesheet failed to load'));
				document.head.appendChild(stylesheet);
			});

			// Resolve the platform defaults and the actual product palettes, rather
			// than painting a hand-made selected background over a fake list row.
			const colorTheme = ColorThemeData.createLoadedEmptyTheme(theme.selector, theme.name);
			colorTheme.setCustomColors(theme.colors);
			const workbench = document.createElement('div');
			const ownerDocument = getWindow(workbench).document;
			workbench.className = `monaco-workbench ${theme.selector}`;
			for (const { id } of getColorRegistry().getColors()) {
				const color = colorTheme.getColor(id);
				workbench.style.setProperty(asCssVariableName(id), color?.toString() ?? 'initial');
			}
			workbench.style.color = 'var(--vscode-foreground)';
			workbench.style.backgroundColor = 'var(--vscode-sideBar-background)';
			workbench.style.width = '300px';
			document.body.appendChild(workbench);
			store.add(toDisposable(() => workbench.remove()));

			const { view, stubService } = mountView();
			const session = stubService.createSession();
			stubService.renameSession(session, 'Selected session');
			workbench.appendChild(view.element);
			const outsideInput = document.createElement('textarea');
			outsideInput.setAttribute('aria-label', 'Message');
			workbench.appendChild(outsideInput);
			view.orthogonalSize = 300;
			view.layout(240);

			const list = view.element.querySelector<HTMLElement>('.conversation-sessions-list .monaco-list')!;
			const selectedRow = view.element.querySelector<HTMLElement>('.monaco-list-row.selected')!;
			const label = selectedRow.querySelector<HTMLElement>('.conversation-sessions-item-label')!;
			const subtitle = selectedRow.querySelector<HTMLElement>('.conversation-sessions-item-subtitle')!;
			const idleIcon = selectedRow.querySelector<HTMLElement>('.conversation-sessions-item-icon--idle')!;
			assert.ok(list && selectedRow && label && subtitle && idleIcon);

			for (const focused of [true, false, true]) {
				getWindow(workbench).focus();
				(focused ? list : outsideInput).focus();
				await timeout(0);
				assert.deepStrictEqual({ documentFocus: ownerDocument.hasFocus(), listFocus: list.matches(':focus') }, {
					documentFocus: true, listFocus: focused,
				}, `${theme.name}: the test window must have native focus before measuring list styles`);
				assert.strictEqual(ownerDocument.activeElement, focused ? list : outsideInput);
				const rowStyle = getWindow(selectedRow).getComputedStyle(selectedRow);
				const background = paintedColor(
					colorTheme.getColor('sideBar.background')!.toString(), rowStyle.backgroundColor,
				);
				const rowColor = paintedColor(rowStyle.color).toString();
				const colorContext = {
					theme: theme.name, focused,
					foreground: rowStyle.color, background: rowStyle.backgroundColor,
				};
				const colors = [label, subtitle, idleIcon].map(element => {
					const foreground = paintedColor(getWindow(element).getComputedStyle(element).color);
					const contrast = foreground.getContrastRatio(background);
					assert.ok(contrast >= 4.5, `${theme.name} ${focused ? 'active' : 'inactive'} ${element.className}: ${contrast.toFixed(2)}:1 ${JSON.stringify(colorContext)}`);
					return foreground.toString();
				});
				const iconColor = colorTheme.getColor(`list.${focused ? 'activeSelection' : 'inactiveSelection'}IconForeground`);
				assert.deepStrictEqual(colors, [rowColor, rowColor, iconColor?.toString() ?? rowColor], JSON.stringify(colorContext));
				if (focused) {
					assert.deepStrictEqual({
						focused: selectedRow.classList.contains('focused'),
						outlineVisible: !['none', 'hidden'].includes(rowStyle.outlineStyle)
							&& parseFloat(rowStyle.outlineWidth) > 0
							&& paintedColor(rowStyle.outlineColor).getContrastRatio(background) > 1,
					}, { focused: true, outlineVisible: true }, JSON.stringify(colorContext));
				}
			}
		});
	}
});
