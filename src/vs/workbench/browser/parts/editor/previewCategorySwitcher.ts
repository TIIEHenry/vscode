/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/previewCategoryBar.css';
import '../../media/uaRoundedIcons.css';
import { $, append, addDisposableListener, EventHelper, EventType, DisposableResizeObserver, getWindow, scheduleAtNextAnimationFrame } from '../../../../base/browser/dom.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { KeyCode, KeyCodeUtils } from '../../../../base/common/keyCodes.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { GroupIdentifier } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IPreviewCategoryService, PreviewCategory, IPreviewCategoryCounts, PREVIEW_CATEGORIES } from '../../../services/editor/common/previewCategoryService.js';
import { DraggedEditorIdentifier } from '../../dnd.js';
import { LocalSelectionTransfer } from '../../../../platform/dnd/browser/dnd.js';

export interface IPreviewCategoryBarHost {
	moveEditorToCategory(editor: EditorInput, category: PreviewCategory, source?: GroupIdentifier): void;
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
	private focusedCategory: PreviewCategory | undefined;

	constructor(
		parent: HTMLElement,
		private readonly host: IPreviewCategoryBarHost | undefined,
		@IPreviewCategoryService private readonly previewCategoryService: IPreviewCategoryService
	) {
		super();

		this.element = $('.preview-category-switcher', {
			role: 'tablist',
			'aria-orientation': 'horizontal',
			'aria-label': localize('previewCategories', "Preview Categories")
		});

		const labels: Record<PreviewCategory, string> = {
			[PreviewCategory.Overview]: localize('categoryOverview', "Overview"),
			[PreviewCategory.Terminal]: localize('categoryTerminal', "Terminal"),
			[PreviewCategory.Code]: localize('categoryCode', "Code"),
			[PreviewCategory.Web]: localize('categoryWeb', "Web"),
			[PreviewCategory.Planning]: localize('categoryPlanning', "Planning"),
			[PreviewCategory.History]: localize('categoryHistory', "History"),
			[PreviewCategory.Artifacts]: localize('categoryArtifacts', "Artifacts")
		};

		for (const category of PREVIEW_CATEGORIES) {
			this.createCategoryTab(category, labels[category]);
		}

		parent.appendChild(this.element);

		this._register(addDisposableListener(this.element, EventType.FOCUS_OUT, (e: FocusEvent) => {
			if (!this.element.contains(e.relatedTarget as Node | null)) {
				this.focusedCategory = this.previewCategoryService.activeCategory;
				this.updateTabStops();
			}
		}));

		const resize = this._register(new DisposableResizeObserver('previewCategoryBar', () => this.scheduleFitCounts(), getWindow(this.element)));
		this._register(resize.observe(this.element));

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
		const tab = append(this.element, $('.preview-category-tab', {
			role: 'tab',
			tabIndex: -1,
			'data-category': category,
			'aria-label': labelText,
			title: labelText
		}));

		const icon = append(tab, $('span.category-icon'));
		icon.classList.add(...ThemeIcon.asClassName(CATEGORY_ICONS[category]).split(' '));

		append(tab, $('span.category-label', { style: 'display: none;' }, labelText));
		const badge = append(tab, $('span.category-count'));
		badge.style.display = 'none';
		const hint = append(tab, $('span.category-hint'));
		hint.style.display = 'none';

		this.tabs.set(category, tab);
		this.badges.set(category, badge);
		this.hints.set(category, hint);
		this.labels.set(category, labelText);

		this._register(addDisposableListener(tab, EventType.CLICK, () => {
			this.previewCategoryService.setActiveCategory(category);
		}));
		this._register(addDisposableListener(tab, EventType.FOCUS, () => {
			this.focusedCategory = category;
			this.updateTabStops();
		}));

		this._register(addDisposableListener(tab, EventType.KEY_DOWN, (e: KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				EventHelper.stop(e, true);
				this.previewCategoryService.setActiveCategory(category);
			} else if (e.key === 'ArrowRight') {
				this.focusAdjacentCategory(category, 1);
				EventHelper.stop(e, true);
			} else if (e.key === 'ArrowLeft') {
				this.focusAdjacentCategory(category, -1);
				EventHelper.stop(e, true);
			} else if (e.key === KeyCodeUtils.toString(KeyCode.Home)) {
				this.focusCategory(PREVIEW_CATEGORIES[0]);
				EventHelper.stop(e, true);
			} else if (e.key === KeyCodeUtils.toString(KeyCode.End)) {
				this.focusCategory(PREVIEW_CATEGORIES[PREVIEW_CATEGORIES.length - 1]);
				EventHelper.stop(e, true);
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
					this.host.moveEditorToCategory(dragged.identifier.editor, category, dragged.identifier.groupId);
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
		this.focusCategory(nextCategory);
	}

	private focusCategory(category: PreviewCategory): void {
		const tab = this.tabs.get(category);
		if (!tab) {
			return;
		}

		// Keep the roving tab stop in sync even in hosts where programmatic focus
		// does not dispatch a focus event synchronously.
		this.focusedCategory = category;
		this.updateTabStops();
		tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		tab.focus();
	}

	private updateActiveTab(): void {
		const active = this.previewCategoryService.activeCategory;
		for (const [category, tab] of this.tabs) {
			const isSelected = category === active;
			tab.classList.toggle('selected', isSelected);
			tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
		}
		if (!this.element.contains(this.element.ownerDocument.activeElement)) {
			this.focusedCategory = active;
		}
		this.updateTabStops();
		this.updateHints();
	}

	private updateTabStops(): void {
		const tabStop = this.focusedCategory ?? this.previewCategoryService.activeCategory;
		for (const [category, tab] of this.tabs) {
			tab.tabIndex = category === tabStop ? 0 : -1;
		}
	}

	private updateCounts(counts: IPreviewCategoryCounts): void {
		for (const [category, badge] of this.badges) {
			const count = counts[category] ?? 0;
			const tab = this.tabs.get(category);
			if (count > 0 && tab) {
				badge.textContent = `${count}`;
				badge.style.display = '';
				tab.classList.add('has-count');
			} else if (tab) {
				badge.textContent = '';
				badge.style.display = 'none';
				tab.classList.remove('has-count');
			}
			this.updateTabAccessibility(category);
		}
		this.scheduleFitCounts();
	}

	/** Drop count text when the tabs no longer fit in their internal scroll viewport. */
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
		if (this.element.clientWidth <= 0) {
			this.element.classList.remove('hide-counts');
			return;
		}
		this.element.classList.remove('hide-counts');
		if (this.element.scrollWidth > this.element.clientWidth) {
			this.element.classList.add('hide-counts');
		}
	}

	private updateHints(): void {
		for (const [category, hint] of this.hints) {
			const show = this.previewCategoryService.hasCategoryHint(category) && category !== this.previewCategoryService.activeCategory;
			hint.style.display = show ? '' : 'none';
			this.updateTabAccessibility(category);
		}
	}

	private updateTabAccessibility(category: PreviewCategory): void {
		const tab = this.tabs.get(category);
		if (!tab) {
			return;
		}
		const label = this.labels.get(category) ?? '';
		const countText = this.badges.get(category)?.textContent ?? '';
		const count = countText ? Number(countText) : 0;
		const showHint = this.previewCategoryService.hasCategoryHint(category) && category !== this.previewCategoryService.activeCategory;
		const baseText = count > 0 ? localize('categoryWithCount', "{0}, {1}", label, count) : label;
		const fullText = showHint ? localize('categoryWithHint', "{0}, unread updates", baseText) : baseText;
		tab.setAttribute('aria-label', fullText);
		tab.title = fullText;
	}
}
