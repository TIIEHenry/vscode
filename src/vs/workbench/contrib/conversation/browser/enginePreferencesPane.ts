/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/enginePreferencesPane.css';
import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import type { IPreferencesEditorPane } from '../../preferences/browser/preferencesEditorRegistry.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';
import { EngineAgentsSection } from './engineAgentsSection.js';
import { EngineHooksSection } from './engineHooksSection.js';
import { EngineMcpSection } from './engineMcpSection.js';
import { EngineOverviewSection } from './engineOverviewSection.js';
import { EnginePluginsSection } from './enginePluginsSection.js';
import { EngineProviderModelSection } from './engineProviderModelSection.js';
import { EngineRulesSection } from './engineRulesSection.js';
import { EngineSkillsSection } from './engineSkillsSection.js';
import { EngineToolsSection } from './engineToolsSection.js';
import { getConnectionPhaseStatusBarText } from './conversationSessionStatus.js';
import {
	PREFERENCES_PANE_COMPACT_WIDTH,
	PREFERENCES_PANE_NARROW_WIDTH,
	shouldDrawDesktopConnectionControls,
} from './engineSectionChrome.js';
import {
	ENGINE_PREFERENCES_NAV_ENTRIES,
	type EnginePreferencesSectionId,
	getEnginePreferencesSectionLabel,
} from './enginePreferencesTypes.js';
import type { ConnectionPhase } from '../../../../platform/universeAgent/common/connectionHubTypes.js';

const $ = DOM.$;

/** Test Engine 结果与 StatusBar / Connection 共用 H4b 文案。 */
export function getEngineTestStatusText(phase?: ConnectionPhase, pairingPending = false): string {
	return getConnectionPhaseStatusBarText(phase ?? { kind: 'disconnected' }, pairingPending);
}

interface IEngineSectionHost {
	setSectionActive(active: boolean): void;
	setShowSectionHeading(show: boolean): void;
	layout(width: number, height: number): void;
	getDomNode(): HTMLElement;
}

class EngineNavDelegate implements IListVirtualDelegate<typeof ENGINE_PREFERENCES_NAV_ENTRIES[number]> {
	getHeight(): number {
		return 28;
	}

	getTemplateId(): string {
		return 'engineNav';
	}
}

interface IEngineNavTemplateData {
	readonly label: HTMLElement;
}

class EngineNavRenderer implements IListRenderer<typeof ENGINE_PREFERENCES_NAV_ENTRIES[number], IEngineNavTemplateData> {
	static readonly TEMPLATE_ID = 'engineNav';
	readonly templateId = EngineNavRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IEngineNavTemplateData {
		container.classList.add('engine-preferences-nav-row');
		return { label: DOM.append(container, $('.engine-preferences-nav-label')) };
	}

	renderElement(entry: typeof ENGINE_PREFERENCES_NAV_ENTRIES[number], _index: number, templateData: IEngineNavTemplateData): void {
		templateData.label.textContent = entry.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class EngineNavAccessibilityProvider implements IListAccessibilityProvider<typeof ENGINE_PREFERENCES_NAV_ENTRIES[number]> {
	getWidgetAriaLabel(): string {
		return localize('ua.enginePreferencesNav', "Engine preferences sections");
	}

	getAriaLabel(entry: typeof ENGINE_PREFERENCES_NAV_ENTRIES[number]): string {
		return entry.label;
	}
}

export class EnginePreferencesPane extends Disposable implements IPreferencesEditorPane {

	private readonly container: HTMLElement;
	private readonly disconnectedBanner: HTMLElement;
	private readonly navHost: HTMLElement;
	private readonly navList: WorkbenchList<typeof ENGINE_PREFERENCES_NAV_ENTRIES[number]>;
	private readonly detail: HTMLElement;
	private readonly backButton: HTMLButtonElement;
	private readonly detailTitle: HTMLElement;
	private readonly detailBody: HTMLElement;
	private readonly testStatus: HTMLElement;

	private readonly disconnectedCopy: HTMLElement;
	private readonly disconnectedActions: HTMLElement;

	private readonly sections = new Map<EnginePreferencesSectionId, IEngineSectionHost & Disposable>();
	private activeSectionId: EnginePreferencesSectionId = 'overview';
	private lastLayoutWidth = 900;
	private lastLayoutHeight = 480;
	private narrowShowingDetail = false;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IUniverseAgentConnection private readonly connectionService: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = $('.engine-preferences-pane');

		const title = DOM.append(this.container, $('h2.engine-preferences-title'));
		title.textContent = localize('ua.enginePaneTitle', "Engine");

		const testRow = DOM.append(this.container, $('.engine-test-row'));
		const testButton = this._register(new Button(testRow, defaultButtonStyles));
		testButton.label = localize('ua.engineTest', "Test Engine");
		this.testStatus = DOM.append(testRow, $('.engine-test-status'));
		this.testStatus.setAttribute('role', 'status');
		this.testStatus.setAttribute('aria-live', 'polite');
		this._register(testButton.onDidClick(() => {
			this.testStatus.textContent = getEngineTestStatusText(
				this.connectionService.getConnectionPhase(),
				this.connectionService.getConnectionSnapshot().pairingPending,
			);
		}));
		if (!shouldDrawDesktopConnectionControls()) {
			testRow.style.display = 'none';
		}

		this.disconnectedBanner = DOM.append(this.container, $('.engine-preferences-disconnected-banner'));
		this.disconnectedBanner.style.display = 'none';
		this.disconnectedCopy = DOM.append(this.disconnectedBanner, $('.engine-preferences-disconnected-copy'));
		this.disconnectedActions = DOM.append(this.disconnectedBanner, $('.engine-preferences-disconnected-actions'));
		if (shouldDrawDesktopConnectionControls()) {
			const bannerTestButton = this._register(new Button(this.disconnectedActions, defaultButtonStyles));
			bannerTestButton.label = localize('ua.engineTest', "Test Engine");
			this._register(bannerTestButton.onDidClick(() => {
				this.testStatus.textContent = getEngineTestStatusText(
					this.connectionService.getConnectionPhase(),
					this.connectionService.getConnectionSnapshot().pairingPending,
				);
			}));
		}
		const bannerOpenConnection = this._register(new Button(this.disconnectedActions, defaultButtonStyles));
		bannerOpenConnection.label = localize('ua.engineOpenConnection', "Open Connection");
		this._register(bannerOpenConnection.onDidClick(() => {
			void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
		}));

		const body = DOM.append(this.container, $('.engine-preferences-body'));
		this.navHost = DOM.append(body, $('.engine-preferences-nav'));
		this.navHost.setAttribute('role', 'navigation');
		this.navHost.setAttribute('aria-label', localize('ua.enginePreferencesNavHost', "Engine preferences sections"));
		this.navList = this._register(instantiationService.createInstance(
			WorkbenchList,
			'EnginePreferencesNav',
			this.navHost,
			new EngineNavDelegate(),
			[new EngineNavRenderer()],
			{
				identityProvider: { getId: (entry: typeof ENGINE_PREFERENCES_NAV_ENTRIES[number]) => entry.id },
				accessibilityProvider: new EngineNavAccessibilityProvider(),
				keyboardNavigationLabelProvider: { getKeyboardNavigationLabel: (entry: typeof ENGINE_PREFERENCES_NAV_ENTRIES[number]) => entry.label },
				keyboardSupport: true,
				multipleSelectionSupport: false,
				openOnSingleClick: true,
			},
		)) as WorkbenchList<typeof ENGINE_PREFERENCES_NAV_ENTRIES[number]>;
		this.navList.splice(0, 0, [...ENGINE_PREFERENCES_NAV_ENTRIES]);

		this.detail = DOM.append(body, $('.engine-preferences-detail'));
		const detailHeader = DOM.append(this.detail, $('.engine-preferences-detail-header'));
		this.backButton = DOM.append(detailHeader, $('button.engine-preferences-back')) as HTMLButtonElement;
		this.backButton.type = 'button';
		this.backButton.textContent = localize('ua.enginePreferencesBack', "Back");
		this.backButton.setAttribute('aria-label', localize('ua.enginePreferencesBackAria', "Back to Engine sections"));
		this.backButton.hidden = true;
		this._register(DOM.addDisposableListener(this.backButton, 'click', () => this.showNarrowNav()));
		this.detailTitle = DOM.append(detailHeader, $('h3.engine-preferences-detail-title'));
		this.detailBody = DOM.append(this.detail, $('.engine-preferences-detail-body'));

		this.registerSection('overview', this._register(instantiationService.createInstance(EngineOverviewSection, this.detailBody)));
		this.registerSection('providerModel', this._register(instantiationService.createInstance(EngineProviderModelSection, this.detailBody)));
		this.registerSection('skills', this._register(instantiationService.createInstance(EngineSkillsSection, this.detailBody)));
		this.registerSection('agents', this._register(instantiationService.createInstance(EngineAgentsSection, this.detailBody)));
		this.registerSection('rules', this._register(instantiationService.createInstance(EngineRulesSection, this.detailBody)));
		this.registerSection('hooks', this._register(instantiationService.createInstance(EngineHooksSection, this.detailBody)));
		this.registerSection('mcpServers', this._register(instantiationService.createInstance(EngineMcpSection, this.detailBody)));
		this.registerSection('plugins', this._register(instantiationService.createInstance(EnginePluginsSection, this.detailBody)));
		this.registerSection('tools', this._register(instantiationService.createInstance(EngineToolsSection, this.detailBody)));

		this._register(this.navList.onDidChangeFocus(e => {
			const entry = e.elements[0] as typeof ENGINE_PREFERENCES_NAV_ENTRIES[number] | undefined;
			if (!entry) {
				return;
			}
			const index = ENGINE_PREFERENCES_NAV_ENTRIES.findIndex(item => item.id === entry.id);
			if (index >= 0 && this.navList.getSelection()[0] !== index) {
				this.navList.setSelection([index]);
			}
			this.selectSection(entry.id);
		}));
		this._register(this.navList.onDidChangeSelection(e => {
			const entry = e.elements[0] as typeof ENGINE_PREFERENCES_NAV_ENTRIES[number] | undefined;
			if (entry) {
				this.selectSection(entry.id);
			}
		}));
		this._register(this.navList.onDidOpen(e => {
			if (e.element) {
				this.selectSection((e.element as typeof ENGINE_PREFERENCES_NAV_ENTRIES[number]).id);
			}
		}));

		this._register(this.connectionService.onDidChangeConnection(() => {
			this.updateDisconnectedBanner();
		}));

		this.navList.setFocus([0]);
		this.navList.setSelection([0]);
		this.selectSection('overview');
		this.updateDisconnectedBanner();
	}

	private registerSection(id: EnginePreferencesSectionId, section: IEngineSectionHost & Disposable): void {
		this.sections.set(id, section);
	}

	selectSection(id: EnginePreferencesSectionId): void {
		this.activeSectionId = id;
		this.detailTitle.textContent = getEnginePreferencesSectionLabel(id);
		for (const [sectionId, section] of this.sections) {
			const active = sectionId === id;
			section.setSectionActive(active);
			section.setShowSectionHeading(false);
		}
		if (this.lastLayoutWidth < PREFERENCES_PANE_NARROW_WIDTH) {
			this.narrowShowingDetail = true;
			this.applyNarrowChrome();
		}
		const active = this.sections.get(id);
		active?.layout(this.getDetailWidth(), this.getDetailHeight());
	}

	private showNarrowNav(): void {
		this.narrowShowingDetail = false;
		this.applyNarrowChrome();
		this.navList.layout(this.getNavHeight(this.lastLayoutHeight), this.getNavWidth(this.lastLayoutWidth));
		this.navList.domFocus();
	}

	private applyNarrowChrome(): void {
		const narrow = this.lastLayoutWidth < PREFERENCES_PANE_NARROW_WIDTH;
		const compact = this.lastLayoutWidth < PREFERENCES_PANE_COMPACT_WIDTH;
		this.container.classList.toggle('is-narrow', narrow);
		this.container.classList.toggle('is-compact', compact);
		this.container.classList.toggle('is-showing-detail', narrow && this.narrowShowingDetail);
		this.backButton.hidden = !(narrow && this.narrowShowingDetail);
	}

	private getNavWidth(paneWidth: number): number {
		return paneWidth < PREFERENCES_PANE_NARROW_WIDTH
			? Math.max(0, paneWidth - 40)
			: 200;
	}

	private getNavHeight(paneHeight: number): number {
		const narrow = this.lastLayoutWidth < PREFERENCES_PANE_NARROW_WIDTH;
		if (narrow && !this.narrowShowingDetail) {
			return Math.max(120, paneHeight - 120);
		}
		return narrow
			? Math.min(ENGINE_PREFERENCES_NAV_ENTRIES.length * 28 + 8, Math.max(120, paneHeight - 160))
			: Math.max(120, paneHeight - 120);
	}

	private getDetailWidth(): number {
		if (this.lastLayoutWidth < PREFERENCES_PANE_NARROW_WIDTH) {
			return Math.max(0, this.lastLayoutWidth - 48);
		}
		return Math.max(240, this.lastLayoutWidth - 220 - 48);
	}

	private getDetailHeight(): number {
		return Math.max(160, this.lastLayoutHeight - 160);
	}

	private updateDisconnectedBanner(): void {
		const disconnected = !this.connectionService.isEngineConnected();
		this.disconnectedBanner.style.display = disconnected ? '' : 'none';
		if (disconnected) {
			this.disconnectedCopy.textContent = getConnectionPhaseStatusBarText(
				this.connectionService.getConnectionPhase(),
				this.connectionService.getConnectionSnapshot().pairingPending,
			);
		}
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	layout(dimension: DOM.Dimension): void {
		this.container.style.height = `${dimension.height}px`;
		const wasWide = this.lastLayoutWidth >= PREFERENCES_PANE_NARROW_WIDTH;
		this.lastLayoutWidth = dimension.width;
		this.lastLayoutHeight = dimension.height;
		if (dimension.width >= PREFERENCES_PANE_NARROW_WIDTH) {
			this.narrowShowingDetail = false;
		} else if (wasWide) {
			this.narrowShowingDetail = true;
		}
		this.applyNarrowChrome();
		this.navList.layout(this.getNavHeight(dimension.height), this.getNavWidth(dimension.width));
		const active = this.sections.get(this.activeSectionId);
		active?.layout(this.getDetailWidth(), this.getDetailHeight());
	}

	search(_text: string): void {
		// Header search disabled for this pane family.
	}
}
