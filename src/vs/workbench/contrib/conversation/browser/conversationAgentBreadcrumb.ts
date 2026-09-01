/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationAgentBreadcrumb.css';
import * as dom from '../../../../base/browser/dom.js';
import { BreadcrumbsItem, BreadcrumbsWidget } from '../../../../base/browser/ui/breadcrumbs/breadcrumbsWidget.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ScrollbarVisibility } from '../../../../base/common/scrollable.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { defaultBreadcrumbsWidgetStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IConversationAgentBreadcrumbItem } from '../common/conversationAgentHierarchy.js';

const $ = dom.$;

export const conversationAgentBreadcrumbClass = 'conversation-agent-breadcrumb';

class ConversationAgentBreadcrumbItem extends BreadcrumbsItem {

	constructor(
		readonly data: IConversationAgentBreadcrumbItem,
	) {
		super();
	}

	equals(other: BreadcrumbsItem): boolean {
		return other instanceof ConversationAgentBreadcrumbItem && other.data.chatId === this.data.chatId;
	}

	dispose(): void {
		// Nothing to dispose
	}

	render(container: HTMLElement): void {
		container.classList.add('conversation-agent-breadcrumb-item');
		if (this.data.isCurrent) {
			container.setAttribute('aria-current', 'location');
		} else {
			container.removeAttribute('aria-current');
		}
		dom.append(container, $('span.conversation-agent-breadcrumb-item-label', undefined, this.data.title));
	}
}

export class ConversationAgentBreadcrumbBox extends Disposable {

	static readonly HEIGHT = 24;

	readonly element: HTMLElement;
	private readonly breadcrumbWidget: BreadcrumbsWidget;
	private items: IConversationAgentBreadcrumbItem[] = [];

	private readonly _onDidSelect = this._register(new Emitter<string>());
	readonly onDidSelect = this._onDidSelect.event;

	constructor(parent: HTMLElement) {
		super();

		this.element = dom.append(parent, $(`.${conversationAgentBreadcrumbClass}`));
		this.element.setAttribute('role', 'navigation');
		this.element.setAttribute('aria-label', 'Agent hierarchy');

		const scrollHost = dom.append(this.element, $('.conversation-agent-breadcrumb-scroll'));
		this.breadcrumbWidget = this._register(new BreadcrumbsWidget(
			scrollHost,
			3,
			ScrollbarVisibility.Auto,
			Codicon.chevronRight,
			defaultBreadcrumbsWidgetStyles,
		));

		this._register(this.breadcrumbWidget.onDidSelectItem(e => {
			if (e.type !== 'select' || !(e.item instanceof ConversationAgentBreadcrumbItem)) {
				return;
			}

			if (e.item.data.isCurrent) {
				return;
			}

			this.breadcrumbWidget.setSelection(undefined);
			this._onDidSelect.fire(e.item.data.chatId);
		}));

		this.setItems([]);
	}

	get isVisible(): boolean {
		return this.items.length > 0;
	}

	setItems(items: IConversationAgentBreadcrumbItem[]): void {
		this.items = items;
		this.element.classList.toggle('hidden', items.length === 0);

		const widgetItems = items.map(item => new ConversationAgentBreadcrumbItem(item));
		this.breadcrumbWidget.setItems(widgetItems);
		this.breadcrumbWidget.setEnabled(items.some(item => !item.isCurrent));
	}

	layout(width: number): void {
		if (!this.isVisible) {
			return;
		}

		this.breadcrumbWidget.layout(new dom.Dimension(width, ConversationAgentBreadcrumbBox.HEIGHT));
	}
}
