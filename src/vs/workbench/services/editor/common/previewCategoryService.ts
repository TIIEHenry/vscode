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
	Code = "code",
	Artifacts = "artifacts",
	Planning = "planning"
}

export interface IPreviewCategoryChangeEvent {
	readonly category: PreviewCategory;
	readonly previousCategory: PreviewCategory;
}

export interface IPreviewCategoryCounts {
	readonly [PreviewCategory.Code]: number;
	readonly [PreviewCategory.Artifacts]: number;
	readonly [PreviewCategory.Planning]: number;
}

export interface IPreviewCategoryService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeCategory: Event<IPreviewCategoryChangeEvent>;
	readonly onDidChangeCategoryCounts: Event<IPreviewCategoryCounts>;

	readonly activeCategory: PreviewCategory;
	setActiveCategory(category: PreviewCategory): void;

	getCategoryCounts(): IPreviewCategoryCounts;
	setCategoryCounts(counts: IPreviewCategoryCounts): void;

	getCategoryForInput(input: EditorInput | IUntypedEditorInput | undefined | null): PreviewCategory;
	setCategoryForInput(input: EditorInput, category: PreviewCategory): void;
}
