/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { GroupIdentifier } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IConversationEditorPart, IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { ConversationChatInput } from './conversationChatInput.js';
import { isConversationDiffReviewInput } from '../../sources/common/conversationDiffReviewInput.js';
import { isConversationExtensionTab } from '../common/conversationEditorRouting.js';
import { CONVERSATION_CLOSE_CHILD_ON_BACK_SETTING } from '../common/conversationNavigation.js';

export const IConversationNavigationService = createDecorator<IConversationNavigationService>('conversationNavigationService');

interface IConversationNavigationEntry {
	readonly groupId: GroupIdentifier;
	readonly editor: EditorInput;
}

class ConversationNavigationStack {

	private static readonly MAX_SIZE = 50;

	private readonly stack: IConversationNavigationEntry[] = [];
	private index = -1;
	navigating = false;

	private readonly _onDidChange = new Emitter<void>();
	readonly onDidChange = this._onDidChange.event;

	get current(): IConversationNavigationEntry | undefined {
		return this.stack[this.index];
	}

	canGoBack(): boolean {
		return this.index > 0;
	}

	canGoForward(): boolean {
		return this.index >= 0 && this.index < this.stack.length - 1;
	}

	peekPrevious(): IConversationNavigationEntry | undefined {
		return this.stack[this.index - 1];
	}

	peekNext(): IConversationNavigationEntry | undefined {
		return this.stack[this.index + 1];
	}

	push(entry: IConversationNavigationEntry): void {
		if (this.navigating) {
			return;
		}

		const current = this.current;
		if (current && current.groupId === entry.groupId && current.editor === entry.editor) {
			return;
		}

		if (this.index < this.stack.length - 1) {
			this.stack.length = this.index + 1;
		}

		this.stack.push(entry);
		if (this.stack.length > ConversationNavigationStack.MAX_SIZE) {
			this.stack.shift();
		} else {
			this.index++;
		}

		this._onDidChange.fire();
	}

	moveBack(): IConversationNavigationEntry | undefined {
		if (!this.canGoBack()) {
			return undefined;
		}
		this.index--;
		this._onDidChange.fire();
		return this.current;
	}

	moveForward(): IConversationNavigationEntry | undefined {
		if (!this.canGoForward()) {
			return undefined;
		}
		this.index++;
		this._onDidChange.fire();
		return this.current;
	}

	removeEditor(editor: EditorInput): void {
		const previousLength = this.stack.length;
		const filtered = this.stack.filter(entry => entry.editor !== editor);
		if (filtered.length === previousLength) {
			return;
		}

		this.stack.length = 0;
		this.stack.push(...filtered);
		if (this.index >= this.stack.length) {
			this.index = this.stack.length - 1;
		}
		this._onDidChange.fire();
	}

	clear(): void {
		this.stack.length = 0;
		this.index = -1;
		this._onDidChange.fire();
	}

	dispose(): void {
		this._onDidChange.dispose();
	}
}

export interface IConversationNavigationService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeStack: Event<IConversationEditorPart | undefined>;

	registerPart(part: IConversationEditorPart): IDisposable;

	canGoBack(part?: IConversationEditorPart): boolean;
	canGoForward(part?: IConversationEditorPart): boolean;

	goBack(part?: IConversationEditorPart): Promise<void>;
	goForward(part?: IConversationEditorPart): Promise<void>;
}

export class ConversationNavigationService extends Disposable implements IConversationNavigationService {

	declare readonly _serviceBrand: undefined;

	private readonly stacks = new Map<IConversationEditorPart, ConversationNavigationStack>();
	private readonly partDisposables = this._register(new DisposableStore());

	private readonly _onDidChangeStack = this._register(new Emitter<IConversationEditorPart | undefined>());
	readonly onDidChangeStack = this._onDidChangeStack.event;

	constructor(
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super();
	}

	registerPart(part: IConversationEditorPart): IDisposable {
		const disposables = new DisposableStore();
		this.partDisposables.add(disposables);

		const stack = new ConversationNavigationStack();
		this.stacks.set(part, stack);
		disposables.add(stack.onDidChange(() => this._onDidChangeStack.fire(part)));
		disposables.add({ dispose: () => { this.stacks.delete(part); stack.dispose(); } });

		const scopedEditorService = this.getScopedEditorService(part);
		disposables.add(scopedEditorService.onDidActiveEditorChange(() => {
			const editor = part.activeGroup.activeEditor;
			if (editor && (editor instanceof ConversationChatInput || isConversationDiffReviewInput(editor))) {
				stack.push({ groupId: part.activeGroup.id, editor });
			}
		}));

		disposables.add(scopedEditorService.onDidCloseEditor(event => {
			if (event.editor instanceof ConversationChatInput || isConversationDiffReviewInput(event.editor)) {
				stack.removeEditor(event.editor);
			}
		}));

		const activeEditor = part.activeGroup.activeEditor;
		if (activeEditor && (activeEditor instanceof ConversationChatInput || isConversationDiffReviewInput(activeEditor))) {
			stack.push({ groupId: part.activeGroup.id, editor: activeEditor });
		}

		return disposables;
	}

	canGoBack(part?: IConversationEditorPart): boolean {
		const target = this.resolvePart(part);
		return target ? this.stacks.get(target)?.canGoBack() ?? false : false;
	}

	canGoForward(part?: IConversationEditorPart): boolean {
		const target = this.resolvePart(part);
		return target ? this.stacks.get(target)?.canGoForward() ?? false : false;
	}

	async goBack(part?: IConversationEditorPart): Promise<void> {
		const targetPart = this.resolvePart(part);
		if (!targetPart) {
			return;
		}

		const stack = this.stacks.get(targetPart);
		if (!stack?.canGoBack()) {
			return;
		}

		const leaving = stack.current;
		stack.moveBack();
		const destination = stack.current;
		if (!destination) {
			return;
		}

		stack.navigating = true;
		try {
			const scopedEditorService = this.getScopedEditorService(targetPart);
			const closeChildOnBack = this.configurationService.getValue<boolean>(CONVERSATION_CLOSE_CHILD_ON_BACK_SETTING);

			if (closeChildOnBack && leaving && isConversationExtensionTab(leaving.editor)) {
				await scopedEditorService.closeEditor({ editor: leaving.editor, groupId: leaving.groupId });
			} else {
				await targetPart.activeGroup.openEditor(destination.editor);
			}
		} finally {
			stack.navigating = false;
		}
	}

	async goForward(part?: IConversationEditorPart): Promise<void> {
		const targetPart = this.resolvePart(part);
		if (!targetPart) {
			return;
		}

		const stack = this.stacks.get(targetPart);
		if (!stack?.canGoForward()) {
			return;
		}

		stack.moveForward();
		const destination = stack.current;
		if (!destination) {
			return;
		}

		stack.navigating = true;
		try {
			await targetPart.activeGroup.openEditor(destination.editor);
		} finally {
			stack.navigating = false;
		}
	}

	private resolvePart(part?: IConversationEditorPart): IConversationEditorPart | undefined {
		return part ?? this.editorGroupsService.getActiveConversationEditorPart();
	}

	private getScopedEditorService(part: IConversationEditorPart): IEditorService {
		return this.editorGroupsService.getScopedInstantiationService(part).invokeFunction(accessor => accessor.get(IEditorService));
	}
}
