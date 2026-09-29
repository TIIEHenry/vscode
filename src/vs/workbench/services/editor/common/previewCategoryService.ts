/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from "../../../../base/common/event.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { IUntypedEditorInput } from "../../../common/editor.js";

export const IPreviewCategoryService = createDecorator<IPreviewCategoryService>("previewCategoryService");

export const enum PreviewCategory {
	Overview = "overview",
	Terminal = "terminal",
	Code = "code",
	Web = "web",
	Planning = "planning",
	History = "history",
	Artifacts = "artifacts"
}

/** Fixed category order. Category bar, commands, and migration all use this list. */
export const PREVIEW_CATEGORIES: readonly PreviewCategory[] = [
	PreviewCategory.Overview,
	PreviewCategory.Terminal,
	PreviewCategory.Code,
	PreviewCategory.Web,
	PreviewCategory.Planning,
	PreviewCategory.History,
	PreviewCategory.Artifacts
];

export function isPreviewCategory(value: string): value is PreviewCategory {
	return (PREVIEW_CATEGORIES as readonly string[]).includes(value);
}

/**
 * An editor input may declare the Preview category it belongs to.
 * Routing reads this with a type guard instead of casting to `any`.
 */
export interface IPreviewCategorizedEditor {
	readonly previewCategory: PreviewCategory;
}

export interface IPreviewCategoryChangeEvent {
	readonly category: PreviewCategory;
	readonly previousCategory: PreviewCategory;
}

export interface IPreviewCategoryCounts {
	readonly [PreviewCategory.Overview]?: number;
	readonly [PreviewCategory.Terminal]?: number;
	readonly [PreviewCategory.Code]: number;
	readonly [PreviewCategory.Web]?: number;
	readonly [PreviewCategory.Planning]: number;
	readonly [PreviewCategory.History]?: number;
	readonly [PreviewCategory.Artifacts]: number;
}

export interface IPreviewCategoryService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeCategory: Event<IPreviewCategoryChangeEvent>;
	readonly onDidChangeCategoryCounts: Event<IPreviewCategoryCounts>;
	readonly onDidChangeCategoryHints: Event<readonly PreviewCategory[]>;

	readonly activeCategory: PreviewCategory;
	setActiveCategory(category: PreviewCategory): void;

	getCategoryCounts(): IPreviewCategoryCounts;
	setCategoryCounts(counts: IPreviewCategoryCounts): void;

	hasCategoryHint(category: PreviewCategory): boolean;
	setCategoryHint(category: PreviewCategory, hinted: boolean): void;

	getCategoryForInput(input: EditorInput | IUntypedEditorInput | undefined | null): PreviewCategory;
}
