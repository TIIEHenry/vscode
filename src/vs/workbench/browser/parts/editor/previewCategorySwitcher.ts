/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, addDisposableListener, EventType } from "../../../../base/browser/dom.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IPreviewCategoryService, PreviewCategory } from "../../../services/editor/common/previewCategoryService.js";

export class PreviewCategorySwitcher extends Disposable {

	private readonly element: HTMLElement;
	private readonly tabs = new Map<PreviewCategory, HTMLElement>();
	private readonly badges = new Map<PreviewCategory, HTMLElement>();

	constructor(
		parent: HTMLElement,
		@IPreviewCategoryService private readonly previewCategoryService: IPreviewCategoryService
	) {
		super();

		this.element = $(".preview-category-switcher", {
			role: "tablist",
			"aria-label": localize("previewCategories", "Preview Categories")
		});

		this.createCategoryTab(PreviewCategory.Code, localize("categoryCode", "Code"));
		this.createCategoryTab(PreviewCategory.Artifacts, localize("categoryArtifacts", "Artifacts"));
		this.createCategoryTab(PreviewCategory.Planning, localize("categoryPlanning", "Planning"));

		parent.appendChild(this.element);

		this._register(this.previewCategoryService.onDidChangeCategory(() => this.updateActiveTab()));
		this._register(this.previewCategoryService.onDidChangeCategoryCounts(counts => this.updateCounts(counts)));

		this.updateActiveTab();
		this.updateCounts(this.previewCategoryService.getCategoryCounts());
	}

	get domNode(): HTMLElement {
		return this.element;
	}

	private createCategoryTab(category: PreviewCategory, labelText: string): void {
		const tab = append(this.element, $(".preview-category-tab", {
			role: "tab",
			tabIndex: 0,
			"data-category": category,
			"aria-label": labelText
		}));

		append(tab, $("span.category-label", undefined, labelText));
		const badge = append(tab, $("span.category-count", { style: "display: none;" }));

		this.tabs.set(category, tab);
		this.badges.set(category, badge);

		this._register(addDisposableListener(tab, EventType.CLICK, () => {
			this.previewCategoryService.setActiveCategory(category);
		}));

		this._register(addDisposableListener(tab, EventType.KEY_DOWN, (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.previewCategoryService.setActiveCategory(category);
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				this.focusNextCategory(category, 1);
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				this.focusNextCategory(category, -1);
			}
		}));
	}

	private focusNextCategory(current: PreviewCategory, direction: number): void {
		const categories = [PreviewCategory.Code, PreviewCategory.Artifacts, PreviewCategory.Planning];
		const idx = categories.indexOf(current);
		if (idx >= 0) {
			const nextIdx = (idx + direction + categories.length) % categories.length;
			const nextCategory = categories[nextIdx];
			this.previewCategoryService.setActiveCategory(nextCategory);
			this.tabs.get(nextCategory)?.focus();
		}
	}

	private updateActiveTab(): void {
		const active = this.previewCategoryService.activeCategory;
		for (const [category, tab] of this.tabs) {
			const isSelected = category === active;
			tab.classList.toggle("selected", isSelected);
			tab.setAttribute("aria-selected", isSelected ? "true" : "false");
		}
	}

	private updateCounts(counts: { [key in PreviewCategory]: number }): void {
		for (const [category, badge] of this.badges) {
			const count = counts[category] ?? 0;
			if (count > 0) {
				badge.textContent = `${count}`;
				badge.style.display = "";
			} else {
				badge.style.display = "none";
			}
		}
	}
}
