/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/explorerLocationBreadcrumb.css';
import * as dom from '../../../../base/browser/dom.js';
import { BreadcrumbsItem, BreadcrumbsWidget } from '../../../../base/browser/ui/breadcrumbs/breadcrumbsWidget.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ScrollbarVisibility } from '../../../../base/common/scrollable.js';
import { defaultBreadcrumbsWidgetStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { EXPLORER_LOCATION_ROOT_ID, IExplorerLocationBreadcrumbItem } from '../common/explorerLocationBreadcrumb.js';

const $ = dom.$;

class ExplorerLocationBreadcrumbItem extends BreadcrumbsItem {

	constructor(
		readonly data: IExplorerLocationBreadcrumbItem,
	) {
		super();
	}

	equals(other: BreadcrumbsItem): boolean {
		return other instanceof ExplorerLocationBreadcrumbItem && other.data.id === this.data.id;
	}

	dispose(): void {
		// Nothing to dispose
	}

	render(container: HTMLElement): void {
		container.classList.add('explorer-location-breadcrumb-item');
		dom.append(container, $('span.explorer-location-breadcrumb-item-label', undefined, this.data.label));
	}
}

export class ExplorerLocationBreadcrumbBox extends Disposable {

	static readonly HEIGHT = 28;

	readonly element: HTMLElement;
	private readonly breadcrumbContainer: HTMLElement;
	private readonly breadcrumbWidget: BreadcrumbsWidget;
	private breadcrumbItems: IExplorerLocationBreadcrumbItem[] = [];

	private readonly _onDidSelect = this._register(new Emitter<string>());
	readonly onDidSelect = this._onDidSelect.event;

	constructor(parent: HTMLElement) {
		super();

		this.element = dom.append(parent, $('.explorer-location-breadcrumb'));
		const icon = dom.append(this.element, $('.explorer-location-breadcrumb-icon'));
		icon.appendChild(renderIcon(Codicon.home));

		this.breadcrumbContainer = dom.append(this.element, $('.explorer-location-breadcrumb-scroll'));
		this.breadcrumbWidget = this._register(new BreadcrumbsWidget(
			this.breadcrumbContainer,
			3,
			ScrollbarVisibility.Auto,
			Codicon.chevronRight,
			defaultBreadcrumbsWidgetStyles,
		));

		this._register(this.breadcrumbWidget.onDidSelectItem(e => {
			if (e.type !== 'select' || !(e.item instanceof ExplorerLocationBreadcrumbItem)) {
				return;
			}

			this.breadcrumbWidget.setSelection(undefined);
			this._onDidSelect.fire(e.item.data.id);
		}));

		this.setItems([]);
	}

	get isVisible(): boolean {
		return this.breadcrumbItems.length > 0;
	}

	setItems(items: IExplorerLocationBreadcrumbItem[]): void {
		this.breadcrumbItems = items;
		this.element.classList.toggle('hidden', items.length === 0);

		const widgetItems = items.map(item => new ExplorerLocationBreadcrumbItem(item));
		this.breadcrumbWidget.setItems(widgetItems);
		this.breadcrumbWidget.setEnabled(items.length > 0);
	}

	layout(width: number): void {
		if (!this.isVisible) {
			return;
		}

		this.breadcrumbWidget.layout(new dom.Dimension(width - ExplorerLocationBreadcrumbBox.HEIGHT, ExplorerLocationBreadcrumbBox.HEIGHT));
	}
}

export { EXPLORER_LOCATION_ROOT_ID };
