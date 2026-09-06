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
import { ensureCapabilitySnapshot } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
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
import { EngineClipboardSection } from './engineClipboardSection.js';
import { EngineContextVariableSection } from './engineContextVariableSection.js';
import { EngineTriggersSection } from './engineTriggersSection.js';
import { getConnectionPhaseStatusBarText } from './conversationSessionStatus.js';
import {
	getUnsupportedEnvironmentCopy,
	isUnsupportedLocalEngineEnvironment,
	PREFERENCES_PANE_COMPACT_WIDTH,
	PREFERENCES_PANE_NARROW_WIDTH,
	shouldDrawDesktopConnectionControls,
} from './engineSectionChrome.js';
import {
	ENGINE_PREFERENCES_NAV_ENTRIES,
	type EnginePreferencesNavEntry,
	type EnginePreferencesSectionId,
	getEnginePreferencesSectionLabel,
} from './enginePreferencesTypes.js';
import type { ConnectionPhase } from '../../../../platform/universeAgent/common/connectionHubTypes.js';

const $ = DOM.$;

/** Scannable rhythm for twelve sections; the nav row padding in the stylesheet assumes it. */
const NAV_ROW_HEIGHT = 28;

/**
 * Mirrors `media/enginePreferencesPane.css`. Every measurement in this pane prefers the box the
 * browser actually gave the element; these values only stand in while the pane is still detached
 * and has no layout to read.
 */
const NAV_COLUMN_WIDTH = 200;
const BODY_COLUMN_GAP = 16;
const PANE_PADDING_INLINE = 20;
const PANE_PADDING_BLOCK = 16;
const COMPACT_PANE_PADDING_INLINE = 10;
const COMPACT_PANE_PADDING_BLOCK = 8;

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

class EngineNavDelegate implements IListVirtualDelegate<EnginePreferencesNavEntry> {
	getHeight(): number {
		return NAV_ROW_HEIGHT;
	}

	getTemplateId(): string {
		return 'engineNav';
	}
}

interface IEngineNavTemplateData {
	readonly label: HTMLElement;
}

class EngineNavRenderer implements IListRenderer<EnginePreferencesNavEntry, IEngineNavTemplateData> {
	static readonly TEMPLATE_ID = 'engineNav';
	readonly templateId = EngineNavRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IEngineNavTemplateData {
		container.classList.add('engine-preferences-nav-row');
		return { label: DOM.append(container, $('.engine-preferences-nav-label')) };
	}

	renderElement(entry: EnginePreferencesNavEntry, _index: number, templateData: IEngineNavTemplateData): void {
		templateData.label.textContent = entry.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class EngineNavAccessibilityProvider implements IListAccessibilityProvider<EnginePreferencesNavEntry> {
	getWidgetAriaLabel(): string {
		return localize('ua.enginePreferencesNav', "Engine preferences sections");
	}

	getAriaLabel(entry: EnginePreferencesNavEntry): string {
		return entry.label;
	}
}

export class EnginePreferencesPane extends Disposable implements IPreferencesEditorPane {

	private readonly container: HTMLElement;
	private readonly disconnectedBanner: HTMLElement;
	private readonly navHost: HTMLElement;
	private readonly navList: WorkbenchList<EnginePreferencesNavEntry>;
	private readonly detail: HTMLElement;
	private readonly detailHeader: HTMLElement;
	private readonly backButton: HTMLButtonElement;
	private readonly detailTitle: HTMLElement;
	private readonly detailBody: HTMLElement;
	private readonly testStatus: HTMLElement;

	private readonly testRow: HTMLElement;
	private readonly disconnectedCopy: HTMLElement;
	private readonly disconnectedActions: HTMLElement;
	private readonly bannerTestButton: Button;

	private readonly sections = new Map<EnginePreferencesSectionId, IEngineSectionHost & Disposable>();
	private activeSectionId: EnginePreferencesSectionId = 'overview';
	private lastLayoutWidth = 900;
	private lastLayoutHeight = 480;
	private narrowShowingDetail = false;
	private syncingNav = false;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IUniverseAgentConnection private readonly connectionService: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = $('.engine-preferences-pane');

		// The editor header tab already says "Engine"; the stylesheet keeps this heading for
		// screen readers only so the section title is what the eye lands on first.
		const title = DOM.append(this.container, $('h2.engine-preferences-title'));
		title.textContent = localize('ua.enginePaneTitle', "Engine");

		this.disconnectedBanner = DOM.append(this.container, $('.engine-preferences-disconnected-banner'));
		this.disconnectedBanner.style.display = 'none';
		// The live region is the copy alone; the recovery buttons next to it are not news.
		this.disconnectedCopy = DOM.append(this.disconnectedBanner, $('.engine-preferences-disconnected-copy'));
		this.disconnectedCopy.setAttribute('role', 'status');
		this.disconnectedCopy.setAttribute('aria-live', 'polite');
		this.disconnectedActions = DOM.append(this.disconnectedBanner, $('.engine-preferences-disconnected-actions'));
		this.bannerTestButton = this._register(new Button(this.disconnectedActions, { ...defaultButtonStyles, secondary: true }));
		this.bannerTestButton.label = localize('ua.engineTest', "Test Engine");
		this._register(this.bannerTestButton.onDidClick(() => this.runEngineTest()));
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
				identityProvider: { getId: (entry: EnginePreferencesNavEntry) => entry.id },
				accessibilityProvider: new EngineNavAccessibilityProvider(),
				keyboardNavigationLabelProvider: { getKeyboardNavigationLabel: (entry: EnginePreferencesNavEntry) => entry.label },
				keyboardSupport: true,
				multipleSelectionSupport: false,
				openOnSingleClick: true,
			},
		)) as WorkbenchList<EnginePreferencesNavEntry>;
		this.navList.splice(0, 0, [...ENGINE_PREFERENCES_NAV_ENTRIES]);

		this.detail = DOM.append(body, $('.engine-preferences-detail'));
		this.detailHeader = DOM.append(this.detail, $('.engine-preferences-detail-header'));
		this.backButton = DOM.append(this.detailHeader, $('button.engine-preferences-back')) as HTMLButtonElement;
		this.backButton.type = 'button';
		this.backButton.textContent = localize('ua.enginePreferencesBack', "Back");
		this.backButton.setAttribute('aria-label', localize('ua.enginePreferencesBackAria', "Back to Engine sections"));
		this.backButton.hidden = true;
		this._register(DOM.addDisposableListener(this.backButton, 'click', () => this.showNarrowNav()));
		this.detailTitle = DOM.append(this.detailHeader, $('h3.engine-preferences-detail-title'));
		this.detailBody = DOM.append(this.detail, $('.engine-preferences-detail-body'));

		this.registerSection('overview', this._register(instantiationService.createInstance(EngineOverviewSection, this.detailBody)));
		this.registerSection('providerModel', this._register(instantiationService.createInstance(EngineProviderModelSection, this.detailBody)));
		this.registerSection('skills', this._register(instantiationService.createInstance(EngineSkillsSection, this.detailBody)));
		this.registerSection('agents', this._register(instantiationService.createInstance(EngineAgentsSection, this.detailBody)));
		this.registerSection('rules', this._register(instantiationService.createInstance(EngineRulesSection, this.detailBody)));
		this.registerSection('hooks', this._register(instantiationService.createInstance(EngineHooksSection, this.detailBody)));
		this.registerSection('triggers', this._register(instantiationService.createInstance(EngineTriggersSection, this.detailBody)));
		this.registerSection('clipboard', this._register(instantiationService.createInstance(EngineClipboardSection, this.detailBody)));
		this.registerSection('contextVariables', this._register(instantiationService.createInstance(EngineContextVariableSection, this.detailBody)));
		this.registerSection('mcpServers', this._register(instantiationService.createInstance(EngineMcpSection, this.detailBody)));
		this.registerSection('plugins', this._register(instantiationService.createInstance(EnginePluginsSection, this.detailBody)));
		this.registerSection('tools', this._register(instantiationService.createInstance(EngineToolsSection, this.detailBody)));

		// Quiet at rest: the engine probe lives in a footer utility row under the content,
		// not above the title where it competes with whatever the user came here to read.
		this.testRow = DOM.append(this.container, $('.engine-test-row'));
		const testButton = this._register(new Button(this.testRow, { ...defaultButtonStyles, secondary: true }));
		testButton.label = localize('ua.engineTest', "Test Engine");
		this._register(testButton.onDidClick(() => this.runEngineTest()));
		this.testStatus = DOM.append(this.testRow, $('.engine-test-status'));
		this.testStatus.setAttribute('role', 'status');
		this.testStatus.setAttribute('aria-live', 'polite');

		// Arrowing through the nav previews the section; `selectSection` mirrors the choice back
		// onto the list, so all three routes converge on one selected row.
		this._register(this.navList.onDidChangeFocus(e => {
			const entry = e.elements[0];
			if (entry && !this.syncingNav) {
				this.selectSection(entry.id);
			}
		}));
		this._register(this.navList.onDidChangeSelection(e => {
			const entry = e.elements[0];
			if (entry && !this.syncingNav) {
				this.selectSection(entry.id);
			}
		}));
		this._register(this.navList.onDidOpen(e => {
			if (e.element && !this.syncingNav) {
				this.selectSection(e.element.id);
			}
		}));

		this._register(this.connectionService.onDidChangeConnection(() => {
			this.updateDisconnectedBanner();
		}));

		this.selectSection('overview');
		this.updateDisconnectedBanner();
	}

	/** Both Test Engine affordances report the same phase copy as the status bar. */
	private runEngineTest(): void {
		this.testStatus.textContent = getEngineTestStatusText(
			this.connectionService.getConnectionPhase(),
			this.connectionService.getConnectionSnapshot().pairingPending,
		);
	}

	private registerSection(id: EnginePreferencesSectionId, section: IEngineSectionHost & Disposable): void {
		this.sections.set(id, section);
	}

	selectSection(id: EnginePreferencesSectionId): void {
		this.activeSectionId = id;
		this.detailTitle.textContent = getEnginePreferencesSectionLabel(id);
		// Keep "you are here" honest when a section is selected from outside the nav list.
		const index = ENGINE_PREFERENCES_NAV_ENTRIES.findIndex(entry => entry.id === id);
		if (index >= 0 && this.navList.getSelection()[0] !== index) {
			this.syncingNav = true;
			try {
				this.navList.setSelection([index]);
				this.navList.setFocus([index]);
			} finally {
				this.syncingNav = false;
			}
		}
		for (const [sectionId, section] of this.sections) {
			const active = sectionId === id;
			section.setSectionActive(active);
			section.setShowSectionHeading(false);
		}
		if (this.isNarrow()) {
			this.narrowShowingDetail = true;
			this.applyNarrowChrome();
		}
		const active = this.sections.get(id);
		active?.layout(this.getDetailWidth(), this.getDetailHeight());
	}

	private showNarrowNav(): void {
		this.narrowShowingDetail = false;
		this.applyNarrowChrome();
		this.layoutParts();
		this.navList.domFocus();
	}

	private applyNarrowChrome(): void {
		const narrow = this.isNarrow();
		const showingDetail = narrow && this.narrowShowingDetail;
		this.container.classList.toggle('is-narrow', narrow);
		this.container.classList.toggle('is-compact', this.isCompact());
		this.container.classList.toggle('is-showing-detail', showingDetail);
		this.backButton.hidden = !showingDetail;
	}

	/** Under this width the pane collapses to a single column that swaps nav for detail. */
	private isNarrow(): boolean {
		return this.lastLayoutWidth < PREFERENCES_PANE_NARROW_WIDTH;
	}

	/** Under this width the pane also drops to the tighter padding step. */
	private isCompact(): boolean {
		return this.lastLayoutWidth < PREFERENCES_PANE_COMPACT_WIDTH;
	}

	private layoutParts(): void {
		// A hidden nav has no box to measure; it is laid out again when it comes back.
		if (!(this.isNarrow() && this.narrowShowingDetail)) {
			this.navList.layout(this.getNavHeight(), this.getNavWidth());
		}
		this.sections.get(this.activeSectionId)?.layout(this.getDetailWidth(), this.getDetailHeight());
	}

	private getNavWidth(): number {
		const measured = DOM.getContentWidth(this.navHost);
		if (measured > 0) {
			return measured;
		}
		return this.isNarrow() ? this.estimatedContentWidth() : NAV_COLUMN_WIDTH;
	}

	private getNavHeight(): number {
		const measured = DOM.getContentHeight(this.navHost);
		return measured > 0 ? measured : this.estimatedBodyHeight();
	}

	private getDetailWidth(): number {
		// `clientWidth` rather than `offsetWidth`: the detail body scrolls, and the scrollbar
		// gutter is not space a section can paint into.
		if (this.detailBody.clientWidth > 0) {
			return this.detailBody.clientWidth;
		}
		const available = this.estimatedContentWidth();
		return this.isNarrow() ? available : Math.max(0, available - NAV_COLUMN_WIDTH - BODY_COLUMN_GAP);
	}

	private getDetailHeight(): number {
		if (this.detailBody.clientHeight > 0) {
			return this.detailBody.clientHeight;
		}
		return Math.max(0, this.estimatedBodyHeight() - DOM.getTotalHeight(this.detailHeader));
	}

	/** Stand-in for the flex row that holds nav and detail, used before the pane has a layout. */
	private estimatedBodyHeight(): number {
		const paddingBlock = this.isCompact() ? COMPACT_PANE_PADDING_BLOCK : PANE_PADDING_BLOCK;
		const chrome = DOM.getTotalHeight(this.disconnectedBanner) + DOM.getTotalHeight(this.testRow);
		return Math.max(0, this.lastLayoutHeight - 2 * paddingBlock - chrome);
	}

	private estimatedContentWidth(): number {
		const paddingInline = this.isCompact() ? COMPACT_PANE_PADDING_INLINE : PANE_PADDING_INLINE;
		return Math.max(0, this.lastLayoutWidth - 2 * paddingInline);
	}

	private desktopConnectionControlContext() {
		return {
			phase: this.connectionService.getConnectionPhase(),
			snapshot: this.connectionService.getConnectionSnapshot(),
			capabilities: ensureCapabilitySnapshot(this.connectionService.getCapabilitySnapshot()),
		};
	}

	private updateDisconnectedBanner(): void {
		const context = this.desktopConnectionControlContext();
		const unsupportedEnvironment = isUnsupportedLocalEngineEnvironment(context);
		const drawDesktop = shouldDrawDesktopConnectionControls(context);
		this.testRow.style.display = drawDesktop ? '' : 'none';
		this.bannerTestButton.element.style.display = drawDesktop ? '' : 'none';

		const disconnected = !this.connectionService.isEngineConnected();
		this.disconnectedBanner.style.display = disconnected || unsupportedEnvironment ? '' : 'none';
		// Disconnected is an ordinary resting state and reads as a neutral notice; an environment
		// that cannot host an engine at all is the exception that earns the warning surface.
		this.disconnectedBanner.classList.toggle('is-warning', unsupportedEnvironment);
		if (unsupportedEnvironment) {
			this.disconnectedCopy.textContent = getUnsupportedEnvironmentCopy();
		} else if (disconnected) {
			this.disconnectedCopy.textContent = getConnectionPhaseStatusBarText(
				this.connectionService.getConnectionPhase(),
				this.connectionService.getConnectionSnapshot().pairingPending,
			);
		}
		// Showing or hiding the banner changes how much room the body has.
		this.layoutParts();
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	/** `dimension` is the leaf pane box the preferences editor hands us, not the window. */
	layout(dimension: DOM.Dimension): void {
		this.container.style.height = `${dimension.height}px`;
		const wasWide = !this.isNarrow();
		this.lastLayoutWidth = dimension.width;
		this.lastLayoutHeight = dimension.height;
		if (!this.isNarrow()) {
			this.narrowShowingDetail = false;
		} else if (wasWide) {
			this.narrowShowingDetail = true;
		}
		this.applyNarrowChrome();
		this.layoutParts();
	}

	search(_text: string): void {
		// Header search disabled for this pane family.
	}
}
