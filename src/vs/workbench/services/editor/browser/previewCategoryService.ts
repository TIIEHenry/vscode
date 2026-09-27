/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { isEditorInput, isEditorInputWithOptions, IUntypedEditorInput } from "../../../common/editor.js";
import { IPreviewCategoryChangeEvent, IPreviewCategoryCounts, IPreviewCategoryService, PreviewCategory } from "../common/previewCategoryService.js";

export class PreviewCategoryService extends Disposable implements IPreviewCategoryService {

	declare readonly _serviceBrand: undefined;

	private static readonly STORAGE_KEY = "workbench.preview.activeCategory";

	private readonly _onDidChangeCategory = this._register(new Emitter<IPreviewCategoryChangeEvent>());
	readonly onDidChangeCategory: Event<IPreviewCategoryChangeEvent> = this._onDidChangeCategory.event;

	private readonly _onDidChangeCategoryCounts = this._register(new Emitter<IPreviewCategoryCounts>());
	readonly onDidChangeCategoryCounts: Event<IPreviewCategoryCounts> = this._onDidChangeCategoryCounts.event;

	private _activeCategory: PreviewCategory = PreviewCategory.Code;
	get activeCategory(): PreviewCategory {
		return this._activeCategory;
	}

	private _counts: IPreviewCategoryCounts = {
		[PreviewCategory.Code]: 0,
		[PreviewCategory.Artifacts]: 0,
		[PreviewCategory.Planning]: 0
	};

	constructor(
		@IStorageService private readonly storageService: IStorageService
	) {
		super();

		const persisted = this.storageService.get(PreviewCategoryService.STORAGE_KEY, StorageScope.WORKSPACE);
		if (persisted === PreviewCategory.Code || persisted === PreviewCategory.Artifacts || persisted === PreviewCategory.Planning) {
			this._activeCategory = persisted;
		}
	}

	setActiveCategory(category: PreviewCategory): void {
		if (this._activeCategory === category) {
			return;
		}

		const previousCategory = this._activeCategory;
		this._activeCategory = category;
		this.storageService.store(PreviewCategoryService.STORAGE_KEY, category, StorageScope.WORKSPACE, StorageTarget.USER);
		this._onDidChangeCategory.fire({ category, previousCategory });
	}

	getCategoryCounts(): IPreviewCategoryCounts {
		return this._counts;
	}

	setCategoryCounts(counts: IPreviewCategoryCounts): void {
		if (this._counts[PreviewCategory.Code] === counts[PreviewCategory.Code] &&
			this._counts[PreviewCategory.Artifacts] === counts[PreviewCategory.Artifacts] &&
			this._counts[PreviewCategory.Planning] === counts[PreviewCategory.Planning]) {
			return;
		}

		this._counts = { ...counts };
		this._onDidChangeCategoryCounts.fire(this._counts);
	}

	getCategoryForInput(input: EditorInput | IUntypedEditorInput | undefined | null): PreviewCategory {
		if (!input) {
			return PreviewCategory.Code;
		}

		const rawEditor = isEditorInputWithOptions(input) ? input.editor : input;

		// Explicit flag or property
		if ((rawEditor as any).isArtifactInput === true || (rawEditor as any).category === PreviewCategory.Artifacts) {
			return PreviewCategory.Artifacts;
		}
		if ((rawEditor as any).isPlanningInput === true || (rawEditor as any).category === PreviewCategory.Planning) {
			return PreviewCategory.Planning;
		}

		// Scheme checking
		const uri = isEditorInput(rawEditor) ? rawEditor.resource : rawEditor.resource;
		if (uri) {
			const scheme = uri.scheme.toLowerCase();
			if (scheme === "canvas" || scheme === "artifact" || scheme === "visualize") {
				return PreviewCategory.Artifacts;
			}
			if (scheme === "planning" || scheme === "todo" || scheme === "project-context") {
				return PreviewCategory.Planning;
			}
		}

		return PreviewCategory.Code;
	}
}

registerSingleton(IPreviewCategoryService, PreviewCategoryService, InstantiationType.Eager);
