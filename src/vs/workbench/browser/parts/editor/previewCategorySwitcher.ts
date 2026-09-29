/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/previewCategoryBar.css';
import { $, append, addDisposableListener, EventType, DisposableResizeObserver, getWindow, scheduleAtNextAnimationFrame } from "../../../../base/browser/dom.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { IPreviewCategoryService, PreviewCategory, IPreviewCategoryCounts, PREVIEW_CATEGORIES } from "../../../services/editor/common/previewCategoryService.js";
import { DraggedEditorIdentifier } from "../../dnd.js";
import { LocalSelectionTransfer } from "../../../../platform/dnd/browser/dnd.js";

export interface IPreviewCategoryBarHost {
	moveEditorToCategory(editor: EditorInput, category: PreviewCategory): void;
}

const CATEGORY_ICONS: Record<PreviewCategory, ThemeIcon> = {
	[PreviewCategory.Overview]: Codicon.home,
	[PreviewCategory.Terminal]: Codicon.terminal,
	[PreviewCategory.Code]: Codicon.code,
	[PreviewCategory.Web]: Codicon.globe,
	[PreviewCategory.Planning]: Codicon.checklist,
	[PreviewCategory.History]: Codicon.history,
	[PreviewCategory.Artifacts]: Codicon.package
};

export class PreviewCategorySwitcher extends Disposable {

	private readonly element: HTMLElement;
	private readonly tabs = new Map<PreviewCategory, HTMLElement>();
	private readonly badges = new Map<PreviewCategory, HTMLElement>();
	private readonly hints = new Map<PreviewCategory, HTMLElement>();
	private readonly labels = new Map<PreviewCategory, string>();
	private fitScheduled = false;

	constructor(
		parent: HTMLElement,
		private readonly host: IPreviewCategoryBarHost | undefined,
		@IPreviewCategoryService private readonly previewCategoryService: IPreviewCategoryService
	) {
		super();

		this.element = $(".preview-category-switcher", {
			role: "tablist",
			"aria-label": localize("previewCategories", "Preview Categories")
		});

		const labels: Record<PreviewCategory, string> = {
			[PreviewCategory.Overview]: localize("categoryOverview", "Overview"),
			[PreviewCategory.Terminal]: localize("categoryTerminal", "Terminal"),
			[PreviewCategory.Code]: localize("categoryCode", "Code"),
			[PreviewCategory.Web]: localize("categoryWeb", "Web"),
			[PreviewCategory.Planning]: localize("categoryPlanning", "Planning"),
			[PreviewCategory.History]: localize("categoryHistory", "History"),
			[PreviewCategory.Artifacts]: localize("categoryArtifacts", "Artifacts")
		};

		for (const category of PREVIEW_CATEGORIES) {
			this.createCategoryTab(category, labels[category]);
		}

		parent.appendChild(this.element);

		const resize = this._register(new DisposableResizeObserver('previewCategoryBar', () => this.scheduleFitCounts(), getWindow(parent)));
		this._register(resize.observe(parent));

		this._register(this.previewCategoryService.onDidChangeCategory(() => this.updateActiveTab()));
		this._register(this.previewCategoryService.onDidChangeCategoryCounts(counts => this.updateCounts(counts)));
		this._register(this.previewCategoryService.onDidChangeCategoryHints(() => this.updateHints()));

		this.updateActiveTab();
		this.updateCounts(this.previewCategoryService.getCategoryCounts());
		this.updateHints();
	}

	get domNode(): HTMLElement {
		return this.element;
	}

	private createCategoryTab(category: PreviewCategory, labelText: string): void {
		const tab = append(this.element, $(".preview-category-tab", {
			role: "tab",
			tabIndex: 0,
			"data-category": category,
			"aria-label": labelText,
			title: labelText
		}));

		const icon = append(tab, $("span.category-icon"));
		icon.classList.add(...ThemeIcon.asClassName(CATEGORY_ICONS[category]).split(" "));

		append(tab, $("span.category-label", { style: "display: none;" }, labelText));
		const badge = append(tab, $("span.category-count"));
		badge.style.display = "none";
		const hint = append(tab, $("span.category-hint"));
		hint.style.display = "none";

		this.tabs.set(category, tab);
		this.badges.set(category, badge);
		this.hints.set(category, hint);
		this.labels.set(category, labelText);

		this._register(addDisposableListener(tab, EventType.CLICK, () => {
			this.previewCategoryService.setActiveCategory(category);
		}));

		this._register(addDisposableListener(tab, EventType.KEY_DOWN, (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.previewCategoryService.setActiveCategory(category);
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				this.focusAdjacentCategory(category, 1);
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				this.focusAdjacentCategory(category, -1);
			}
		}));

		const editorTransfer = LocalSelectionTransfer.getInstance<DraggedEditorIdentifier>();
		this._register(addDisposableListener(tab, EventType.DRAG_OVER, (e: DragEvent) => {
			if (editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
				e.preventDefault();
				if (e.dataTransfer) {
					e.dataTransfer.dropEffect = "move";
				}
				tab.classList.add("drag-over");
			}
		}));

		this._register(addDisposableListener(tab, EventType.DRAG_LEAVE, () => {
			tab.classList.remove("drag-over");
		}));

		this._register(addDisposableListener(tab, EventType.DROP, (e: DragEvent) => {
			tab.classList.remove("drag-over");
			if (!editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
				return;
			}

			e.preventDefault();
			e.stopPropagation();
			const draggedEditors = editorTransfer.getData(DraggedEditorIdentifier.prototype);
			if (!draggedEditors || !this.host) {
				return;
			}

			for (const dragged of draggedEditors) {
				if (dragged.identifier.editor) {
					this.host.moveEditorToCategory(dragged.identifier.editor, category);
				}
			}
		}));
	}

	private focusAdjacentCategory(current: PreviewCategory, direction: number): void {
		const idx = PREVIEW_CATEGORIES.indexOf(current);
		if (idx < 0) {
			return;
		}

		const nextCategory = PREVIEW_CATEGORIES[(idx + direction + PREVIEW_CATEGORIES.length) % PREVIEW_CATEGORIES.length];
		this.tabs.get(nextCategory)?.focus();
	}

	private updateActiveTab(): void {
		const active = this.previewCategoryService.activeCategory;
		for (const [category, tab] of this.tabs) {
			const isSelected = category === active;
			tab.classList.toggle("selected", isSelected);
			tab.setAttribute("aria-selected", isSelected ? "true" : "false");
		}
	}

	private updateCounts(counts: IPreviewCategoryCounts): void {
		for (const [category, badge] of this.badges) {
			const count = counts[category] ?? 0;
			const tab = this.tabs.get(category);
			const label = this.labels.get(category) ?? '';
			if (count > 0 && tab) {
				badge.textContent = `${count}`;
				badge.style.display = "";
				tab.classList.add('has-count');
				tab.setAttribute('aria-label', localize('categoryWithCount', "{0}, {1}", label, count));
			} else if (tab) {
				badge.textContent = '';
				badge.style.display = "none";
				tab.classList.remove('has-count');
				tab.setAttribute('aria-label', label);
			}
		}
		this.scheduleFitCounts();
	}

	/** Drop the count text when the icon row no longer fits in the category bar. */
	private scheduleFitCounts(): void {
		if (this.fitScheduled) {
			return;
		}
		this.fitScheduled = true;
		scheduleAtNextAnimationFrame(getWindow(this.element), () => {
			this.fitScheduled = false;
			this.fitCounts();
		});
	}

	private fitCounts(): void {
		const bar = this.element.parentElement;
		if (!bar || bar.clientWidth <= 0) {
			this.element.classList.remove('hide-counts');
			return;
		}
		this.element.classList.remove('hide-counts');
		if (this.element.scrollWidth > bar.clientWidth) {
			this.element.classList.add('hide-counts');
		}
	}

	private updateHints(): void {
		for (const [category, hint] of this.hints) {
			const show = this.previewCategoryService.hasCategoryHint(category) && category !== this.previewCategoryService.activeCategory;
			hint.style.display = show ? "" : "none";
		}
	}
}
