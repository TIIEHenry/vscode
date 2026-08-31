/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/customizationsPreferencesPane.css';
import * as DOM from '../../../../base/browser/dom.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IPreferencesEditorPane } from '../../preferences/browser/preferencesEditorRegistry.js';

const $ = DOM.$;

export interface ICustomizationEntry {
	readonly id: string;
	readonly label: string;
}

export function getCustomizationsEmptyCopy(): string {
	return localize('ua.customizationsEmptyWelcome', "No customizations yet");
}

class CustomizationsDelegate implements IListVirtualDelegate<ICustomizationEntry> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'customizationEntry';
	}
}

interface ICustomizationsTemplateData {
	readonly label: HTMLElement;
}

class CustomizationsRenderer implements IListRenderer<ICustomizationEntry, ICustomizationsTemplateData> {
	static readonly TEMPLATE_ID = 'customizationEntry';

	readonly templateId = CustomizationsRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): ICustomizationsTemplateData {
		return { label: DOM.append(container, $('.customizations-entry-label')) };
	}

	renderElement(entry: ICustomizationEntry, _index: number, templateData: ICustomizationsTemplateData): void {
		templateData.label.textContent = entry.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class CustomizationsAccessibilityProvider implements IListAccessibilityProvider<ICustomizationEntry> {
	getWidgetAriaLabel(): string {
		return localize('ua.customizationsPaneTitle', "Customizations");
	}

	getAriaLabel(entry: ICustomizationEntry): string {
		return entry.label;
	}
}

export class CustomizationsPreferencesPane extends Disposable implements IPreferencesEditorPane {

	private readonly container: HTMLElement;
	private readonly emptyWelcome: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly list: WorkbenchList<ICustomizationEntry>;
	private entries: ICustomizationEntry[] = [];

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();

		this.container = DOM.$('.customizations-preferences-pane');
		this.container.style.padding = '24px';

		const title = DOM.append(this.container, DOM.$('h2'));
		title.textContent = localize('ua.customizationsPaneTitle', "Customizations");

		this.emptyWelcome = DOM.append(this.container, DOM.$('.customizations-empty-welcome'));
		this.emptyWelcome.textContent = getCustomizationsEmptyCopy();
		this.emptyWelcome.style.opacity = '0.8';

		this.listContainer = DOM.append(this.container, DOM.$('.customizations-list'));
		this.list = this._register(instantiationService.createInstance(
			WorkbenchList,
			'Customizations',
			this.listContainer,
			new CustomizationsDelegate(),
			[new CustomizationsRenderer()],
			{
				identityProvider: { getId: (entry: ICustomizationEntry) => entry.id },
				accessibilityProvider: new CustomizationsAccessibilityProvider(),
			}
		)) as WorkbenchList<ICustomizationEntry>;

		this.setEntries([]);
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	layout(dimension: DOM.Dimension): void {
		this.container.style.height = `${dimension.height}px`;
		const listHeight = Math.max(0, dimension.height - 72);
		this.list.layout(listHeight, dimension.width - 48);
	}

	search(_text: string): void {
		// Header search disabled for this pane family.
	}

	private setEntries(entries: ICustomizationEntry[]): void {
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
