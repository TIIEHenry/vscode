/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, clearNode, h } from '../../../../base/browser/dom.js';
import { KeybindingLabel } from '../../../../base/browser/ui/keybindingLabel/keybindingLabel.js';
import { coalesce, shuffle } from '../../../../base/common/arrays.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { isMacintosh, isWeb, OS } from '../../../../base/common/platform.js';
import { localize } from '../../../../nls.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { HiddenItemStrategy, MenuWorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, ContextKeyExpression, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IStorageService, StorageScope, StorageTarget, WillSaveStateReason } from '../../../../platform/storage/common/storage.js';
import { defaultKeybindingLabelStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { getEditorGroupWatermarkTips, IEditorGroupWatermarkTipsSession, IPreviewCategoryEmptyState, previewTerminalLocalCommandId } from '../../../services/editor/common/editorGroupWatermarkTips.js';
import { IPreviewCategoryService, PreviewCategory } from '../../../services/editor/common/previewCategoryService.js';

interface WatermarkEntry {
	readonly id: string;
	readonly text: string;
	readonly when?: {
		native?: ContextKeyExpression;
		web?: ContextKeyExpression;
	};
}

const showCommands: WatermarkEntry = { text: localize('watermark.showCommands', "Show All Commands"), id: 'workbench.action.showCommands' };
const gotoFile: WatermarkEntry = { text: localize('watermark.quickAccess', "Go to File"), id: 'workbench.action.quickOpen' };
const openFile: WatermarkEntry = { text: localize('watermark.openFile', "Open File"), id: 'workbench.action.files.openFile' };
const openFolder: WatermarkEntry = { text: localize('watermark.openFolder', "Open Folder"), id: 'workbench.action.files.openFolder' };
const openFileOrFolder: WatermarkEntry = { text: localize('watermark.openFileFolder', "Open File or Folder"), id: 'workbench.action.files.openFileFolder' };
const openRecent: WatermarkEntry = { text: localize('watermark.openRecent', "Open Recent"), id: 'workbench.action.openRecent' };
const newUntitledFile: WatermarkEntry = { text: localize('watermark.newUntitledFile', "New Untitled Text File"), id: 'workbench.action.files.newUntitledFile' };
const findInFiles: WatermarkEntry = { text: localize('watermark.findInFiles', "Find in Files"), id: 'workbench.action.findInFiles' };
const toggleTerminal: WatermarkEntry = { text: localize({ key: 'watermark.toggleTerminal', comment: ['toggle is a verb here'] }, "Toggle Terminal"), id: 'workbench.action.terminal.toggleTerminal', when: { web: ContextKeyExpr.equals('terminalProcessSupported', true) } };
const startDebugging: WatermarkEntry = { text: localize('watermark.startDebugging', "Start Debugging"), id: 'workbench.action.debug.start', when: { web: ContextKeyExpr.equals('terminalProcessSupported', true) } };
const openSettings: WatermarkEntry = { text: localize('watermark.openSettings', "Open Settings"), id: 'workbench.action.openSettings' };

const baseEntries: WatermarkEntry[] = [
	showCommands,
];

const emptyWindowEntries: WatermarkEntry[] = coalesce([
	...baseEntries,
	openRecent,
	...(isMacintosh && !isWeb ? [openFileOrFolder] : [openFile, openFolder]),
	isMacintosh && !isWeb ? newUntitledFile : undefined, // fill in one more on macOS to get to 5 entries
]);

const workspaceEntries: WatermarkEntry[] = [
	...baseEntries,
];

const otherEntries: WatermarkEntry[] = [
	gotoFile,
	findInFiles,
	startDebugging,
	toggleTerminal,
	openSettings,
];

/** @internal Exported for unit tests — primary watermark action ids (no Copilot Chat). */
export function getEditorGroupWatermarkEntryActionIds(): readonly string[] {
	const entries = [...emptyWindowEntries, ...workspaceEntries, ...otherEntries];
	return entries.map(entry => entry.id);
}

/** Shown when no tips contribution is registered, or it does not know the category. */
const defaultCategoryEmptyState: IPreviewCategoryEmptyState = {
	icon: 'symbol-misc',
	title: localize('previewEmpty.default.title', "No Preview Content"),
	description: localize('previewEmpty.default.desc', "Select an item to preview or start a task in the conversation panel."),
	actions: [],
};

/**
 * Same command as the Terminal empty-state button, opened in `viewColumn`.
 * The command is chosen by the registered watermark tips; without them it is
 * the local editor terminal.
 */
export async function executePreviewTerminalEmptyState(accessor: ServicesAccessor, viewColumn: number): Promise<void> {
	const commandService = accessor.get(ICommandService);
	const tips = getEditorGroupWatermarkTips();
	const commandId = tips ? await tips.resolveTerminalEmptyStateCommand(accessor) : previewTerminalLocalCommandId;
	await commandService.executeCommand(commandId, {
		location: { viewColumn },
	});
}

export class EditorGroupWatermark extends Disposable {

	private static readonly CACHED_WHEN = 'editorGroupWatermark.whenConditions';
	private static readonly SETTINGS_KEY = 'workbench.tips.enabled';
	private static readonly MINIMUM_ENTRIES = 3;

	private readonly cachedWhen: { [when: string]: boolean };

	private readonly shortcuts: HTMLElement;
	private readonly toolbarContainer: HTMLElement;
	private readonly transientDisposables = this._register(new DisposableStore());
	private readonly keybindingLabels = this._register(new DisposableStore());

	private readonly tips: IEditorGroupWatermarkTipsSession | undefined;

	private enabled = false;
	private workbenchState: WorkbenchState;

	constructor(
		container: HTMLElement,
		private readonly previewCategoryEmpty: boolean,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IStorageService private readonly storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IPreviewCategoryService private readonly previewCategoryService: IPreviewCategoryService,
		@ICommandService private readonly commandService: ICommandService
	) {
		super();

		this.cachedWhen = this.storageService.getObject(EditorGroupWatermark.CACHED_WHEN, StorageScope.PROFILE, Object.create(null));
		this.workbenchState = this.contextService.getWorkbenchState();

		const elements = h('.editor-group-watermark-wrapper', [
			h('.editor-group-watermark-toolbar-container@toolbarContainer'),
			h('.editor-group-watermark', [
				h('.watermark-container', [
					h('.letterpress'),
					h('.shortcuts@shortcuts'),
				])
			])
		]);

		append(container, elements.root);
		this.shortcuts = elements.shortcuts;
		this.toolbarContainer = elements.toolbarContainer;

		this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, this.toolbarContainer, MenuId.EditorGroupWatermarkToolbar, {
			hiddenItemStrategy: HiddenItemStrategy.NoHide,
			highlightToggledItems: true,
			menuOptions: { shouldForwardArgs: true }
		}));

		// Created before the first render, so the tips are settled when the empty state is first drawn.
		if (this.previewCategoryEmpty) {
			this.tips = getEditorGroupWatermarkTips()?.createSession(this.instantiationService, () => this.render());
			if (this.tips) {
				this._register(this.tips);
			}
		}

		this.registerListeners();

		this.render();
	}

	private registerListeners(): void {
		if (this.previewCategoryEmpty) {
			this._register(this.previewCategoryService.onDidChangeCategory(() => {
				this.render();
			}));
			this._register(this.previewCategoryService.onDidChangeCategoryCounts(() => {
				this.render();
			}));
		}

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (
				e.affectsConfiguration(EditorGroupWatermark.SETTINGS_KEY) &&
				this.enabled !== this.configurationService.getValue<boolean>(EditorGroupWatermark.SETTINGS_KEY)
			) {
				this.render();
			}
		}));

		this._register(this.contextService.onDidChangeWorkbenchState(workbenchState => {
			if (this.workbenchState !== workbenchState) {
				this.workbenchState = workbenchState;
				this.render();
			}
		}));

		this._register(this.storageService.onWillSaveState(e => {
			if (e.reason === WillSaveStateReason.SHUTDOWN) {
				const entries = [...emptyWindowEntries, ...workspaceEntries, ...otherEntries];
				for (const entry of entries) {
					const when = isWeb ? entry.when?.web : entry.when?.native;
					if (when) {
						this.cachedWhen[entry.id] = this.contextKeyService.contextMatchesRules(when);
					}
				}

				this.storageService.store(EditorGroupWatermark.CACHED_WHEN, JSON.stringify(this.cachedWhen), StorageScope.PROFILE, StorageTarget.MACHINE);
			}
		}));
	}

	private categoryEditorCount(category: PreviewCategory): number {
		return this.previewCategoryService.getCategoryCounts()[category] ?? 0;
	}

	private getCategoryEmptyState(category: PreviewCategory): IPreviewCategoryEmptyState {
		return this.tips?.getCategoryEmptyState(category) ?? defaultCategoryEmptyState;
	}

	private render(): void {
		if (this._store.isDisposed) {
			return;
		}

		this.enabled = this.configurationService.getValue<boolean>(EditorGroupWatermark.SETTINGS_KEY);

		clearNode(this.shortcuts);
		this.transientDisposables.clear();
		this.keybindingLabels.clear();
		this.shortcuts.parentElement?.querySelector('.preview-category-empty-state')?.remove();

		const category = this.previewCategoryEmpty ? this.previewCategoryService.activeCategory : undefined;
		if (category && this.categoryEditorCount(category) === 0) {
			const emptyCard = append(this.shortcuts.parentElement ?? this.shortcuts, $('.preview-category-empty-state'));
			const emptyState = this.getCategoryEmptyState(category);
			const icon = append(emptyCard, $('div.preview-category-empty-icon.codicon.codicon-' + emptyState.icon));
			icon.setAttribute('aria-hidden', 'true');
			const title = append(emptyCard, $('div.preview-category-empty-title'));
			title.textContent = emptyState.title;
			const desc = append(emptyCard, $('div.preview-category-empty-desc'));
			desc.textContent = emptyState.description;

			const actions = emptyState.actions;
			if (actions.length > 0) {
				const actionsContainer = append(emptyCard, $('.preview-category-empty-actions'));
				for (const action of actions) {
					const btn = append(actionsContainer, $('button.preview-category-empty-action-button.monaco-button')) as HTMLButtonElement;
					btn.type = 'button';
					const btnIcon = append(btn, $(`span.preview-category-empty-action-icon.codicon.codicon-${action.icon}`));
					btnIcon.setAttribute('aria-hidden', 'true');
					const btnLabel = append(btn, $('span.preview-category-empty-action-label'));
					btnLabel.textContent = action.label;

					const commandId = action.id;
					if (commandId) {
						const keybinding = this.keybindingService.lookupKeybinding(commandId);
						if (keybinding) {
							const keybindingLabel = append(btn, $('span.preview-category-empty-action-keybinding'));
							this.keybindingLabels.add(new KeybindingLabel(keybindingLabel, OS, {
								renderUnboundKeybindings: false,
								...defaultKeybindingLabelStyles,
								keybindingLabelBackground: 'transparent',
								keybindingLabelBorder: 'transparent',
								keybindingLabelBottomBorder: 'transparent',
								keybindingLabelShadow: 'transparent',
							})).set(keybinding);
						}
					}

					this.transientDisposables.add(addDisposableListener(btn, 'click', event => {
						// The second click of a double-click must not run the action again.
						// The group listener would otherwise also open an untitled file.
						if (event instanceof MouseEvent && event.detail > 1) {
							return;
						}
						if (commandId) {
							void this.commandService.executeCommand(commandId);
							return;
						}
						void this.tips?.runPendingTerminalEmptyState();
					}));
				}
			}

			this.transientDisposables.add(this.keybindingService.onDidUpdateKeybindings(() => this.render()));
			return;
		}

		if (!this.enabled) {
			return;
		}

		const entries = this.filterEntries(this.workbenchState !== WorkbenchState.EMPTY ? workspaceEntries : emptyWindowEntries);
		if (entries.length < EditorGroupWatermark.MINIMUM_ENTRIES) {
			const additionalEntries = this.filterEntries(otherEntries);
			shuffle(additionalEntries);
			entries.push(...additionalEntries.slice(0, EditorGroupWatermark.MINIMUM_ENTRIES - entries.length));
		}

		const box = append(this.shortcuts, $('.watermark-box'));

		const update = () => {
			clearNode(box);
			this.keybindingLabels.clear();

			for (const entry of entries) {
				const keys = this.keybindingService.lookupKeybinding(entry.id);
				if (!keys) {
					continue;
				}

				const dl = append(box, $('dl'));
				const dt = append(dl, $('dt'));
				dt.textContent = entry.text;

				const dd = append(dl, $('dd'));

				const label = this.keybindingLabels.add(new KeybindingLabel(dd, OS, { renderUnboundKeybindings: true, ...defaultKeybindingLabelStyles }));
				label.set(keys);
			}
		};

		update();
		this.transientDisposables.add(this.keybindingService.onDidUpdateKeybindings(update));
	}

	private filterEntries(entries: WatermarkEntry[]): WatermarkEntry[] {
		const filteredEntries = entries
			.filter(entry => {
				if (this.cachedWhen[entry.id]) {
					return true; // cached from previous session
				}

				const contextKey = isWeb ? entry.when?.web : entry.when?.native;
				return !contextKey /* works without context */ || this.contextKeyService.contextMatchesRules(contextKey);
			})
			.filter(entry => !!CommandsRegistry.getCommand(entry.id))
			.filter(entry => !!this.keybindingService.lookupKeybinding(entry.id));

		return filteredEntries;
	}
}
