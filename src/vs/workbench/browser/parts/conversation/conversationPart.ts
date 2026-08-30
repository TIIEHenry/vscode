/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationPart.css';
import { $, append } from '../../../../base/browser/dom.js';
import { LayoutPriority } from '../../../../base/browser/ui/splitview/splitview.js';
import { localize } from '../../../../nls.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { Part } from '../../part.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';

export const IConversationPartService = createDecorator<IConversationPartService>('conversationPartService');

export interface IConversationPartService {
	readonly _serviceBrand: undefined;

	focus(): void;
}

/**
 * Center workbench part for the Agent IDE shell. Placeholder chrome only in M0:
 * no engine wiring. Files continue to open in {@link Parts.EDITOR_PART}.
 */
export class ConversationPart extends Part implements IConversationPartService {

	declare readonly _serviceBrand: undefined;

	//#region IView

	readonly minimumWidth: number = 300;
	readonly maximumWidth: number = Number.POSITIVE_INFINITY;
	readonly minimumHeight: number = 0;
	readonly maximumHeight: number = Number.POSITIVE_INFINITY;
	get snap(): boolean { return true; }

	readonly priority = LayoutPriority.High;

	//#endregion

	constructor(
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
	) {
		super(Parts.CONVERSATION_PART, { hasTitle: true }, themeService, storageService, layoutService);
	}

	override create(parent: HTMLElement): void {
		this.element = parent;
		parent.classList.add('conversation');
		parent.tabIndex = 0;

		super.create(parent);
	}

	protected override createTitleArea(parent: HTMLElement): HTMLElement {
		const titleArea = append(parent, $('.title'));
		const titleLabel = append(titleArea, $('.title-label'));
		const heading = append(titleLabel, $('h2'));
		heading.textContent = localize('conversationPart.title', "Conversation");

		return titleArea;
	}

	protected override createContentArea(parent: HTMLElement): HTMLElement {
		const content = append(parent, $('.content'));

		const timeline = append(content, $('.conversation-timeline'));
		timeline.textContent = localize('conversationPart.timelinePlaceholder', "Conversation timeline");

		const dock = append(content, $('.conversation-dock'));
		const dockInput = append(dock, $('.conversation-dock-input'));
		dockInput.textContent = localize('conversationPart.dockPlaceholder', "Ask anything…");

		return content;
	}

	override layout(width: number, height: number, top: number, left: number): void {
		if (!this.layoutService.isVisible(Parts.CONVERSATION_PART)) {
			return;
		}

		super.layout(width, height, top, left);
		this.layoutContents(width, height);
	}

	focus(): void {
		this.element?.focus();
	}

	toJSON(): object {
		return {
			type: Parts.CONVERSATION_PART
		};
	}
}

registerSingleton(IConversationPartService, ConversationPart, InstantiationType.Eager);
