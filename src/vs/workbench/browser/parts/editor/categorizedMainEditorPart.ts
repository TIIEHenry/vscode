/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $ } from '../../../../base/browser/dom.js';
import { Direction, ISerializedNode, Orientation, Sizing } from '../../../../base/browser/ui/grid/grid.js';
import { GroupIdentifier, GroupModelChangeKind } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IPreviewCategoryService, isPreviewCategory, PREVIEW_CATEGORIES, PreviewCategory } from '../../../services/editor/common/previewCategoryService.js';
import { IPreviewCategoryRoutingPart, PreviewCategorizedContext } from '../../../services/editor/common/previewCategoryRouting.js';
import { EditorGroupLayout, GroupActivationReason, GroupDirection, GroupLayoutArgument, GroupOrientation, GroupsOrder, IEditorGroup, IMergeGroupOptions } from '../../../services/editor/common/editorGroupsService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { IEditorGroupView, IEditorGroupViewOptions, IEditorPartCreationOptions, IEditorPartsView } from './editor.js';
import { IEditorPartUIState, MainEditorPart } from './editorPart.js';
import { IPreviewCategoryBarHost, PreviewCategorySwitcher } from './previewCategorySwitcher.js';

const CATEGORY_BAR_HEIGHT = 28;
const OWNERSHIP_KEY = 'previewCategory.groups';

interface IPreviewCategoryOwnershipMemento {
	'previewCategory.groups'?: Record<string, PreviewCategory>;
}

/**
 * Main window Preview. One editor group belongs to exactly one category.
 * The active category's groups are visible; the others stay in the grid at
 * height 0. Agents, auxiliary, modal, and Conversation parts are not this class.
 */
export class CategorizedMainEditorPart extends MainEditorPart implements IPreviewCategoryRoutingPart, IPreviewCategoryBarHost {

	readonly isPreviewCategoryRoutingPart = true as const;

	private readonly categories = new Map<GroupIdentifier, PreviewCategory>();
	private readonly watchedGroups = new Set<GroupIdentifier>();
	private readonly bar = $('.preview-category-bar');

	private ready = false;
	private disposed = false;
	private applyingVisibility = false;
	private forcedCategory: PreviewCategory | undefined;
	private inheritCategory: PreviewCategory | undefined;

	constructor(
		editorPartsView: IEditorPartsView,
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IConfigurationService configurationService: IConfigurationService,
		@IStorageService storageService: IStorageService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IHostService hostService: IHostService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IPreviewCategoryService private readonly previewCategoryService: IPreviewCategoryService
	) {
		super(editorPartsView, instantiationService, themeService, configurationService, storageService, layoutService, hostService, contextKeyService);

		PreviewCategorizedContext.bindTo(this.scopedContextKeyService).set(true);

		this._register(instantiationService.createInstance(PreviewCategorySwitcher, this.bar, this));
		this._register(this.onDidAddGroup(group => this.onGroupAdded(group)));
		this._register(this.onDidRemoveGroup(group => this.onGroupRemoved(group)));
		this._register(this.previewCategoryService.onDidChangeCategory(event => {
			if (!this.ready || this.applyingVisibility) {
				return;
			}
			this.applyVisibility(event.category);
		}));
	}

	/** This part mounts its own bar. The base header would draw a second one. */
	protected override showsPreviewCategoryBar(): boolean {
		return false;
	}

	protected override createContentArea(parent: HTMLElement, options?: IEditorPartCreationOptions): HTMLElement {
		const content = super.createContentArea(parent, options);
		parent.classList.add('preview-categorized');
		this.container.insertBefore(this.bar, this.container.firstChild);
		this.installCategories();
		return content;
	}

	protected override gridLayoutInsets(): { height: number } {
		return { height: CATEGORY_BAR_HEIGHT };
	}

	protected override isGroupExcludedFromNavigation(group: IEditorGroupView): boolean {
		return !this.isGroupVisible(group);
	}

	protected override pickAdjacentGroup(excluding: IEditorGroupView): IEditorGroupView | undefined {
		const category = this.getGroupCategory(excluding);
		const sameCategory = this.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE).find(group =>
			group !== excluding && this.getGroupCategory(group) === category);
		if (sameCategory) {
			return sameCategory;
		}

		return this.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE).find(group => group !== excluding && this.isGroupVisible(group));
	}

	/**
	 * A layout descriptor describes only the groups the user can see. Hidden
	 * category groups stay out of that rebuild, then go back into the grid.
	 */
	override applyLayout(layout: EditorGroupLayout): void {
		if (!this.ready || !this.gridWidget) {
			super.applyLayout(layout);
			return;
		}

		const hidden = this.getGroups(GroupsOrder.GRID_APPEARANCE).filter(group => !this.isGroupVisible(group));
		if (this.hasMaximizedGroup()) {
			this.unmaximizeGroup();
		}

		const detached: IEditorGroupView[] = [];
		for (const group of hidden) {
			if (this.getGroups(GroupsOrder.GRID_APPEARANCE).length <= 1) {
				break;
			}
			this.gridWidget.removeView(group);
			detached.push(group);
		}

		super.applyLayout(layout);

		const anchor = this.getGroups(GroupsOrder.GRID_APPEARANCE).find(group => !group.disposed);
		if (anchor && this.gridWidget) {
			for (const group of detached) {
				if (group.disposed) {
					continue;
				}
				this.gridWidget.addView(group, Sizing.Distribute, anchor, Direction.Right);
				this.setGroupViewVisible(group, false);
			}
		}

		this.applyVisibility(this.previewCategoryService.activeCategory);
		this.notifyGroupIndexChange();
	}

	/**
	 * Hidden category groups stay in the grid at height 0. Callers such as
	 * `vscode.getEditorLayout` and centered layout should see the groups the
	 * user can see. A single surviving child is lifted so a height-0 sibling
	 * does not read as an extra column, including when that lift returns to
	 * the same axis.
	 */
	override getLayout(): EditorGroupLayout {
		const serializedGrid = this.gridWidget.serialize();
		const orientation = serializedGrid.orientation === Orientation.HORIZONTAL ? GroupOrientation.HORIZONTAL : GroupOrientation.VERTICAL;
		const groups = this.visibleGroupsInLayout(serializedGrid.root, orientation);
		return {
			orientation,
			groups: groups.length > 0 ? groups : [{}]
		};
	}

	private visibleGroupsInLayout(node: ISerializedNode, orientation: GroupOrientation): GroupLayoutArgument[] {
		if (node.type === 'leaf') {
			return node.visible === false ? [] : [{ size: node.size }];
		}

		const orthogonal = orientation === GroupOrientation.HORIZONTAL ? GroupOrientation.VERTICAL : GroupOrientation.HORIZONTAL;
		const groups: GroupLayoutArgument[] = [];
		for (const child of node.data) {
			if (child.visible === false) {
				continue;
			}
			if (child.type === 'leaf') {
				groups.push({ size: child.size });
				continue;
			}

			const nested = this.visibleGroupsInLayout(child, orthogonal);
			if (nested.length === 0) {
				continue;
			}
			if (nested.length === 1) {
				const only = nested[0];
				if (only.groups && only.groups.length > 1) {
					groups.push(...only.groups);
				} else {
					groups.push({ ...only, size: child.size });
				}
				continue;
			}
			groups.push({ size: child.size, groups: nested });
		}
		return groups;
	}

	override applyState(state: IEditorPartUIState | 'empty', options?: IEditorGroupViewOptions): Promise<void> {
		return super.applyState(state, options).then(() => {
			if (!this.disposed) {
				this.adoptExistingGroups();
			}
		});
	}

	override mergeAllGroups(target: IEditorGroupView | GroupIdentifier, options?: IMergeGroupOptions): boolean {
		const targetView = this.assertGroupView(target);
		const category = this.getGroupCategory(targetView);
		let result = true;
		for (const group of this.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
			if (group === targetView || this.getGroupCategory(group) !== category) {
				continue;
			}
			if (!this.mergeGroup(group, targetView, options)) {
				result = false;
			}
		}
		return result;
	}

	protected override notifyGroupIndexChange(): void {
		let index = 0;
		for (const group of super.getGroups(GroupsOrder.GRID_APPEARANCE)) {
			if (this.isGroupVisible(group)) {
				group.notifyIndexChanged(index++);
			}
		}
	}

	override removeGroup(group: IEditorGroupView | GroupIdentifier, preserveFocus?: boolean): void {
		const view = this.assertGroupView(group);
		const category = this.getGroupCategory(view) ?? PreviewCategory.Code;
		if (this.groupsIn(category).length <= 1) {
			return; // each category keeps a root group
		}

		super.removeGroup(view, preserveFocus);
	}

	protected override doSetGroupActive(group: IEditorGroupView, reason?: GroupActivationReason): void {
		if (this.ready && !this.applyingVisibility) {
			const category = this.getGroupCategory(group);
			if (category && category !== this.previewCategoryService.activeCategory) {
				this.applyVisibility(category, group, reason);
				return;
			}
		}

		super.doSetGroupActive(group, reason);
	}

	protected override saveState(): void {
		this.persistOwnership();
		super.saveState();
	}

	override dispose(): void {
		this.disposed = true;
		super.dispose();
	}

	override addGroup(location: IEditorGroup | GroupIdentifier, direction: GroupDirection, groupToCopy?: IEditorGroupView): IEditorGroupView {
		const category = this.forcedCategory
			?? (groupToCopy ? this.getGroupCategory(groupToCopy) : this.getGroupCategory(location))
			?? this.previewCategoryService.activeCategory;
		const previous = this.inheritCategory;
		this.inheritCategory = category;
		try {
			return super.addGroup(location, direction, groupToCopy);
		} finally {
			this.inheritCategory = previous;
		}
	}

	//#region IPreviewCategoryRoutingPart

	isGroupVisible(group: IEditorGroup | GroupIdentifier): boolean {
		if (!this.ready) {
			return true;
		}

		const category = this.getGroupCategory(group);
		if (!category) {
			return true;
		}

		return category === this.previewCategoryService.activeCategory;
	}

	getGroupCategory(group: IEditorGroup | GroupIdentifier): PreviewCategory | undefined {
		const id = typeof group === 'number' ? group : group.id;
		return this.categories.get(id);
	}

	getMostRecentGroup(category: PreviewCategory): IEditorGroup | undefined {
		return this.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE).find(group => this.getGroupCategory(group) === category);
	}

	ensureCategoryGroup(category: PreviewCategory): IEditorGroup {
		const existing = this.getMostRecentGroup(category);
		if (existing) {
			return existing;
		}

		const anchor = this.anchorGroup();
		if (!anchor) {
			throw new Error('No editor group is available for a preview category');
		}

		return this.addGroupInCategory(anchor, GroupDirection.RIGHT, category);
	}

	addGroupInCategory(location: IEditorGroup | GroupIdentifier, direction: GroupDirection, category: PreviewCategory): IEditorGroup {
		this.forcedCategory = category;
		try {
			return this.addGroup(location, direction);
		} finally {
			this.forcedCategory = undefined;
		}
	}

	revealCategory(category: PreviewCategory, group?: IEditorGroup): void {
		const preferred = group && this.getGroupCategory(group) === category ? this.assertGroupView(group) : undefined;
		this.applyVisibility(category, preferred);
	}

	markCategoryHint(category: PreviewCategory): void {
		if (category !== this.previewCategoryService.activeCategory) {
			this.previewCategoryService.setCategoryHint(category, true);
		}
	}

	moveEditorToCategory(editor: EditorInput, category: PreviewCategory, source?: IEditorGroup): void {
		const sourceGroup = source ?? this.groupContaining(editor) ?? this.activeGroup;
		const target = this.ensureCategoryGroup(category);
		if (sourceGroup.id !== target.id) {
			sourceGroup.moveEditor(editor, target);
		}

		this.revealCategory(category, target);
	}

	hasOpenEditors(): boolean {
		return this.groups.some(group => group.count > 0);
	}

	//#endregion

	private installCategories(): void {
		this.ready = true;
		this.adoptExistingGroups();
	}

	private adoptExistingGroups(): void {
		const stored = this.readOwnership();
		const migrating = !stored;
		for (const group of this.groups) {
			const known = stored?.[String(group.id)];
			if (known && isPreviewCategory(known)) {
				this.categories.set(group.id, known);
			} else if (migrating || !this.categories.has(group.id)) {
				this.categories.set(group.id, PreviewCategory.Code);
			}
			this.watchGroup(group);
		}

		for (const category of PREVIEW_CATEGORIES) {
			if (this.groupsIn(category).length === 0) {
				this.ensureCategoryGroup(category);
			}
		}

		this.applyVisibility(this.previewCategoryService.activeCategory);
		this.recomputeCounts();
		this.persistOwnership();
	}

	private onGroupAdded(group: IEditorGroupView): void {
		if (!this.categories.has(group.id)) {
			const category = this.inheritCategory ?? this.previewCategoryService.activeCategory;
			this.categories.set(group.id, category);
			if (this.ready && category !== this.previewCategoryService.activeCategory) {
				this.setGroupViewVisible(group, false);
			}
		}

		this.watchGroup(group);
		if (this.ready) {
			this.recomputeCounts();
			this.persistOwnership();
		}
	}

	private onGroupRemoved(group: IEditorGroupView): void {
		this.watchedGroups.delete(group.id);
		const replacement = this.getGroup(group.id);
		if (replacement && replacement !== group) {
			// applyState reuses the serialized id before remove events resume.
			this.watchGroup(replacement);
			return;
		}

		const category = this.categories.get(group.id);
		this.categories.delete(group.id);
		if (this.disposed || !this.ready) {
			return;
		}

		if (category && this.groupsIn(category).length === 0 && this.anchorGroup()) {
			this.ensureCategoryGroup(category);
		}

		this.recomputeCounts();
		this.persistOwnership();
	}

	private watchGroup(group: IEditorGroupView): void {
		if (this.watchedGroups.has(group.id)) {
			return;
		}

		this.watchedGroups.add(group.id);
		this._register(group.onDidModelChange(event => {
			if (event.kind === GroupModelChangeKind.EDITOR_OPEN || event.kind === GroupModelChangeKind.EDITOR_CLOSE) {
				this.recomputeCounts();
			}
		}));
	}

	private applyVisibility(category: PreviewCategory, preferred?: IEditorGroupView, reason?: GroupActivationReason): void {
		if (!this.gridWidget || this.applyingVisibility) {
			return;
		}

		const alreadyShowing = this.previewCategoryService.activeCategory === category
			&& this.groupsIn(category).length > 0
			&& this.groupsIn(category).every(group => this.isGroupViewVisible(group))
			&& this.groups.every(group => this.getGroupCategory(group) === category || !this.isGroupViewVisible(group));
		if (alreadyShowing) {
			this.previewCategoryService.setCategoryHint(category, false);
			if (preferred && this.activeGroup !== preferred) {
				this.activateGroup(preferred, true, reason);
			}
			return;
		}

		this.applyingVisibility = true;
		try {
			if (this.groupsIn(category).length === 0) {
				this.ensureCategoryGroup(category);
			}

			if (this.hasMaximizedGroup()) {
				this.unmaximizeGroup();
			}

			for (const group of this.groupsIn(category)) {
				this.setGroupViewVisible(group, true);
			}
			for (const group of this.groups) {
				if (this.getGroupCategory(group) !== category) {
					this.setGroupViewVisible(group, false);
				}
			}

			if (this.previewCategoryService.activeCategory !== category) {
				this.previewCategoryService.setActiveCategory(category);
			}
			this.previewCategoryService.setCategoryHint(category, false);

			const target = preferred ?? this.mostRecentView(category);
			if (target) {
				this.activateGroup(target, true, reason);
			}

			this.notifyGroupIndexChange();
			this.persistOwnership();
		} finally {
			this.applyingVisibility = false;
		}
	}

	private recomputeCounts(): void {
		const counts: Record<PreviewCategory, number> = {
			[PreviewCategory.Overview]: 0,
			[PreviewCategory.Terminal]: 0,
			[PreviewCategory.Code]: 0,
			[PreviewCategory.Web]: 0,
			[PreviewCategory.Planning]: 0,
			[PreviewCategory.History]: 0,
			[PreviewCategory.Artifacts]: 0
		};

		for (const group of this.groups) {
			const category = this.getGroupCategory(group) ?? PreviewCategory.Code;
			counts[category] = counts[category] + group.count;
		}

		this.previewCategoryService.setCategoryCounts(counts);
	}

	private groupsIn(category: PreviewCategory): IEditorGroupView[] {
		return this.groups.filter(group => this.getGroupCategory(group) === category);
	}

	private mostRecentView(category: PreviewCategory): IEditorGroupView | undefined {
		return this.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE).find(group => this.getGroupCategory(group) === category);
	}

	private anchorGroup(): IEditorGroupView | undefined {
		if (this.activeGroup && !this.activeGroup.disposed) {
			return this.activeGroup;
		}

		return this.groups.find(group => !group.disposed);
	}

	private groupContaining(editor: EditorInput): IEditorGroup | undefined {
		return this.groups.find(group => group.editors.some(candidate => candidate.matches(editor)));
	}

	private readOwnership(): Record<string, PreviewCategory> | undefined {
		return this.ownershipMemento()[OWNERSHIP_KEY];
	}

	private persistOwnership(): void {
		const groups: Record<string, PreviewCategory> = {};
		for (const [id, category] of this.categories) {
			groups[String(id)] = category;
		}
		this.ownershipMemento()[OWNERSHIP_KEY] = groups;
	}

	private ownershipMemento(): IPreviewCategoryOwnershipMemento {
		return this.getMemento(StorageScope.WORKSPACE, StorageTarget.USER) as IPreviewCategoryOwnershipMemento;
	}
}
