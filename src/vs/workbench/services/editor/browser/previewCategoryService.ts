/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { isDiffEditorInput, isEditorInput, isEditorInputWithOptions, isResourceDiffEditorInput, IUntypedEditorInput } from "../../../common/editor.js";
import { IPreviewCategoryChangeEvent, IPreviewCategoryCounts, IPreviewCategoryService, isPreviewCategory, PREVIEW_CATEGORIES, PreviewCategory } from "../common/previewCategoryService.js";

const BROWSER_EDITOR_TYPE_ID = "workbench.editorinputs.browser";

/**
 * Git refs that are the working tree, the index, or a merge stage — not a
 * historical commit the user opened. `HEAD` is the working-tree baseline
 * (unstaged diffs use it as the original side). Anything else (`git:` of a
 * real commit) is History.
 */
const WORKING_TREE_GIT_REFS = new Set(["", "~", "~1", "~2", "~3", "wt", "index", "HEAD", ":1", ":2", ":3"]);

export class PreviewCategoryService extends Disposable implements IPreviewCategoryService {

	declare readonly _serviceBrand: undefined;

	private static readonly STORAGE_KEY = "workbench.preview.activeCategory";

	private readonly _onDidChangeCategory = this._register(new Emitter<IPreviewCategoryChangeEvent>());
	readonly onDidChangeCategory: Event<IPreviewCategoryChangeEvent> = this._onDidChangeCategory.event;

	private readonly _onDidChangeCategoryCounts = this._register(new Emitter<IPreviewCategoryCounts>());
	readonly onDidChangeCategoryCounts: Event<IPreviewCategoryCounts> = this._onDidChangeCategoryCounts.event;

	private readonly _onDidChangeCategoryHints = this._register(new Emitter<readonly PreviewCategory[]>());
	readonly onDidChangeCategoryHints: Event<readonly PreviewCategory[]> = this._onDidChangeCategoryHints.event;

	private _activeCategory: PreviewCategory = PreviewCategory.Code;
	get activeCategory(): PreviewCategory {
		return this._activeCategory;
	}

	private _counts: IPreviewCategoryCounts = {
		[PreviewCategory.Overview]: 0,
		[PreviewCategory.Terminal]: 0,
		[PreviewCategory.Code]: 0,
		[PreviewCategory.Web]: 0,
		[PreviewCategory.Planning]: 0,
		[PreviewCategory.History]: 0,
		[PreviewCategory.Artifacts]: 0
	};

	private readonly _hints = new Set<PreviewCategory>();

	constructor(
		@IStorageService private readonly storageService: IStorageService
	) {
		super();

		const persisted = this.storageService.get(PreviewCategoryService.STORAGE_KEY, StorageScope.WORKSPACE);
		if (persisted && isPreviewCategory(persisted)) {
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
		let hasChanged = false;
		const allKeys = new Set([...Object.keys(this._counts), ...Object.keys(counts)]) as Set<keyof IPreviewCategoryCounts>;
		for (const key of allKeys) {
			if (this._counts[key] !== counts[key]) {
				hasChanged = true;
				break;
			}
		}
		if (!hasChanged) {
			return;
		}

		this._counts = { ...counts };
		this._onDidChangeCategoryCounts.fire(this._counts);
	}

	hasCategoryHint(category: PreviewCategory): boolean {
		return this._hints.has(category);
	}

	setCategoryHint(category: PreviewCategory, hinted: boolean): void {
		if (this._hints.has(category) === hinted) {
			return;
		}

		if (hinted) {
			this._hints.add(category);
		} else {
			this._hints.delete(category);
		}

		this._onDidChangeCategoryHints.fire(PREVIEW_CATEGORIES.filter(candidate => this._hints.has(candidate)));
	}

	getCategoryForInput(input: EditorInput | IUntypedEditorInput | undefined | null): PreviewCategory {
		if (!input) {
			return PreviewCategory.Code;
		}

		const rawEditor = isEditorInputWithOptions(input) ? input.editor : input;
		const declared = readDeclaredPreviewCategory(rawEditor);
		if (declared) {
			return declared;
		}

		if (readBooleanFlag(rawEditor, "isArtifactInput")) {
			return PreviewCategory.Artifacts;
		}
		if (readBooleanFlag(rawEditor, "isPlanningInput")) {
			return PreviewCategory.Planning;
		}

		if (readTypeId(rawEditor) === BROWSER_EDITOR_TYPE_ID) {
			return PreviewCategory.Web;
		}

		return classifyEditorResources(rawEditor);
	}
}

registerSingleton(IPreviewCategoryService, PreviewCategoryService, InstantiationType.Eager);

function readDeclaredPreviewCategory(candidate: object): PreviewCategory | undefined {
	if (!("previewCategory" in candidate)) {
		return undefined;
	}

	const value = (candidate as { previewCategory?: unknown }).previewCategory;
	return typeof value === "string" && isPreviewCategory(value) ? value : undefined;
}

function readBooleanFlag(candidate: object, key: "isArtifactInput" | "isPlanningInput"): boolean {
	if (!(key in candidate)) {
		return false;
	}

	return (candidate as { isArtifactInput?: unknown; isPlanningInput?: unknown })[key] === true;
}

function readTypeId(candidate: object): string | undefined {
	if (!("typeId" in candidate)) {
		return undefined;
	}

	const value = (candidate as { typeId?: unknown }).typeId;
	return typeof value === "string" ? value : undefined;
}

function readResource(candidate: object): URI | undefined {
	if (!("resource" in candidate)) {
		return undefined;
	}

	const value = (candidate as { resource?: unknown }).resource;
	return URI.isUri(value) ? value : undefined;
}

function classifyEditorResources(rawEditor: EditorInput | IUntypedEditorInput): PreviewCategory {
	let modified: URI | undefined;
	let original: URI | undefined;

	if (isDiffEditorInput(rawEditor)) {
		modified = rawEditor.modified.resource;
		original = rawEditor.original.resource;
	} else if (isResourceDiffEditorInput(rawEditor)) {
		modified = readResource(rawEditor.modified);
		original = readResource(rawEditor.original);
	}

	if (modified || original) {
		return classifyDiff(modified, original);
	}

	const resource = isEditorInput(rawEditor) ? rawEditor.resource : readResource(rawEditor);
	if (resource) {
		return categoryForUri(resource) ?? PreviewCategory.Code;
	}

	return PreviewCategory.Code;
}

function classifyDiff(modified: URI | undefined, original: URI | undefined): PreviewCategory {
	// The side the user is editing wins. A workspace file (or a working-tree
	// git ref) on the modified side stays in Code even when the original side
	// is a historical `git:` document. `EditorInput.resource` is empty when
	// the two schemes differ, so it cannot be used here.
	if (modified) {
		const modifiedCategory = categoryForUri(modified);
		if (modifiedCategory) {
			return modifiedCategory;
		}
	}

	if (!modified && original) {
		return categoryForUri(original) ?? PreviewCategory.Code;
	}

	return PreviewCategory.Code;
}

function categoryForUri(uri: URI): PreviewCategory | undefined {
	switch (uri.scheme.toLowerCase()) {
		case Schemas.walkThrough.toLowerCase():
		case "walkthroughsnippet":
			return PreviewCategory.Overview;
		case Schemas.vscodeTerminal:
			return PreviewCategory.Terminal;
		case Schemas.vscodeBrowser:
			return PreviewCategory.Web;
		case "planning":
		case "todo":
		case "project-context":
			return PreviewCategory.Planning;
		case "scm-history-item":
		case "vscode-local-history":
			return PreviewCategory.History;
		case "canvas":
		case "artifact":
			return PreviewCategory.Artifacts;
		case "scm-multi-diff-source":
		case Schemas.file:
		case Schemas.untitled:
		case Schemas.vscodeRemote:
			return PreviewCategory.Code;
		case "git":
			return gitDocumentCategory(uri);
		default:
			return undefined;
	}
}

function gitDocumentCategory(uri: URI): PreviewCategory {
	const ref = readGitRef(uri);
	if (ref !== undefined && WORKING_TREE_GIT_REFS.has(ref)) {
		return PreviewCategory.Code;
	}

	return PreviewCategory.History;
}

function readGitRef(uri: URI): string | undefined {
	if (!uri.query) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(uri.query) as { ref?: unknown };
		return typeof parsed.ref === "string" ? parsed.ref : undefined;
	} catch {
		return undefined;
	}
}
