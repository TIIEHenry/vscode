/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesPart.css';
import { $, append } from '../../../../base/browser/dom.js';
import { LayoutPriority } from '../../../../base/browser/ui/splitview/splitview.js';
import { localize } from '../../../../nls.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { Part } from '../../part.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';

export const ISourcesPartService = createDecorator<ISourcesPartService>('sourcesPartService');

export interface ISourcesPartService {
	readonly _serviceBrand: undefined;

	focus(): void;
}

/**
 * End-column workbench part for the Agent IDE shell (below Preview / Editor).
 * Placeholder chrome only in M0: no SCM, no engine, no EditorInput.
 */
export class SourcesPart extends Part implements ISourcesPartService {

	declare readonly _serviceBrand: undefined;

	//#region IView

	readonly minimumWidth: number = 200;
	readonly maximumWidth: number = Number.POSITIVE_INFINITY;
	readonly minimumHeight: number = 120;
	readonly maximumHeight: number = Number.POSITIVE_INFINITY;
	get snap(): boolean { return true; }

	readonly priority = LayoutPriority.Low;

	//#endregion

	constructor(
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
	) {
		super(Parts.SOURCES_PART, { hasTitle: true }, themeService, storageService, layoutService);
	}

	override create(parent: HTMLElement): void {
		this.element = parent;
		parent.classList.add('sources');
		parent.tabIndex = 0;

		super.create(parent);
	}

	protected override createTitleArea(parent: HTMLElement): HTMLElement {
		const titleArea = append(parent, $('.title'));
		const titleLabel = append(titleArea, $('.title-label'));
		const heading = append(titleLabel, $('h2'));
		heading.textContent = localize('sourcesPart.title', "Sources");

		return titleArea;
	}

	protected override createContentArea(parent: HTMLElement): HTMLElement {
		const content = append(parent, $('.content'));

		const body = append(content, $('.sources-placeholder'));
		body.textContent = localize('sourcesPart.bodyPlaceholder', "Sources");

		return content;
	}

	override layout(width: number, height: number, top: number, left: number): void {
		if (!this.layoutService.isVisible(Parts.SOURCES_PART)) {
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
			type: Parts.SOURCES_PART
		};
	}
}

registerSingleton(ISourcesPartService, SourcesPart, InstantiationType.Eager);
