/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { GroupIdentifier } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IConversationEditorPart, IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { ConversationChatInput } from '../common/conversationChatInput.js';
import { isConversationDiffReviewInput } from '../../../common/editor/conversationDiffReviewInput.js';
import { isConversationExtensionTab } from '../common/conversationEditorRouting.js';
import { CONVERSATION_CLOSE_CHILD_ON_BACK_SETTING } from '../common/conversationNavigation.js';
import { IConversationSessionChatService, IConversationSubAgentDialogChange } from '../common/conversationSessionChat.js';

export const IConversationNavigationService = createDecorator<IConversationNavigationService>('conversationNavigationService');

interface IConversationNavigationEntry {
	readonly groupId: GroupIdentifier;
	readonly editor: EditorInput;
	/** Set while this history step is the sub-agent overlay. Maximize does not add a step. */
	readonly subAgentChatId?: string;
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
		if (current && current.groupId === entry.groupId && current.editor === entry.editor && current.subAgentChatId === entry.subAgentChatId) {
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

	/** Drop overlay steps. Used when the user dismisses the dialog (× / Esc / mask / close non-root). */
	removeSubAgentEntries(): void {
		const previousLength = this.stack.length;
		let removedThroughIndex = 0;
		const filtered: IConversationNavigationEntry[] = [];
		for (let i = 0; i < this.stack.length; i++) {
			const entry = this.stack[i];
			if (entry.subAgentChatId) {
				if (i <= this.index) {
					removedThroughIndex++;
				}
				continue;
			}
			filtered.push(entry);
		}
		if (filtered.length === previousLength) {
			return;
		}

		this.stack.length = 0;
		this.stack.push(...filtered);
		this.index -= removedThroughIndex;
		if (this.stack.length === 0) {
			this.index = -1;
		} else if (this.index >= this.stack.length) {
			this.index = this.stack.length - 1;
		}
		this._onDidChange.fire();
	}

	/** Breadcrumb back to the root: sit on the editor under the dialog so Forward can reopen it. */
	retreatPastSubAgent(): void {
		if (this.current?.subAgentChatId && !this.canGoBack()) {
			this.removeSubAgentEntries();
			return;
		}
		if (!this.current?.subAgentChatId) {
			return;
		}
		while (this.current?.subAgentChatId && this.canGoBack()) {
			this.index--;
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
		@INotificationService private readonly notificationService: INotificationService,
		@IConversationSessionChatService private readonly sessionChatService: IConversationSessionChatService,
	) {
		super();
		this._register(this.sessionChatService.onDidChangeSubAgentDialog(event => this.onSubAgentDialog(event)));
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
		if (activeEditor && this.isNavigationEditor(activeEditor)) {
			stack.push({ groupId: part.activeGroup.id, editor: activeEditor });
			const openChatId = this.sessionChatService.getOpenSubAgentDialogChatId(part.sessionKey);
			if (openChatId) {
				stack.push({ groupId: part.activeGroup.id, editor: activeEditor, subAgentChatId: openChatId });
			}
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

		const destination = stack.peekPrevious();
		if (!destination) {
			return;
		}

		const leaving = stack.current;
		stack.moveBack();

		stack.navigating = true;
		try {
			const scopedEditorService = this.getScopedEditorService(targetPart);
			// Registry default is true. An unset value must not leave the dialog open.
			const closeChildOnBack = this.configurationService.getValue<boolean>(CONVERSATION_CLOSE_CHILD_ON_BACK_SETTING) !== false;
			const leavingDialog = !!leaving?.subAgentChatId;

			if (destination.subAgentChatId) {
				if (!leavingDialog && closeChildOnBack && leaving && isConversationExtensionTab(leaving.editor)) {
					await scopedEditorService.closeEditor({ editor: leaving.editor, groupId: leaving.groupId });
				}
				await this.restoreDialogEntry(targetPart, destination);
				return;
			}

			if (leavingDialog) {
				if (closeChildOnBack) {
					this.sessionChatService.closeSubAgentDialog(targetPart.sessionKey);
				}
				if (destination.editor !== targetPart.activeGroup.activeEditor) {
					await this.openNavigationDestination(targetPart, destination);
				}
				return;
			}

			if (closeChildOnBack && leaving && isConversationExtensionTab(leaving.editor)) {
				await scopedEditorService.closeEditor({ editor: leaving.editor, groupId: leaving.groupId });
				try {
					await this.openNavigationDestination(targetPart, destination);
				} catch (openError) {
					// `leaving` is already closed. moveForward must not put the stack back on it.
					this.notificationService.error(getErrorMessage(openError));
				}
			} else {
				await targetPart.activeGroup.openEditor(destination.editor);
			}
		} catch (error) {
			stack.moveForward();
			this.notificationService.error(getErrorMessage(error));
		} finally {
			stack.navigating = false;
		}
	}

	private async openNavigationDestination(part: IConversationEditorPart, destination: IConversationNavigationEntry): Promise<void> {
		const group = part.getGroup(destination.groupId);
		if (!group) {
			throw new Error(`Conversation navigation destination group ${destination.groupId} is not available`);
		}
		await group.openEditor(destination.editor);
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

		const destination = stack.peekNext();
		if (!destination) {
			return;
		}

		stack.moveForward();

		stack.navigating = true;
		try {
			if (destination.subAgentChatId) {
				await this.restoreDialogEntry(targetPart, destination);
			} else {
				if (this.sessionChatService.isSubAgentDialogOpen(targetPart.sessionKey)) {
					this.sessionChatService.closeSubAgentDialog(targetPart.sessionKey);
				}
				await targetPart.activeGroup.openEditor(destination.editor);
			}
		} catch (error) {
			stack.moveBack();
			this.notificationService.error(getErrorMessage(error));
		} finally {
			stack.navigating = false;
		}
	}

	private async restoreDialogEntry(part: IConversationEditorPart, destination: IConversationNavigationEntry): Promise<void> {
		if (destination.editor !== part.activeGroup.activeEditor) {
			await this.openNavigationDestination(part, destination);
		}
		if (destination.subAgentChatId) {
			await this.sessionChatService.openSubAgent(part.sessionKey, destination.subAgentChatId);
		}
	}

	private onSubAgentDialog(event: IConversationSubAgentDialogChange): void {
		const part = this.partForSession(event.sessionKey);
		const stack = part ? this.stacks.get(part) : undefined;
		if (!part || !stack || stack.navigating) {
			return;
		}
		if (event.kind === 'show') {
			const editor = this.editorForDialogEntry(part);
			if (!editor || !event.chatId) {
				return;
			}
			stack.push({ groupId: part.activeGroup.id, editor, subAgentChatId: event.chatId });
			return;
		}
		if (event.kind === 'dismiss') {
			stack.removeSubAgentEntries();
			return;
		}
		stack.retreatPastSubAgent();
	}

	private partForSession(sessionKey: string): IConversationEditorPart | undefined {
		for (const part of this.stacks.keys()) {
			if (part.sessionKey === sessionKey) {
				return part;
			}
		}
		return undefined;
	}

	private editorForDialogEntry(part: IConversationEditorPart): EditorInput | undefined {
		const active = part.activeGroup.activeEditor;
		if (active && this.isNavigationEditor(active)) {
			return active;
		}
		return this.stacks.get(part)?.current?.editor;
	}

	private isNavigationEditor(editor: EditorInput): boolean {
		return editor instanceof ConversationChatInput || isConversationDiffReviewInput(editor);
	}

	private resolvePart(part?: IConversationEditorPart): IConversationEditorPart | undefined {
		return part ?? this.editorGroupsService.getActiveConversationEditorPart();
	}

	private getScopedEditorService(part: IConversationEditorPart): IEditorService {
		return this.editorGroupsService.getScopedInstantiationService(part).invokeFunction(accessor => accessor.get(IEditorService));
	}
}
