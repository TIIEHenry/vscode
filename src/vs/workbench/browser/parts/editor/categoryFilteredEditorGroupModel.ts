/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorsOrder, IMatchEditorOptions, IUntypedEditorInput, GroupModelChangeKind } from "../../../common/editor.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { FilteredEditorGroupModel } from "../../../common/editor/filteredEditorGroupModel.js";
import { IReadonlyEditorGroupModel } from "../../../common/editor/editorGroupModel.js";
import { IPreviewCategoryService, PreviewCategory } from "../../../services/editor/common/previewCategoryService.js";

export class CategoryFilteredEditorGroupModel extends FilteredEditorGroupModel {

	constructor(
		model: IReadonlyEditorGroupModel,
		@IPreviewCategoryService private readonly previewCategoryService: IPreviewCategoryService
	) {
		super(model);

		this._register(this.previewCategoryService.onDidChangeCategory(() => {
			this.updateCategoryCounts();
			this._onDidModelChange.fire({ kind: GroupModelChangeKind.EDITOR_OPEN });
		}));

		this._register(this.model.onDidModelChange(() => {
			this.updateCategoryCounts();
		}));

		this.updateCategoryCounts();
	}

	private updateCategoryCounts(): void {
		const allEditors = this.model.getEditors(EditorsOrder.SEQUENTIAL);
		let overview = 0;
		let terminal = 0;
		let code = 0;
		let web = 0;
		let planning = 0;
		let history = 0;
		let artifacts = 0;

		for (const editor of allEditors) {
			const cat = this.previewCategoryService.getCategoryForInput(editor);
			switch (cat) {
				case PreviewCategory.Overview:
					overview++;
					break;
				case PreviewCategory.Terminal:
					terminal++;
					break;
				case PreviewCategory.Code:
					code++;
					break;
				case PreviewCategory.Web:
					web++;
					break;
				case PreviewCategory.Planning:
					planning++;
					break;
				case PreviewCategory.History:
					history++;
					break;
				case PreviewCategory.Artifacts:
					artifacts++;
					break;
				default:
					code++;
					break;
			}
		}

		this.previewCategoryService.setCategoryCounts({
			[PreviewCategory.Overview]: overview,
			[PreviewCategory.Terminal]: terminal,
			[PreviewCategory.Code]: code,
			[PreviewCategory.Web]: web,
			[PreviewCategory.Planning]: planning,
			[PreviewCategory.History]: history,
			[PreviewCategory.Artifacts]: artifacts
		});
	}

	get activeCategory(): PreviewCategory {
		return this.previewCategoryService.activeCategory;
	}

	override get count(): number {
		return this.getEditors(EditorsOrder.SEQUENTIAL).length;
	}

	override get activeEditor(): EditorInput | null {
		const active = this.model.activeEditor;
		if (active && this.filter(active)) {
			return active;
		}
		const editors = this.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
		return editors.length > 0 ? editors[0] : null;
	}

	override getEditorByIndex(index: number): EditorInput | undefined {
		const editors = this.getEditors(EditorsOrder.SEQUENTIAL);
		return editors[index];
	}

	override indexOf(editor: EditorInput | IUntypedEditorInput | null, editors?: EditorInput[], options?: IMatchEditorOptions): number {
		const sequentialEditors = editors ?? this.getEditors(EditorsOrder.SEQUENTIAL);
		if (!editor) {
			return -1;
		}
		return sequentialEditors.findIndex(e => e.matches(editor));
	}

	override contains(candidate: EditorInput | IUntypedEditorInput, options?: IMatchEditorOptions): boolean {
		const editors = this.getEditors(EditorsOrder.SEQUENTIAL);
		return editors.some(e => e.matches(candidate));
	}

	protected override filter(candidateOrIndex: EditorInput | number): boolean {
		let editor: EditorInput | undefined;
		if (typeof candidateOrIndex === "number") {
			editor = this.model.getEditorByIndex(candidateOrIndex);
		} else {
			editor = candidateOrIndex;
		}

		if (!editor) {
			return false;
		}

		return this.previewCategoryService.getCategoryForInput(editor) === this.activeCategory;
	}
}
