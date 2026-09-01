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
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IPreferencesEditorPane } from '../../preferences/browser/preferencesEditorRegistry.js';

const $ = DOM.$;

export interface IEngineEntry {
	readonly id: string;
	readonly label: string;
}

/** Honest Test Engine result — no engine probe, no fake success. */
export function getEngineTestStatusText(): string {
	return localize('ua.engineTestNotConnected', "Not connected — no engine.");
}

export function getEngineEmptyCopy(): string {
	return localize('ua.engineEmptyWelcome', "No engines yet");
}

class EngineEntriesDelegate implements IListVirtualDelegate<IEngineEntry> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'engineEntry';
	}
}

interface IEngineEntryTemplateData {
	readonly label: HTMLElement;
}

class EngineEntriesRenderer implements IListRenderer<IEngineEntry, IEngineEntryTemplateData> {
	static readonly TEMPLATE_ID = 'engineEntry';

	readonly templateId = EngineEntriesRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IEngineEntryTemplateData {
		return { label: DOM.append(container, $('.engine-entry-label')) };
	}

	renderElement(entry: IEngineEntry, _index: number, templateData: IEngineEntryTemplateData): void {
		templateData.label.textContent = entry.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class EngineEntriesAccessibilityProvider implements IListAccessibilityProvider<IEngineEntry> {
	getWidgetAriaLabel(): string {
		return localize('ua.enginePaneTitle', "Engine");
	}

	getAriaLabel(entry: IEngineEntry): string {
		return entry.label;
	}
}

export class EnginePreferencesPane extends Disposable implements IPreferencesEditorPane {

	private readonly container: HTMLElement;
	private readonly emptyWelcome: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly list: WorkbenchList<IEngineEntry>;
	private entries: IEngineEntry[] = [];

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();

		this.container = DOM.$('.engine-preferences-pane');
		this.container.style.padding = '24px';

		const title = DOM.append(this.container, DOM.$('h2'));
		title.textContent = localize('ua.enginePaneTitle', "Engine");

		this.emptyWelcome = DOM.append(this.container, DOM.$('.engine-empty-welcome'));
		this.emptyWelcome.textContent = getEngineEmptyCopy();
		this.emptyWelcome.style.opacity = '0.8';

		this.listContainer = DOM.append(this.container, DOM.$('.engine-list'));
		this.list = this._register(instantiationService.createInstance(
			WorkbenchList,
			'EngineEntries',
			this.listContainer,
			new EngineEntriesDelegate(),
			[new EngineEntriesRenderer()],
			{
				identityProvider: { getId: (entry: IEngineEntry) => entry.id },
				accessibilityProvider: new EngineEntriesAccessibilityProvider(),
			}
		)) as WorkbenchList<IEngineEntry>;

		const testRow = DOM.append(this.container, DOM.$('.engine-test-row'));
		const testButton = this._register(new Button(testRow, defaultButtonStyles));
		testButton.label = localize('ua.engineTest', "Test Engine");
		const testStatus = DOM.append(testRow, DOM.$('.engine-test-status'));
		testStatus.setAttribute('role', 'status');
		testStatus.setAttribute('aria-live', 'polite');
		this._register(testButton.onDidClick(() => {
			testStatus.textContent = getEngineTestStatusText();
		}));

		this.setEntries([]);
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	layout(dimension: DOM.Dimension): void {
		this.container.style.height = `${dimension.height}px`;
		const listHeight = Math.max(0, dimension.height - 120);
		this.list.layout(listHeight, dimension.width - 48);
	}

	search(_text: string): void {
		// Header search disabled for this pane family.
	}

	private setEntries(entries: IEngineEntry[]): void {
		this.entries = entries;
		this.list.splice(0, this.list.length, entries);
		this.updateEmptyState();
	}

	private updateEmptyState(): void {
		const isEmpty = this.entries.length === 0;
		this.emptyWelcome.style.display = isEmpty ? '' : 'none';
		this.listContainer.style.display = isEmpty ? 'none' : '';
	}
}
