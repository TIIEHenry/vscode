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
import { getEngineSectionDisconnectedCopy } from './engineSectionChrome.js';
import {
	ENGINE_PREFERENCES_NAV_ENTRIES,
	type EnginePreferencesSectionId,
	getEnginePreferencesSectionLabel,
} from './enginePreferencesTypes.js';

const $ = DOM.$;

/** Honest Test Engine result — no engine probe, no fake success. */
export function getEngineTestStatusText(): string {
	return localize('ua.engineTestNotConnected', "Not connected — no engine.");
}

export function getEngineEmptyCopy(): string {
	return localize('ua.engineEmptyWelcome', "No engines yet");
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
	private readonly emptyWelcome: HTMLElement;
	private readonly navList: WorkbenchList<typeof ENGINE_PREFERENCES_NAV_ENTRIES[number]>;
	private readonly detailTitle: HTMLElement;
	private readonly detailBody: HTMLElement;
	private readonly testStatus: HTMLElement;

	private readonly disconnectedCopy: HTMLElement;
	private readonly disconnectedActions: HTMLElement;

	private readonly sections = new Map<EnginePreferencesSectionId, IEngineSectionHost & Disposable>();
	private activeSectionId: EnginePreferencesSectionId = 'overview';
	private lastLayoutWidth = 480;
	private lastLayoutHeight = 480;

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
			this.testStatus.textContent = this.connectionService.isEngineConnected()
				? localize('ua.engineTestConnected', "Engine is connected.")
				: getEngineTestStatusText();
		}));

		this.disconnectedBanner = DOM.append(this.container, $('.engine-preferences-disconnected-banner'));
		this.disconnectedBanner.style.display = 'none';
		this.disconnectedCopy = DOM.append(this.disconnectedBanner, $('.engine-preferences-disconnected-copy'));
		this.disconnectedActions = DOM.append(this.disconnectedBanner, $('.engine-preferences-disconnected-actions'));
		const bannerTestButton = this._register(new Button(this.disconnectedActions, defaultButtonStyles));
		bannerTestButton.label = localize('ua.engineTest', "Test Engine");
		this._register(bannerTestButton.onDidClick(() => {
			this.testStatus.textContent = getEngineTestStatusText();
		}));
		const bannerOpenConnection = this._register(new Button(this.disconnectedActions, defaultButtonStyles));
		bannerOpenConnection.label = localize('ua.engineOpenConnection', "Open Connection");
		this._register(bannerOpenConnection.onDidClick(() => {
			void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
		}));

		this.emptyWelcome = DOM.append(this.container, $('.engine-empty-welcome'));
		this.emptyWelcome.textContent = getEngineEmptyCopy();
		this.emptyWelcome.style.display = 'none';

		const body = DOM.append(this.container, $('.engine-preferences-body'));
		const navHost = DOM.append(body, $('.engine-preferences-nav'));
		navHost.setAttribute('role', 'navigation');
		navHost.setAttribute('aria-label', localize('ua.enginePreferencesNavHost', "Engine preferences sections"));
		this.navList = this._register(instantiationService.createInstance(
			WorkbenchList,
			'EnginePreferencesNav',
			navHost,
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

		const detail = DOM.append(body, $('.engine-preferences-detail'));
		this.detailTitle = DOM.append(detail, $('h3.engine-preferences-detail-title'));
		this.detailBody = DOM.append(detail, $('.engine-preferences-detail-body'));

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

	private selectSection(id: EnginePreferencesSectionId): void {
		this.activeSectionId = id;
		this.detailTitle.textContent = getEnginePreferencesSectionLabel(id);
		for (const [sectionId, section] of this.sections) {
			const active = sectionId === id;
			section.setSectionActive(active);
			section.setShowSectionHeading(false);
		}
		const active = this.sections.get(id);
		active?.layout(this.getDetailWidth(), this.getDetailHeight());
	}

	private getDetailWidth(): number {
		if (this.lastLayoutWidth < 640) {
			return Math.max(240, this.lastLayoutWidth - 48);
		}
		return Math.max(240, this.lastLayoutWidth - 220 - 48);
	}

	private getDetailHeight(): number {
		return Math.max(160, this.lastLayoutHeight - 160);
	}

	private updateDisconnectedBanner(): void {
		const disconnected = !this.connectionService.isEngineConnected();
		this.disconnectedBanner.style.display = disconnected ? '' : 'none';
		this.emptyWelcome.style.display = disconnected ? '' : 'none';
		if (disconnected) {
			this.disconnectedCopy.textContent = getEngineSectionDisconnectedCopy();
		}
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	layout(dimension: DOM.Dimension): void {
		this.container.style.height = `${dimension.height}px`;
		this.lastLayoutWidth = dimension.width;
		this.lastLayoutHeight = dimension.height;
		const narrow = dimension.width < 640;
		this.container.classList.toggle('engine-preferences-pane--narrow', narrow);
		const navHeight = narrow
			? Math.min(ENGINE_PREFERENCES_NAV_ENTRIES.length * 28 + 8, Math.max(120, dimension.height - 160))
			: Math.max(120, dimension.height - 120);
		const navWidth = narrow ? Math.max(200, dimension.width - 40) : 200;
		this.navList.layout(navHeight, navWidth);
		const active = this.sections.get(this.activeSectionId);
		active?.layout(this.getDetailWidth(), this.getDetailHeight());
	}

	search(_text: string): void {
		// Header search disabled for this pane family.
	}
}
