/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/connectionPreferencesPane.css';
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

export interface IConnectionProfileEntry {
	readonly id: string;
	readonly label: string;
}

/** Honest Test Connection result — no engine probe, no fake success. */
export function getConnectionTestStatusText(): string {
	return localize('ua.connectionTestNotConnected', "Not connected — no engine.");
}

export function getConnectionEmptyCopy(): string {
	return localize('ua.connectionEmptyWelcome', "No connection profiles yet");
}

class ConnectionProfilesDelegate implements IListVirtualDelegate<IConnectionProfileEntry> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'connectionProfileEntry';
	}
}

interface IConnectionProfileTemplateData {
	readonly label: HTMLElement;
}

class ConnectionProfilesRenderer implements IListRenderer<IConnectionProfileEntry, IConnectionProfileTemplateData> {
	static readonly TEMPLATE_ID = 'connectionProfileEntry';

	readonly templateId = ConnectionProfilesRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IConnectionProfileTemplateData {
		return { label: DOM.append(container, $('.connection-profile-label')) };
	}

	renderElement(entry: IConnectionProfileEntry, _index: number, templateData: IConnectionProfileTemplateData): void {
		templateData.label.textContent = entry.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class ConnectionProfilesAccessibilityProvider implements IListAccessibilityProvider<IConnectionProfileEntry> {
	getWidgetAriaLabel(): string {
		return localize('ua.connectionPaneTitle', "Connection");
	}

	getAriaLabel(entry: IConnectionProfileEntry): string {
		return entry.label;
	}
}

export class ConnectionPreferencesPane extends Disposable implements IPreferencesEditorPane {

	private readonly container: HTMLElement;
	private readonly emptyWelcome: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly list: WorkbenchList<IConnectionProfileEntry>;
	private entries: IConnectionProfileEntry[] = [];

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();

		this.container = DOM.$('.connection-preferences-pane');
		this.container.style.padding = '24px';

		const title = DOM.append(this.container, DOM.$('h2'));
		title.textContent = localize('ua.connectionPaneTitle', "Connection");

		this.emptyWelcome = DOM.append(this.container, DOM.$('.connection-empty-welcome'));
		this.emptyWelcome.textContent = getConnectionEmptyCopy();
		this.emptyWelcome.style.opacity = '0.8';

		this.listContainer = DOM.append(this.container, DOM.$('.connection-list'));
		this.list = this._register(instantiationService.createInstance(
			WorkbenchList,
			'ConnectionProfiles',
			this.listContainer,
			new ConnectionProfilesDelegate(),
			[new ConnectionProfilesRenderer()],
			{
				identityProvider: { getId: (entry: IConnectionProfileEntry) => entry.id },
				accessibilityProvider: new ConnectionProfilesAccessibilityProvider(),
			}
		)) as WorkbenchList<IConnectionProfileEntry>;

		const testRow = DOM.append(this.container, DOM.$('.connection-test-row'));
		const testButton = this._register(new Button(testRow, defaultButtonStyles));
		testButton.label = localize('ua.connectionTest', "Test Connection");
		const testStatus = DOM.append(testRow, DOM.$('.connection-test-status'));
		testStatus.setAttribute('role', 'status');
		testStatus.setAttribute('aria-live', 'polite');
		this._register(testButton.onDidClick(() => {
			testStatus.textContent = getConnectionTestStatusText();
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

	private setEntries(entries: IConnectionProfileEntry[]): void {
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
