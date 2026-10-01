/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { asArray } from '../../../../base/common/arrays.js';
import { DeferredPromise, isThenable } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { autorun, observableValue } from '../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { isObject } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { localize } from '../../../../nls.js';
import { registerOpenEditorListeners } from '../../../../platform/editor/browser/editor.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { FileKind, IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { AnythingQuickAccessProviderRunOptions } from '../../../../platform/quickinput/common/quickAccess.js';
import { IQuickInputService, IQuickPickItem, IQuickPickItemWithResource, QuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { AbstractGotoSymbolQuickAccessProvider, IGotoSymbolQuickPickItem } from '../../../../editor/contrib/quickAccess/browser/gotoSymbolQuickAccess.js';
import { isLocation } from '../../../../editor/common/languages.js';
import { DEFAULT_LABELS_CONTAINER, ResourceLabels } from '../../../../workbench/browser/labels.js';
import { isEditorInput } from '../../../../workbench/common/editor.js';
import { BrowserEditorInput } from '../../../../workbench/contrib/browserView/common/browserEditorInput.js';
import { ChatConfiguration, isSupportedChatFileScheme } from '../../../../workbench/contrib/chat/common/constants.js';
import { IChatImageCarouselService } from '../../../../workbench/contrib/chat/browser/chatImageCarouselService.js';
import { coerceImageBuffer } from '../../../../workbench/contrib/chat/common/chatImageExtraction.js';
import { IChatRequestVariableEntry, isAgentHostCompletionVariableEntry, isPasteVariableEntry, isPastedTextArtifact, OmittedState } from '../../../../workbench/contrib/chat/common/attachments/chatVariableEntries.js';
import { resizeImage } from '../../../../workbench/contrib/chat/browser/chatImageUtils.js';
import { FileAttachmentWidget, ImageAttachmentWidget, PasteAttachmentWidget, createImageHoverContent, openPastedTextArtifact } from '../../../../workbench/contrib/chat/browser/attachments/chatAttachmentWidgets.js';
import { IChatContextPicker, IChatContextPickerItem, IChatContextPickService, IChatContextValueItem, isChatContextPickerPickItem } from '../../../../workbench/contrib/chat/browser/attachments/chatContextPickService.js';
import { IChatAttachmentResolveService } from '../../../../workbench/contrib/chat/browser/attachments/chatAttachmentResolveService.js';
import { AnythingQuickAccessProvider, type IAnythingQuickPickItem } from '../../../../workbench/contrib/search/browser/anythingQuickAccess.js';
import { SymbolsQuickAccessProvider } from '../../../../workbench/contrib/search/browser/symbolsQuickAccess.js';
import { ADDITIONAL_REPOSITORY_CONTEXT_ID_PREFIX, isAdditionalWorkspaceContextId } from '../common/newChatContextIds.js';

/**
 * The attachment surface of the composer, as seen by its input plumbing
 * (completions, paste). Kept free of rendering so those parts can be used
 * without the pill UI.
 */
export interface INewChatAttachments {
	readonly onDidChangeContext: Event<void>;
	readonly attachments: readonly IChatRequestVariableEntry[];
	setAttachments(entries: readonly IChatRequestVariableEntry[]): void;
	addAttachments(...entries: IChatRequestVariableEntry[]): void;
	removeAttachment(id: string): void;
}

const GITHUB_CONTEXT_ID_PREFIX = 'github-context:';

/** Editor-chat "+" picks contributed through {@link IChatContextPickService}. */
interface IContextPickItemItem extends IQuickPickItem {
	kind: 'contextPick';
	item: IChatContextValueItem | IChatContextPickerItem;
}

/**
 * A context-pick hook can run here only when its signature does not take an
 * {@link IChatWidget}. A stand-in widget is never passed.
 */
function contextPickRequiresWidget(item: IChatContextValueItem | IChatContextPickerItem): boolean {
	if (item.isEnabled && item.isEnabled.length > 0) {
		return true;
	}
	if (item.type === 'valuePick') {
		return item.asAttachment.length > 0;
	}
	return item.asPicker.length > 0;
}

function isIContextPickItemItem(obj: unknown): obj is IContextPickItemItem {
	return isObject(obj)
		&& (obj as IContextPickItemItem).kind === 'contextPick';
}

function isIGotoSymbolQuickPickItem(obj: unknown): obj is IGotoSymbolQuickPickItem {
	return isObject(obj)
		&& typeof (obj as IGotoSymbolQuickPickItem).symbolName === 'string'
		&& !!(obj as IGotoSymbolQuickPickItem).uri
		&& !!(obj as IGotoSymbolQuickPickItem).range;
}

function isIQuickPickItemWithResource(obj: unknown): obj is IQuickPickItemWithResource {
	return isObject(obj)
		&& URI.isUri((obj as IQuickPickItemWithResource).resource);
}

function isAnythingQuickPickItemWithBrowserEditor(obj: unknown): obj is IAnythingQuickPickItem & { readonly editor: NonNullable<IAnythingQuickPickItem['editor']> } {
	const editor = (obj as IAnythingQuickPickItem | undefined)?.editor;
	return editor instanceof BrowserEditorInput || (!!editor && !isEditorInput(editor) && editor.options?.override === BrowserEditorInput.EDITOR_ID);
}

function appendSessionsRemoveButton(disposables: DisposableStore, parent: HTMLElement, entry: IChatRequestVariableEntry, removeAttachment: (id: string) => void): void {
	const removeButton = dom.append(parent, dom.$<HTMLButtonElement>('button.sessions-chat-attachment-remove'));
	removeButton.type = 'button';
	removeButton.title = localize('removeAttachment', "Remove");
	removeButton.setAttribute('aria-label', localize('removeNamedAttachment', "Remove {0}", entry.name));
	const removeIcon = dom.append(removeButton, renderIcon(Codicon.closeCompact));
	removeIcon.setAttribute('aria-hidden', 'true');
	disposables.add(dom.addDisposableListener(removeButton, dom.EventType.KEY_DOWN, e => e.stopPropagation()));
	disposables.add(dom.addDisposableListener(removeButton, dom.EventType.CLICK, e => {
		e.stopPropagation();
		removeAttachment(entry.id);
	}));
}

/**
 * Manages context attachments for the sessions new-chat widget.
 *
 * The attach picker matches the editor chat "+" picker: Anything, Symbols,
 * and Go to Symbol quick access, plus context-pick items that do not need a
 * chat widget. Accepted picks are written with {@link addAttachments}.
 */
export class NewChatContextAttachments extends Disposable implements INewChatAttachments {

	private readonly _attachedContext: IChatRequestVariableEntry[] = [];
	private _container: HTMLElement | undefined;
	private readonly _renderDisposables = this._register(new DisposableStore());

	private readonly _onDidChangeContext = this._register(new Emitter<void>());
	readonly onDidChangeContext = this._onDidChangeContext.event;

	get attachments(): readonly IChatRequestVariableEntry[] {
		return this._attachedContext;
	}

	setAttachments(entries: readonly IChatRequestVariableEntry[]): void {
		this._attachedContext.length = 0;
		this._attachedContext.push(...entries);
		this._updateRendering();
		this._onDidChangeContext.fire();
	}

	private readonly _resourceLabels: ResourceLabels;

	constructor(
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@ITextModelService private readonly textModelService: ITextModelService,
		@IFileService private readonly fileService: IFileService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IChatImageCarouselService private readonly chatImageCarouselService: IChatImageCarouselService,
		@IChatContextPickService private readonly contextPickService: IChatContextPickService,
		@IChatAttachmentResolveService private readonly chatAttachmentResolveService: IChatAttachmentResolveService,
		@ICommandService private readonly commandService: ICommandService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
	) {
		super();
		this._resourceLabels = this._register(this.instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER));
	}

	// --- Rendering ---

	renderAttachedContext(container: HTMLElement): void {
		this._container = container;
		this._updateRendering();
	}

	private _updateRendering(): void {
		if (!this._container) {
			return;
		}

		this._renderDisposables.clear();
		this._resourceLabels.clear();
		dom.clearNode(this._container);

		const visibleAttachments = this._attachedContext.filter(entry => !isAgentHostCompletionVariableEntry(entry));
		if (visibleAttachments.length === 0) {
			this._container.style.display = 'none';
			return;
		}

		this._container.style.display = '';
		this._container.classList.add('show-file-icons');

		// Local so a harness can call `_updateRendering` without the helper on `this`.
		// GitHub links and additional workspace roots stay on the sessions pill:
		// the shared widgets would open a different target.
		const container = this._container;
		const renderSharedAttachment = (entry: IChatRequestVariableEntry): boolean => {
			if (entry.id.startsWith(GITHUB_CONTEXT_ID_PREFIX) || isAdditionalWorkspaceContextId(entry.id)) {
				return false;
			}
			// Folders stay on the sessions pill. FileAttachmentWidget reveals them
			// in the explorer; this row opens them with IOpenerService.
			if (entry.kind === 'directory') {
				return false;
			}

			const resource = URI.isUri(entry.value) ? entry.value : isLocation(entry.value) ? entry.value.uri : undefined;
			const range = isLocation(entry.value) ? entry.value.range : undefined;
			const deletion = { shouldFocusClearButton: false, supportsDeletion: true };
			let widget: FileAttachmentWidget | ImageAttachmentWidget | PasteAttachmentWidget | undefined;
			if (resource && entry.kind === 'file') {
				widget = this.instantiationService.createInstance(FileAttachmentWidget, resource, range, entry, undefined, undefined, deletion, container, this._resourceLabels);
			} else if (entry.kind === 'image') {
				widget = this.instantiationService.createInstance(ImageAttachmentWidget, resource, entry, undefined, { ...deletion, isCurrentInput: true }, container, this._resourceLabels);
			} else if (isPasteVariableEntry(entry)) {
				widget = this.instantiationService.createInstance(PasteAttachmentWidget, entry, undefined, deletion, container, this._resourceLabels);
			}
			if (!widget) {
				return false;
			}

			this._renderDisposables.add(widget);
			this._renderDisposables.add(widget.onDidDelete(() => this.removeAttachment(entry.id)));
			// FileAttachmentWidget skips its clear button when attachment.range is set.
			// The sessions pill always had a remove control; put it back if the widget did not.
			if (!widget.element.querySelector('.monaco-button:not(.chat-attached-context-download-button)')) {
				appendSessionsRemoveButton(this._renderDisposables, widget.element, entry, id => this.removeAttachment(id));
			}
			return true;
		};

		for (const entry of visibleAttachments) {
			if (renderSharedAttachment(entry)) {
				continue;
			}
			const pill = dom.append(this._container, dom.$('.sessions-chat-attachment-pill'));
			const resource = URI.isUri(entry.value) ? entry.value : isLocation(entry.value) ? entry.value.uri : undefined;
			const githubContextResource = entry.id.startsWith(GITHUB_CONTEXT_ID_PREFIX)
				? URI.parse(entry.id.slice(GITHUB_CONTEXT_ID_PREFIX.length))
				: undefined;
			const openResource = resource ?? githubContextResource;
			const imageData = entry.kind === 'image' ? coerceImageBuffer(entry.value) : undefined;
			const canOpen = Boolean(imageData || openResource || isPastedTextArtifact(entry));
			let content: HTMLElement;
			if (canOpen) {
				const openButton = dom.append(pill, dom.$<HTMLButtonElement>('button.sessions-chat-attachment-open'));
				openButton.type = 'button';
				openButton.setAttribute('aria-label', localize('openNamedAttachment', "Open {0}", entry.name));
				content = openButton;
				pill.classList.add('openable');
			} else {
				content = dom.append(pill, dom.$('span.sessions-chat-attachment-content'));
			}
			if (entry.kind === 'image') {
				const icon = dom.append(content, renderIcon(Codicon.fileMedia));
				dom.append(content, dom.$('span.sessions-chat-attachment-name', undefined, entry.name));
				if (imageData) {
					// Swap the generic icon for a thumbnail once the shared helper
					// has decoded one, matching the workbench attachment pill.
					const preview = createImageHoverContent(resource, entry.name, imageData, entry.id, undefined, undefined, (url, isThumbnail) => {
						if (isThumbnail) {
							icon.replaceWith(dom.$('img.sessions-chat-attachment-image', { src: url, alt: '' }));
						}
					});
					this._renderDisposables.add(preview.disposable);
				}
			} else if (entry.id.startsWith(ADDITIONAL_REPOSITORY_CONTEXT_ID_PREFIX)) {
				const icon = dom.append(content, renderIcon(Codicon.repo));
				icon.setAttribute('aria-hidden', 'true');
				dom.append(content, dom.$('span.sessions-chat-attachment-name', undefined, entry.name));
			} else {
				const label = this._resourceLabels.create(content, { supportIcons: true });
				this._renderDisposables.add(label);
				if (resource) {
					label.setFile(resource, {
						fileKind: entry.kind === 'directory' ? FileKind.FOLDER : FileKind.FILE,
						hidePath: true,
					});
				} else if (isPastedTextArtifact(entry)) {
					// Matches the workbench paste pill: a file icon for the artifact's
					// language, and how much text it stands in for.
					label.setLabel(entry.fileName, undefined, { extraClasses: ['file-icon', `${entry.language}-lang-file-icon`] });
					dom.append(content, dom.$('span.sessions-chat-attachment-info', undefined, localize('pastedLines', "Pasted {0}", entry.pastedLines)));
				} else {
					label.setLabel(entry.name);
				}
			}

			// Click to open the resource or image
			if (imageData) {
				this._renderDisposables.add(registerOpenEditorListeners(content, async () => {
					if (this.configurationService.getValue<boolean>(ChatConfiguration.ImageCarouselEnabled)) {
						const imageResource = resource ?? URI.from({ scheme: 'data', path: entry.name });
						await this.chatImageCarouselService.openCarouselAtResource(imageResource, imageData);
					} else if (resource) {
						await this.openerService.open(resource, { fromUserGesture: true });
					}
				}));
			} else if (openResource) {
				this._renderDisposables.add(registerOpenEditorListeners(content, async () => {
					await this.openerService.open(openResource, { fromUserGesture: true });
				}));
			} else if (isPastedTextArtifact(entry)) {
				this._renderDisposables.add(registerOpenEditorListeners(content, async () => {
					await this.instantiationService.invokeFunction(openPastedTextArtifact, entry);
				}));
			}

			appendSessionsRemoveButton(this._renderDisposables, pill, entry, id => this.removeAttachment(id));
		}
	}

	// --- Picker ---

	/**
	 * `_folderUri` is the composer's selected folder. This picker matches the
	 * editor chat attach picker, which searches the workbench workspace.
	 */
	showPicker(_folderUri?: URI): void {
		void this._showAttachPicker();
	}

	private async _showAttachPicker(): Promise<void> {
		try {
			const additionPicks = await this._collectContextPicks();
			if (!this._store.isDisposed) {
				this._showAttachQuickAccess(additionPicks);
			}
		} catch (error) {
			onUnexpectedError(error);
		}
	}

	private async _collectContextPicks(): Promise<IContextPickItemItem[]> {
		const picks: IContextPickItemItem[] = [];
		for (const item of this.contextPickService.items) {
			if (contextPickRequiresWidget(item)) {
				continue;
			}
			if (item.isEnabled && !await (item.isEnabled as () => Promise<boolean> | boolean)()) {
				continue;
			}
			picks.push({
				kind: 'contextPick',
				item,
				label: item.label,
				iconClass: ThemeIcon.asClassName(item.icon),
				keybinding: item.commandId ? this.keybindingService.lookupKeybinding(item.commandId, this.contextKeyService) : undefined,
			});
		}
		return picks;
	}

	private _showAttachQuickAccess(additionPicks: readonly IContextPickItemItem[]): void {
		const providerOptions: AnythingQuickAccessProviderRunOptions = {
			filter: (pick) => {
				if (isIQuickPickItemWithResource(pick) && pick.resource) {
					return this.instantiationService.invokeFunction(accessor => isSupportedChatFileScheme(accessor, pick.resource!.scheme));
				}
				return true;
			},
			additionPicks: [...additionPicks],
			handleAccept: (item, isBackgroundAccept) => {
				return this._acceptAttachPick(item, isBackgroundAccept, additionPicks);
			},
		};

		this.quickInputService.quickAccess.show('', {
			enabledProviderPrefixes: [
				AnythingQuickAccessProvider.PREFIX,
				SymbolsQuickAccessProvider.PREFIX,
				AbstractGotoSymbolQuickAccessProvider.PREFIX,
			],
			placeholder: localize('sessions.chatContext.attach.placeholder', "Search attachments"),
			providerOptions,
		});
	}

	private async _acceptAttachPick(item: IQuickPickItem | undefined, _isBackgroundAccept: boolean, additionPicks: readonly IContextPickItemItem[]): Promise<void> {
		try {
			if (!item || this._store.isDisposed) {
				return;
			}
			if (isIContextPickItemItem(item)) {
				let isDone = true;
				if (item.item.type === 'valuePick') {
					await this._handleContextValuePick(item.item);
				} else {
					isDone = await this._handleContextPickerItem(item.item);
				}
				if (!isDone && !this._store.isDisposed) {
					this._showAttachQuickAccess(additionPicks);
				}
				return;
			}
			await this._handleQPPick(item);
		} catch (error) {
			onUnexpectedError(error);
		}
	}

	private async _handleQPPick(pick: IQuickPickItem): Promise<void> {
		const toAttach: IChatRequestVariableEntry[] = [];

		if (isAnythingQuickPickItemWithBrowserEditor(pick)) {
			const entry = await this.chatAttachmentResolveService.resolveEditorAttachContext(pick.editor);
			if (entry) {
				toAttach.push(entry);
			}
		} else if (isIQuickPickItemWithResource(pick) && pick.resource) {
			if (/\.(png|jpg|jpeg|bmp|gif|tiff)$/i.test(pick.resource.path)) {
				const readFile = await this.fileService.readFile(pick.resource);
				const resizedImage = await resizeImage(readFile.value.buffer);
				toAttach.push({
					id: pick.resource.toString(),
					name: pick.label,
					fullName: pick.label,
					value: resizedImage,
					kind: 'image',
					references: [{ reference: pick.resource, kind: 'reference' }],
				});
			} else if (pick.resource.scheme === Schemas.vscodeBrowser) {
				const entry = await this.chatAttachmentResolveService.resolveEditorAttachContext({ resource: pick.resource });
				if (entry) {
					toAttach.push(entry);
				}
			} else {
				let omittedState = OmittedState.NotOmitted;
				try {
					const createdModel = await this.textModelService.createModelReference(pick.resource);
					createdModel.dispose();
				} catch {
					omittedState = OmittedState.Full;
				}
				toAttach.push({
					kind: 'file',
					id: pick.resource.toString(),
					value: pick.resource,
					name: pick.label,
					omittedState,
				});
			}
		} else if (isIGotoSymbolQuickPickItem(pick) && pick.uri && pick.range) {
			toAttach.push({
				kind: 'generic',
				id: JSON.stringify({ uri: pick.uri, range: pick.range.decoration }),
				value: { uri: pick.uri, range: pick.range.decoration },
				fullName: pick.label,
				name: pick.symbolName!,
			});
		}

		if (this._store.isDisposed || toAttach.length === 0) {
			return;
		}
		this._addAttachments(...toAttach);
	}

	private async _handleContextValuePick(item: IChatContextValueItem): Promise<void> {
		if (item.asAttachment.length > 0) {
			return;
		}
		const value = await (item.asAttachment as () => Promise<IChatRequestVariableEntry | IChatRequestVariableEntry[] | undefined>)();
		if (!value || this._store.isDisposed) {
			return;
		}
		this._addAttachments(...asArray(value));
	}

	private async _handleContextPickerItem(item: IChatContextPickerItem): Promise<boolean> {
		if (item.asPicker.length > 0) {
			return true;
		}
		const pickerConfig = (item.asPicker as () => IChatContextPicker)();
		const store = new DisposableStore();
		const cts = new CancellationTokenSource();
		store.add(toDisposable(() => cts.dispose(true)));
		try {
			const goBackItem: IQuickPickItem = {
				label: localize('goBack', "Go back ↩"),
				alwaysShow: true,
			};
			const configureItem = pickerConfig.configure ? {
				label: pickerConfig.configure.label,
				commandId: pickerConfig.configure.commandId,
				alwaysShow: true,
			} : undefined;
			const extraPicks: QuickPickItem[] = [{ type: 'separator' }];
			if (configureItem) {
				extraPicks.push(configureItem);
			}
			extraPicks.push(goBackItem);

			const qp = store.add(this.quickInputService.createQuickPick({ useSeparators: true }));
			store.add(qp.onDidHide(() => cts.cancel()));

			qp.placeholder = pickerConfig.placeholder;
			qp.matchOnDescription = true;
			qp.matchOnDetail = true;
			qp.canAcceptInBackground = true;
			qp.busy = true;
			qp.show();

			if (isThenable(pickerConfig.picks)) {
				const items = await pickerConfig.picks.then(value => ([] as QuickPickItem[]).concat(value, extraPicks));
				if (cts.token.isCancellationRequested || this._store.isDisposed) {
					pickerConfig.dispose?.();
					return true;
				}
				qp.items = items;
				qp.busy = false;
			} else {
				const query = observableValue<string>('attachContext.query', qp.value);
				store.add(qp.onDidChangeValue(() => query.set(qp.value, undefined)));
				const picksObservable = pickerConfig.picks(query, cts.token);
				store.add(autorun(reader => {
					const { busy, picks } = picksObservable.read(reader);
					qp.items = ([] as QuickPickItem[]).concat(picks, extraPicks);
					qp.busy = busy;
				}));
			}

			if (cts.token.isCancellationRequested || this._store.isDisposed) {
				pickerConfig.dispose?.();
				return true;
			}

			const defer = new DeferredPromise<boolean>();
			const addPromises: Promise<void>[] = [];
			store.add(qp.onDidAccept(e => {
				const [selected] = qp.selectedItems;
				if (isChatContextPickerPickItem(selected)) {
					const attachment = selected.asAttachment();
					if (!attachment || attachment === 'noop') {
						return;
					}
					const apply = (value: IChatRequestVariableEntry | IChatRequestVariableEntry[] | 'noop') => {
						if (value === 'noop' || this._store.isDisposed) {
							return;
						}
						this._addAttachments(...asArray(value));
					};
					if (isThenable(attachment)) {
						addPromises.push(attachment.then(apply));
					} else {
						apply(attachment);
					}
				}
				if (selected === goBackItem) {
					if (pickerConfig.goBack?.()) {
						return;
					}
					defer.complete(false);
				}
				if (configureItem && selected === configureItem) {
					defer.complete(true);
					void this.commandService.executeCommand(configureItem.commandId);
				}
				if (!e.inBackground) {
					defer.complete(true);
				}
			}));
			store.add(qp.onDidHide(() => {
				defer.complete(true);
				pickerConfig.dispose?.();
			}));

			const result = await defer.p;
			qp.busy = true;
			await Promise.all(addPromises);
			return result;
		} finally {
			store.dispose();
		}
	}

	// --- State management ---

	addAttachments(...entries: IChatRequestVariableEntry[]): void {
		this._addAttachments(...entries);
	}

	private _addAttachments(...entries: IChatRequestVariableEntry[]): void {
		for (const entry of entries) {
			if (!this._attachedContext.some(e => e.id === entry.id)) {
				this._attachedContext.push(entry);
			}
		}
		this._updateRendering();
		this._onDidChangeContext.fire();
	}

	removeAttachment(id: string): void {
		const index = this._attachedContext.findIndex(e => e.id === id);
		if (index >= 0) {
			this._attachedContext.splice(index, 1);
			this._updateRendering();
			this._onDidChangeContext.fire();
		}
	}

	clear(): void {
		this._attachedContext.length = 0;
		this._updateRendering();
		this._onDidChangeContext.fire();
	}
}
