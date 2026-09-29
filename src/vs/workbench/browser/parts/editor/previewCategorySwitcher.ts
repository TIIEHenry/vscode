/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, addDisposableListener, EventType, DisposableResizeObserver, getWindow, scheduleAtNextAnimationFrame } from "../../../../base/browser/dom.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IPreviewCategoryService, PreviewCategory, IPreviewCategoryCounts } from "../../../services/editor/common/previewCategoryService.js";
import { DraggedEditorIdentifier } from "../../dnd.js";
import { LocalSelectionTransfer } from "../../../../platform/dnd/browser/dnd.js";

export class PreviewCategorySwitcher extends Disposable {

	private static readonly CATEGORIES: readonly PreviewCategory[] = [
		PreviewCategory.Overview,
		PreviewCategory.Terminal,
		PreviewCategory.Code,
		PreviewCategory.Web,
		PreviewCategory.Planning,
		PreviewCategory.History,
		PreviewCategory.Artifacts
	];

	private readonly element: HTMLElement;
	private readonly tabs = new Map<PreviewCategory, HTMLElement>();
	private readonly badges = new Map<PreviewCategory, HTMLElement>();
	private readonly labels = new Map<PreviewCategory, string>();
	private fitScheduled = false;

	constructor(
		parent: HTMLElement,
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

		for (const category of PreviewCategorySwitcher.CATEGORIES) {
			this.createCategoryTab(category, labels[category]);
		}

		parent.appendChild(this.element);

		const resize = this._register(new DisposableResizeObserver('previewCategoryBar', () => this.scheduleFitCounts(), getWindow(parent)));
		this._register(resize.observe(parent));

		this._register(this.previewCategoryService.onDidChangeCategory(() => this.updateActiveTab()));
		this._register(this.previewCategoryService.onDidChangeCategoryCounts(counts => this.updateCounts(counts)));

		this.updateActiveTab();
		this.updateCounts(this.previewCategoryService.getCategoryCounts());
	}

	get domNode(): HTMLElement {
		return this.element;
	}

	private renderCategoryIcon(category: PreviewCategory): SVGElement {
		const svgAttrs = {
			viewBox: '0 0 24 24',
			width: '18',
			height: '18',
			fill: 'none',
			stroke: 'currentColor',
			'stroke-width': '1.8',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round'
		};

		switch (category) {
			case PreviewCategory.Overview:
				return $.SVG('svg', svgAttrs,
					$.SVG('path', { d: 'M3 10.5L12 3.5l9 7' }),
					$.SVG('path', { d: 'M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5' }),
					$.SVG('path', { d: 'M10 21v-6a2 2 0 0 1 4 0v6' })
				);
			case PreviewCategory.Terminal:
				return $.SVG('svg', svgAttrs,
					$.SVG('rect', { x: '3', y: '4', width: '18', height: '16', rx: '2.5' }),
					$.SVG('polyline', { points: '7.5 9 10.5 12 7.5 15' }),
					$.SVG('line', { x1: '12.5', y1: '15', x2: '16.5', y2: '15' })
				);
			case PreviewCategory.Code:
				return $.SVG('svg', svgAttrs,
					$.SVG('path', { d: 'M14 3v4a1 1 0 0 0 1 1h4' }),
					$.SVG('path', { d: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z' }),
					$.SVG('polyline', { points: '9.5 12 7.5 14 9.5 16' }),
					$.SVG('polyline', { points: '14.5 12 16.5 14 14.5 16' }),
					$.SVG('line', { x1: '12.5', y1: '11.5', x2: '11.5', y2: '16.5' })
				);
			case PreviewCategory.Web:
				return $.SVG('svg', svgAttrs,
					$.SVG('circle', { cx: '12', cy: '12', r: '9' }),
					$.SVG('line', { x1: '3', y1: '12', x2: '21', y2: '12' }),
					$.SVG('ellipse', { cx: '12', cy: '12', rx: '4.5', ry: '9' })
				);
			case PreviewCategory.Planning:
				return $.SVG('svg', svgAttrs,
					$.SVG('path', { d: 'M15.5 18H10a6 6 0 0 1-6-6c0-2.5 1.5-4.7 3.7-5.5A7 7 0 0 1 19 8.5c0 1.2-.4 2.4-1.1 3.3' }),
					$.SVG('path', { d: 'M15.5 18v3' }),
					$.SVG('path', { d: 'M11 21h6' }),
					$.SVG('circle', { cx: '12', cy: '10', r: '2.5' }),
					$.SVG('path', { d: 'M12 6.5v1M12 12.5v1M8.5 10h1M14.5 10h1M9.5 7.5l.7.7M13.8 11.8l.7.7M9.5 12.5l.7-.7M13.8 8.2l.7-.7' })
				);
			case PreviewCategory.History:
				return $.SVG('svg', svgAttrs,
					$.SVG('circle', { cx: '12', cy: '12', r: '9' }),
					$.SVG('polyline', { points: '12 7 12 12 15.5 14' })
				);
			case PreviewCategory.Artifacts:
				return $.SVG('svg', { ...svgAttrs, stroke: 'none', fill: 'currentColor' },
					$.SVG('rect', { x: '3.5', y: '3.5', width: '4', height: '4', rx: '0.8' }),
					$.SVG('rect', { x: '10', y: '3.5', width: '4', height: '4', rx: '0.8' }),
					$.SVG('rect', { x: '16.5', y: '3.5', width: '4', height: '4', rx: '0.8' }),
					$.SVG('rect', { x: '3.5', y: '10', width: '4', height: '4', rx: '0.8' }),
					$.SVG('rect', { x: '10', y: '10', width: '4', height: '4', rx: '0.8' }),
					$.SVG('rect', { x: '16.5', y: '10', width: '4', height: '4', rx: '0.8' }),
					$.SVG('rect', { x: '3.5', y: '16.5', width: '4', height: '4', rx: '0.8' }),
					$.SVG('rect', { x: '10', y: '16.5', width: '4', height: '4', rx: '0.8' }),
					$.SVG('rect', { x: '16.5', y: '16.5', width: '4', height: '4', rx: '0.8' })
				);
		}
	}

	private createCategoryTab(category: PreviewCategory, labelText: string): void {
		const tab = append(this.element, $(".preview-category-tab", {
			role: "tab",
			tabIndex: 0,
			"data-category": category,
			"aria-label": labelText,
			title: labelText
		}));

		const iconContainer = append(tab, $("span.category-icon"));
		append(iconContainer, this.renderCategoryIcon(category));

		append(tab, $("span.category-label", { style: "display: none;" }, labelText));
		const badge = append(tab, $("span.category-count"));
		badge.style.display = "none";

		this.tabs.set(category, tab);
		this.badges.set(category, badge);
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
				this.focusNextCategory(category, 1);
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				this.focusNextCategory(category, -1);
			}
		}));

		const editorTransfer = LocalSelectionTransfer.getInstance<DraggedEditorIdentifier>();
		this._register(addDisposableListener(tab, EventType.DRAG_OVER, (e: DragEvent) => {
			if (editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
				e.preventDefault();
				if (e.dataTransfer) {
					e.dataTransfer.dropEffect = 'move';
				}
				tab.classList.add('drag-over');
			}
		}));

		this._register(addDisposableListener(tab, EventType.DRAG_LEAVE, () => {
			tab.classList.remove('drag-over');
		}));

		this._register(addDisposableListener(tab, EventType.DROP, (e: DragEvent) => {
			tab.classList.remove('drag-over');
			if (editorTransfer.hasData(DraggedEditorIdentifier.prototype)) {
				e.preventDefault();
				e.stopPropagation();
				const draggedEditors = editorTransfer.getData(DraggedEditorIdentifier.prototype);
				if (draggedEditors && draggedEditors.length > 0) {
					for (const dragged of draggedEditors) {
						if (dragged.identifier.editor) {
							this.previewCategoryService.setCategoryForInput(dragged.identifier.editor, category);
						}
					}
					this.previewCategoryService.setActiveCategory(category);
				}
			}
		}));
	}

	private focusNextCategory(current: PreviewCategory, direction: number): void {
		const categories = PreviewCategorySwitcher.CATEGORIES;
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
}
