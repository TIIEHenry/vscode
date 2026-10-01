/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { decodeBase64 } from '../../../../../base/common/buffer.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { DisposableStore, IDisposable, IReference } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { isLocation } from '../../../../../editor/common/languages.js';
import { ITextModel } from '../../../../../editor/common/model.js';
import { IResolvedTextEditorModel } from '../../../../../editor/common/services/resolverService.js';
import { AbstractGotoSymbolQuickAccessProvider } from '../../../../../editor/contrib/quickAccess/browser/gotoSymbolQuickAccess.js';
import { ChatMode } from '../../../../../workbench/contrib/chat/common/chatModes.js';
import { Context as SuggestContext } from '../../../../../editor/contrib/suggest/browser/suggest.js';
import { hasSendableNewChatContent, implicitContextValueForEditor, newChatEnterYieldsToSuggest, NewChatInputWidget, resolveComposerChatMode } from '../../browser/newChatInput.js';
import { FileAttachmentWidget, ImageAttachmentWidget, PasteAttachmentWidget } from '../../../../../workbench/contrib/chat/browser/attachments/chatAttachmentWidgets.js';
import { IChatRequestVariableEntry, OmittedState, toPasteVariableEntry } from '../../../../../workbench/contrib/chat/common/attachments/chatVariableEntries.js';
import { AnythingQuickAccessProvider } from '../../../../../workbench/contrib/search/browser/anythingQuickAccess.js';
import { SymbolsQuickAccessProvider } from '../../../../../workbench/contrib/search/browser/symbolsQuickAccess.js';
import { NewChatContextAttachments } from '../../browser/newChatContextAttachments.js';
import { getAdditionalFolderContextId, getAdditionalRepositoryContextId } from '../../common/newChatContextIds.js';

interface IInputModelReferenceHarness {
	readonly _store: DisposableStore;
	readonly textModelService: {
		createModelReference(resource: URI): Promise<IReference<IResolvedTextEditorModel>>;
	};
	readonly logService: {
		error(message: string, error: Error): void;
	};
	_register<T extends IDisposable>(disposable: T): T;
}

const holdInputModelReference = Reflect.get(NewChatInputWidget.prototype, '_holdInputModelReference') as (this: IInputModelReferenceHarness, uri: URI, model: ITextModel) => void;
const getDraftState = Reflect.get(NewChatInputWidget.prototype, '_getDraftState') as (this: IDraftStateHarness) => { inputText: string; attachments: readonly IChatRequestVariableEntry[] } | undefined;
const restoreState = Reflect.get(NewChatInputWidget.prototype, '_restoreState') as (this: IRestoreStateHarness) => void;
const saveState = Reflect.get(NewChatInputWidget.prototype, 'saveState') as (this: IDraftStateHarness) => void;
const updateAttachmentRendering = Reflect.get(NewChatContextAttachments.prototype, '_updateRendering') as (this: IAttachmentRenderingHarness) => void;

interface IDraftStateHarness {
	readonly storageService: {
		get(key: string, scope: unknown): string | undefined;
		store(key: string, value: string, scope: unknown, target: unknown): void;
	};
	_draftState?: { inputText: string; attachments: readonly IChatRequestVariableEntry[] };
}

interface IRestoreStateHarness {
	_getDraftState(): { inputText: string; attachments: readonly IChatRequestVariableEntry[] } | undefined;
	readonly _editor: {
		getModel(): { setValue(value: string): void } | null;
	};
	readonly _contextAttachments: {
		setAttachments(entries: readonly IChatRequestVariableEntry[]): void;
	};
}

interface IAttachmentRenderingHarness {
	readonly _container: HTMLElement;
	readonly _attachedContext: readonly IChatRequestVariableEntry[];
	readonly _renderDisposables: DisposableStore;
	readonly _resourceLabels: {
		clear(): void;
		create(container: HTMLElement, options: { supportIcons: boolean }): IDisposable & {
			setLabel(label: string): void;
			setFile(resource: URI, options: object): void;
		};
	};
	readonly openerService: {
		open(resource: URI): Promise<boolean>;
	};
	readonly instantiationService?: {
		createInstance(ctor: unknown, ...args: unknown[]): {
			readonly element: HTMLElement;
			onDidDelete(listener: () => void): IDisposable;
			dispose(): void;
		};
	};
	removeAttachment(id: string): void;
}

class InputModelReferenceHarness implements IInputModelReferenceHarness, IDisposable {
	readonly _store = new DisposableStore();

	constructor(
		readonly textModelService: IInputModelReferenceHarness['textModelService'],
		readonly logService: IInputModelReferenceHarness['logService'],
	) { }

	_register<T extends IDisposable>(disposable: T): T {
		return this._store.add(disposable);
	}

	dispose(): void {
		this._store.dispose();
	}
}

suite('NewChatInputWidget', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('keeps the input model alive until reference acquisition settles during disposal', async () => {
		const referenceDeferred = new DeferredPromise<IReference<IResolvedTextEditorModel>>();
		let modelDisposed = false;
		let referenceDisposed = false;
		const errors: { message: string; error: Error }[] = [];
		const model = new class extends mock<ITextModel>() {
			override dispose(): void {
				modelDisposed = true;
			}
		}();
		const resolvedModel = new class extends mock<IResolvedTextEditorModel>() {
			override readonly textEditorModel = model;
		}();
		const harness = disposables.add(new InputModelReferenceHarness(
			{
				createModelReference: () => referenceDeferred.p,
			},
			{
				error: (message, error) => errors.push({ message, error }),
			},
		));

		holdInputModelReference.call(harness, URI.from({ scheme: Schemas.sessionsChatInput, path: 'input-test' }), model);
		harness.dispose();
		const disposedBeforeReferenceSettled = modelDisposed;

		referenceDeferred.complete({
			object: resolvedModel,
			dispose: () => {
				referenceDisposed = true;
				model.dispose();
			},
		});
		await referenceDeferred.p;
		await Promise.resolve();

		assert.deepStrictEqual({
			disposedBeforeReferenceSettled,
			modelDisposed,
			referenceDisposed,
			errors,
		}, {
			disposedBeforeReferenceSettled: false,
			modelDisposed: true,
			referenceDisposed: true,
			errors: [],
		});
	});

	test('Enter yields to suggest only when a focused item would be accepted', () => {
		const read = (keys: Record<string, unknown>) => (key: string) => keys[key];
		const accepting = {
			[SuggestContext.Visible.key]: true,
			[SuggestContext.HasFocusedSuggestion.key]: true,
			[SuggestContext.MakesTextEdit.key]: true,
			[SuggestContext.AcceptSuggestionsOnEnter.key]: true,
		};

		assert.strictEqual(newChatEnterYieldsToSuggest(read(accepting)), true);
		assert.strictEqual(newChatEnterYieldsToSuggest(read({
			...accepting,
			[SuggestContext.HasFocusedSuggestion.key]: false,
		})), false, 'empty or unfocused suggest list must not swallow Enter');
		assert.strictEqual(newChatEnterYieldsToSuggest(read({
			...accepting,
			[SuggestContext.Visible.key]: false,
		})), false);
		assert.strictEqual(newChatEnterYieldsToSuggest(read({
			...accepting,
			[SuggestContext.MakesTextEdit.key]: false,
		})), false);
		assert.strictEqual(newChatEnterYieldsToSuggest(read({
			...accepting,
			[SuggestContext.AcceptSuggestionsOnEnter.key]: false,
		})), false);
		assert.strictEqual(newChatEnterYieldsToSuggest(read({
			[SuggestContext.Visible.key]: true,
			[SuggestContext.HasFocusedSuggestion.key]: true,
		})), true, 'unset accept and text-edit keys keep Monaco defaults');
	});

	test('treats an additional folder pill as sendable content without prompt text', () => {
		const folder = URI.file('/workspace/docs');
		const attachment: IChatRequestVariableEntry = {
			kind: 'directory',
			id: getAdditionalFolderContextId(folder),
			name: 'docs',
			value: folder,
		};

		assert.deepStrictEqual({
			empty: hasSendableNewChatContent('', []),
			additionalFolder: hasSendableNewChatContent('', [attachment]),
		}, {
			empty: false,
			additionalFolder: true,
		});
	});

	test('persists and restores additional folder and repository context with URI values', () => {
		let stored: string | undefined;
		const storageService: IDraftStateHarness['storageService'] = {
			get: () => stored,
			store: (_key, value) => stored = value,
		};
		const folder = URI.file('/workspace/docs');
		const repositoryRoot = URI.parse('vscode-vfs://github/microsoft/typescript/HEAD');
		const attachments: IChatRequestVariableEntry[] = [
			{
				kind: 'directory',
				id: getAdditionalFolderContextId(folder),
				name: 'docs',
				value: folder,
			},
			{
				kind: 'generic',
				id: getAdditionalRepositoryContextId(URI.parse('https://github.com/microsoft/typescript')),
				name: 'microsoft/typescript',
				value: repositoryRoot,
			},
		];
		const saveHarness: IDraftStateHarness = {
			storageService,
			_draftState: { inputText: 'Fix this', attachments },
		};
		saveState.call(saveHarness);
		const restored: { inputText?: string; attachments?: readonly IChatRequestVariableEntry[] } = {};
		const draft = getDraftState.call({ storageService });

		restoreState.call({
			_getDraftState: () => draft,
			_editor: { getModel: () => ({ setValue: value => restored.inputText = value }) },
			_contextAttachments: { setAttachments: entries => restored.attachments = entries },
		});

		assert.deepStrictEqual({
			inputText: restored.inputText,
			attachmentIds: restored.attachments?.map(attachment => attachment.id),
			folderValue: restored.attachments?.[0].value,
			repositoryValue: restored.attachments?.[1].value,
		}, {
			inputText: 'Fix this',
			attachmentIds: attachments.map(attachment => attachment.id),
			folderValue: folder,
			repositoryValue: repositoryRoot,
		});
	});

	test('renders GitHub context pills as openable with a keyboard-reachable remove button', async () => {
		const container = document.createElement('div');
		const entry = toPasteVariableEntry('microsoft/vscode#332825', 'GitHub context: https://github.com/microsoft/vscode/pull/332825', {
			id: 'github-context:https://github.com/microsoft/vscode/pull/332825',
		});
		let removed: string | undefined;
		let opened: string | undefined;
		const renderDisposables = disposables.add(new DisposableStore());
		updateAttachmentRendering.call({
			_container: container,
			_attachedContext: [entry],
			_renderDisposables: renderDisposables,
			_resourceLabels: {
				clear: () => { },
				create: () => ({
					dispose: () => { },
					setLabel: () => { },
					setFile: () => { },
				}),
			},
			openerService: {
				open: async resource => {
					opened = resource.toString();
					return true;
				},
			},
			removeAttachment: id => removed = id,
		});
		const removeButton = container.querySelector<HTMLButtonElement>('.sessions-chat-attachment-remove');
		const pill = container.querySelector<HTMLElement>('.sessions-chat-attachment-pill');
		const openButton = container.querySelector<HTMLButtonElement>('.sessions-chat-attachment-open');
		let bubbledKeyDown = false;
		pill?.addEventListener('keydown', () => bubbledKeyDown = true);
		removeButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		openButton?.click();
		await Promise.resolve();
		removeButton?.click();

		assert.deepStrictEqual({
			pillRole: pill?.getAttribute('role'),
			pillTabIndex: pill?.tabIndex,
			openTagName: openButton?.tagName,
			openAriaLabel: openButton?.getAttribute('aria-label'),
			tagName: removeButton?.tagName,
			tabIndex: removeButton?.tabIndex,
			ariaLabel: removeButton?.getAttribute('aria-label'),
			bubbledKeyDown,
			opened,
			removed,
		}, {
			pillRole: null,
			pillTabIndex: -1,
			openTagName: 'BUTTON',
			openAriaLabel: 'Open microsoft/vscode#332825',
			tagName: 'BUTTON',
			tabIndex: 0,
			ariaLabel: 'Remove microsoft/vscode#332825',
			bubbledKeyDown: false,
			opened: 'https://github.com/microsoft/vscode/pull/332825',
			removed: entry.id,
		});
	});

	test('renders additional folder and repository context as attachment pills', () => {
		const container = document.createElement('div');
		const folder = URI.file('/workspace/docs');
		const repositoryRoot = URI.parse('vscode-vfs://github/microsoft/typescript/HEAD');
		const entries: readonly IChatRequestVariableEntry[] = [
			{
				kind: 'directory',
				id: getAdditionalFolderContextId(folder),
				name: 'docs',
				value: folder,
			},
			{
				kind: 'generic',
				id: getAdditionalRepositoryContextId(URI.parse('https://github.com/microsoft/typescript')),
				name: 'microsoft/typescript',
				value: repositoryRoot,
			},
		];
		const renderDisposables = disposables.add(new DisposableStore());
		updateAttachmentRendering.call({
			_container: container,
			_attachedContext: entries,
			_renderDisposables: renderDisposables,
			_resourceLabels: {
				clear: () => { },
				create: pill => ({
					dispose: () => { },
					setLabel: label => pill.textContent = label,
					setFile: (_resource, _options) => pill.textContent = 'docs',
				}),
			},
			openerService: { open: async () => true },
			removeAttachment: () => { },
		});

		assert.deepStrictEqual(
			Array.from(container.querySelectorAll<HTMLElement>('.sessions-chat-attachment-pill')).map(pill => ({
				text: pill.textContent,
				removeAriaLabel: pill.querySelector('.sessions-chat-attachment-remove')?.getAttribute('aria-label'),
			})),
			[
				{ text: 'docs', removeAriaLabel: 'Remove docs' },
				{ text: 'microsoft/typescript', removeAriaLabel: 'Remove microsoft/typescript' },
			],
		);
	});

	test('implicit context uses the active editor and skips the composer', () => {
		const file = URI.file('/workspace/src/app.ts');
		const selection = { isEmpty: false, range: new Range(2, 1, 2, 8) };
		const withSelection = implicitContextValueForEditor(file, selection);
		const fileOnly = implicitContextValueForEditor(file, { isEmpty: true, range: new Range(1, 1, 1, 1) });

		assert.deepStrictEqual(implicitContextValueForEditor(undefined, undefined), { value: undefined, isSelection: false });
		assert.strictEqual(implicitContextValueForEditor(URI.from({ scheme: Schemas.sessionsChatInput, path: '/composer' }), undefined).value, undefined);
		assert.strictEqual(implicitContextValueForEditor(URI.from({ scheme: Schemas.vscodeSettings, path: '/settings' }), undefined).value, undefined);
		assert.strictEqual(implicitContextValueForEditor(URI.file('/workspace/AGENTS.copilotmd'), undefined).value, undefined);
		assert.strictEqual(withSelection.isSelection, true);
		assert.ok(isLocation(withSelection.value) && withSelection.value.uri.toString() === file.toString());
		assert.strictEqual(fileOnly.isSelection, false);
		assert.strictEqual(fileOnly.value, file);
	});

	test('tools mode resolves builtin ids and omits an unset mode', () => {
		let lookedUp: string | undefined;
		const custom = ChatMode.Agent;
		assert.strictEqual(resolveComposerChatMode(undefined, () => { throw new Error('unset mode must not be looked up'); }), undefined);
		assert.strictEqual(resolveComposerChatMode({ id: ChatMode.Agent.id, kind: ChatMode.Agent.id }, () => { throw new Error('builtin mode must not be looked up'); }), ChatMode.Agent);
		assert.strictEqual(resolveComposerChatMode({ id: ChatMode.Ask.id, kind: ChatMode.Ask.id }, () => undefined), ChatMode.Ask);
		assert.strictEqual(resolveComposerChatMode({ id: ChatMode.Edit.id, kind: ChatMode.Edit.id }, () => undefined), ChatMode.Edit);
		assert.strictEqual(resolveComposerChatMode({ id: 'missing', kind: 'agent' }, id => { lookedUp = id; return undefined; }), undefined);
		assert.strictEqual(lookedUp, 'missing');
		assert.strictEqual(resolveComposerChatMode({ id: 'custom', kind: 'agent' }, id => id === 'custom' ? custom : undefined), custom);
	});

	test('renders file, image, and paste attachments, and keeps a remove control on a ranged file', () => {
		const container = document.createElement('div');
		const folder = URI.file('/workspace/logs');
		const plainFile: IChatRequestVariableEntry = {
			kind: 'file',
			id: 'file-plain',
			name: 'readme.md',
			value: URI.file('/workspace/readme.md'),
		};
		const rangedFile: IChatRequestVariableEntry = {
			kind: 'file',
			id: 'file-ranged',
			name: 'src.ts',
			value: URI.file('/workspace/src.ts'),
			range: { start: 0, endExclusive: 12 },
		};
		const locatedFile: IChatRequestVariableEntry = {
			kind: 'file',
			id: 'file-located',
			name: 'located.ts',
			value: {
				uri: URI.file('/workspace/located.ts'),
				range: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 5 },
			},
		};
		const image: IChatRequestVariableEntry = {
			kind: 'image',
			id: 'image-shot',
			name: 'shot.png',
			value: new Uint8Array([1, 2, 3]),
		};
		const paste = toPasteVariableEntry('snippet.ts', 'const x = 1;', {
			id: 'paste-snippet',
			fileName: 'snippet.ts',
			language: 'typescript',
		});
		const directory: IChatRequestVariableEntry = {
			kind: 'directory',
			id: folder.toString(),
			name: 'logs',
			value: folder,
		};
		const created: { widget: string; id: string }[] = [];
		let removed: string | undefined;
		let opened: string | undefined;
		const renderDisposables = disposables.add(new DisposableStore());
		updateAttachmentRendering.call({
			_container: container,
			_attachedContext: [plainFile, rangedFile, locatedFile, image, paste, directory],
			_renderDisposables: renderDisposables,
			_resourceLabels: {
				clear: () => { },
				create: parent => ({
					dispose: () => { },
					setLabel: () => { },
					setFile: resource => { parent.textContent = resource.path.split('/').pop() ?? ''; },
				}),
			},
			openerService: {
				open: async resource => {
					opened = resource.toString();
					return true;
				},
			},
			instantiationService: {
				createInstance: (ctor, ...args) => {
					const entry = ctor === FileAttachmentWidget
						? args[2] as IChatRequestVariableEntry
						: ctor === ImageAttachmentWidget
							? args[1] as IChatRequestVariableEntry
							: args[0] as IChatRequestVariableEntry;
					const element = document.createElement('div');
					element.className = 'chat-attached-context-attachment';
					element.dataset.attachmentId = entry.id;
					container.appendChild(element);
					created.push({
						widget: ctor === FileAttachmentWidget ? 'file' : ctor === ImageAttachmentWidget ? 'image' : ctor === PasteAttachmentWidget ? 'paste' : 'other',
						id: entry.id,
					});
					// FileAttachmentWidget skips its clear button when the prompt offset range is set.
					if (!(ctor === FileAttachmentWidget && entry.range)) {
						const clearButton = document.createElement('a');
						clearButton.className = 'monaco-button';
						element.appendChild(clearButton);
					}
					return {
						element,
						onDidDelete: () => ({ dispose() { } }),
						dispose() { },
					};
				},
			},
			removeAttachment: id => { removed = id; },
		});

		const ranged = container.querySelector<HTMLElement>('[data-attachment-id="file-ranged"]');
		const rangedRemove = ranged?.querySelector<HTMLButtonElement>('.sessions-chat-attachment-remove');
		rangedRemove?.click();
		const directoryPill = container.querySelector<HTMLElement>('.sessions-chat-attachment-pill');
		directoryPill?.querySelector<HTMLButtonElement>('.sessions-chat-attachment-open')?.click();

		assert.deepStrictEqual({
			created,
			plainHasWidgetClear: Boolean(container.querySelector('[data-attachment-id="file-plain"] .monaco-button')),
			plainHasSessionsRemove: Boolean(container.querySelector('[data-attachment-id="file-plain"] .sessions-chat-attachment-remove')),
			locatedHasWidgetClear: Boolean(container.querySelector('[data-attachment-id="file-located"] .monaco-button')),
			locatedHasSessionsRemove: Boolean(container.querySelector('[data-attachment-id="file-located"] .sessions-chat-attachment-remove')),
			imageRendered: Boolean(container.querySelector('[data-attachment-id="image-shot"]')),
			pasteRendered: Boolean(container.querySelector('[data-attachment-id="paste-snippet"]')),
			rangedRemoveTag: rangedRemove?.tagName,
			rangedRemoveAria: rangedRemove?.getAttribute('aria-label'),
			removed,
			directoryPills: container.querySelectorAll('.sessions-chat-attachment-pill').length,
			directoryText: directoryPill?.textContent,
			directoryUsesSharedWidget: Boolean(directoryPill?.querySelector('.chat-attached-context-attachment')),
			opened,
		}, {
			created: [
				{ widget: 'file', id: 'file-plain' },
				{ widget: 'file', id: 'file-ranged' },
				{ widget: 'file', id: 'file-located' },
				{ widget: 'image', id: 'image-shot' },
				{ widget: 'paste', id: 'paste-snippet' },
			],
			plainHasWidgetClear: true,
			plainHasSessionsRemove: false,
			locatedHasWidgetClear: true,
			locatedHasSessionsRemove: false,
			imageRendered: true,
			pasteRendered: true,
			rangedRemoveTag: 'BUTTON',
			rangedRemoveAria: 'Remove src.ts',
			removed: 'file-ranged',
			directoryPills: 1,
			directoryText: 'logs',
			directoryUsesSharedWidget: false,
			opened: folder.toString(),
		});
	});

	test('attach picker offers Anything, Symbols, Go to Symbol, and widget-free context picks', async () => {
		const shows: {
			value: string;
			enabledProviderPrefixes: readonly string[];
			placeholder: string;
			additionPicks: readonly { label: string }[];
			handleAccept(item: object, isBackgroundAccept: boolean): Promise<void>;
		}[] = [];
		const added: IChatRequestVariableEntry[] = [];
		const png = decodeBase64('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
		const picker = Object.create(NewChatContextAttachments.prototype) as {
			showPicker(): void;
			_store: { isDisposed: boolean };
			contextPickService: { items: readonly object[] };
			keybindingService: { lookupKeybinding(): undefined };
			contextKeyService: object;
			instantiationService: { invokeFunction<T>(fn: (accessor: object) => T): T };
			quickInputService: { quickAccess: { show(value: string, options: { enabledProviderPrefixes: readonly string[]; placeholder: string; providerOptions: { additionPicks?: readonly { label: string }[]; handleAccept?(item: object, isBackgroundAccept: boolean): Promise<void> } }): void } };
			fileService: { readFile(resource: URI): Promise<{ value: { buffer: Uint8Array } }> };
			textModelService: { createModelReference(resource: URI): Promise<{ dispose(): void }> };
			chatAttachmentResolveService: { resolveEditorAttachContext(editor: unknown): Promise<undefined> };
			_addAttachments(...entries: IChatRequestVariableEntry[]): void;
		};
		picker._store = { isDisposed: false };
		picker.contextPickService = {
			items: [
				{
					type: 'pickerPick',
					label: 'Files & Folders...',
					icon: Codicon.folder,
					asPicker() {
						return { placeholder: 'Search file or folder by name', picks: Promise.resolve([]) };
					},
				},
				{
					type: 'valuePick',
					label: 'Workspace Note',
					icon: Codicon.file,
					asAttachment: async () => ({ kind: 'generic' as const, id: 'note', name: 'note', value: 'note' }),
				},
				{
					type: 'pickerPick',
					label: 'Tools...',
					icon: Codicon.tools,
					isEnabled(_widget: object) { return true; },
					asPicker(_widget: object) {
						return { placeholder: '', picks: Promise.resolve([]) };
					},
				},
				{
					type: 'pickerPick',
					label: 'Debug Session...',
					icon: Codicon.debug,
					isEnabled() { return true; },
					asPicker(_widget: object) {
						return { placeholder: '', picks: Promise.resolve([]) };
					},
				},
				{
					type: 'valuePick',
					label: 'Terminal',
					icon: Codicon.terminal,
					isEnabled(_widget: object) { return true; },
					async asAttachment(_widget: object) { return undefined; },
				},
				{
					type: 'valuePick',
					label: 'Hidden Value',
					icon: Codicon.file,
					isEnabled() { return false; },
					async asAttachment() { return undefined; },
				},
			],
		};
		picker.keybindingService = { lookupKeybinding: () => undefined };
		picker.contextKeyService = {};
		picker.instantiationService = { invokeFunction: fn => fn({}) };
		picker.quickInputService = {
			quickAccess: {
				show: (value, options) => {
					shows.push({
						value,
						enabledProviderPrefixes: options.enabledProviderPrefixes,
						placeholder: options.placeholder,
						additionPicks: options.providerOptions.additionPicks ?? [],
						handleAccept: (item, isBackgroundAccept) => Promise.resolve(options.providerOptions.handleAccept?.(item, isBackgroundAccept)),
					});
				},
			},
		};
		picker.fileService = { readFile: async () => ({ value: png }) };
		picker.textModelService = { createModelReference: async () => ({ dispose() { } }) };
		picker.chatAttachmentResolveService = { resolveEditorAttachContext: async () => undefined };
		picker._addAttachments = (...entries) => { added.push(...entries); };

		picker.showPicker();
		for (let i = 0; i < 20 && shows.length === 0; i++) {
			await Promise.resolve();
		}
		const shown = shows[0];
		assert.ok(shown, 'attach quick access was not shown');
		const note = shown.additionPicks.find(item => item.label === 'Workspace Note');
		assert.ok(note);
		await shown.handleAccept(note, false);

		const fileUri = URI.file('/workspace/src.ts');
		await shown.handleAccept({ label: 'src.ts', resource: fileUri }, false);

		const symbolUri = URI.file('/workspace/sym.ts');
		const symbolRange = { startLineNumber: 3, startColumn: 1, endLineNumber: 3, endColumn: 8 };
		await shown.handleAccept({
			label: 'MySymbol',
			symbolName: 'MySymbol',
			uri: symbolUri,
			range: { decoration: symbolRange, selection: symbolRange },
		}, false);

		const imageUri = URI.file('/workspace/a.png');
		await shown.handleAccept({ label: 'a.png', resource: imageUri }, false);

		assert.deepStrictEqual({
			value: shown.value,
			prefixes: shown.enabledProviderPrefixes,
			editorPrefixes: [AnythingQuickAccessProvider.PREFIX, SymbolsQuickAccessProvider.PREFIX, AbstractGotoSymbolQuickAccessProvider.PREFIX],
			placeholder: shown.placeholder,
			labels: shown.additionPicks.map(item => item.label),
			noteId: added[0]?.id,
			file: added[1],
			symbolName: added[2]?.name,
			symbolKind: added[2]?.kind,
			symbolValue: added[2]?.value,
			imageKind: added[3]?.kind,
			imageId: added[3]?.id,
		}, {
			value: '',
			prefixes: ['', '#', '@'],
			editorPrefixes: ['', '#', '@'],
			placeholder: 'Search attachments',
			labels: ['Files & Folders...', 'Workspace Note'],
			noteId: 'note',
			file: {
				kind: 'file',
				id: fileUri.toString(),
				value: fileUri,
				name: 'src.ts',
				omittedState: OmittedState.NotOmitted,
			},
			symbolName: 'MySymbol',
			symbolKind: 'generic',
			symbolValue: { uri: symbolUri, range: symbolRange },
			imageKind: 'image',
			imageId: imageUri.toString(),
		});
	});
});
