/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener, EventHelper, isHTMLElement } from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { RawContextKey, IContextKey, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ConversationVisibleContext } from '../../../common/contextkeys.js';
import { EditorsOrder } from '../../../common/editor.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IConversationSessionChatService } from './conversationSessionChatService.js';

/** True only while the Conversation part itself has keyboard focus. */
export const ConversationPartFocusContext = new RawContextKey<boolean>('conversationPartFocus', false, localize('conversationPartFocus', "Whether the Conversation part has keyboard focus"));

const conversationKeybindingWhen = ConversationPartFocusContext;
const conversationKeybindingWeight = KeybindingWeight.WorkbenchContrib + 10;

class ConversationPartFocusTracker extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationPartFocus';

	private readonly conversationPartFocus: IContextKey<boolean>;

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
	) {
		super();
		this.conversationPartFocus = ConversationPartFocusContext.bindTo(contextKeyService);
		this.refresh();
		this._register(addDisposableListener(mainWindow.document, 'focusin', () => this.refresh(), true));
		this._register(addDisposableListener(mainWindow.document, 'focusout', () => this.refresh(), true));
	}

	private refresh(): void {
		this.conversationPartFocus.set(this.layoutService.hasFocus(Parts.CONVERSATION_PART));
	}
}

class ConversationChatTablistKeyboard extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationChatTablistKeyboard';

	constructor(
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
	) {
		super();
		this._register(addDisposableListener(mainWindow.document, 'keydown', event => this.onTablistKey(event, 'down'), true));
		this._register(addDisposableListener(mainWindow.document, 'keyup', event => this.onTablistKey(event, 'up'), true));
	}

	private onTablistKey(e: KeyboardEvent, phase: 'down' | 'up'): void {
		if (!this.layoutService.hasFocus(Parts.CONVERSATION_PART) || !isConversationChatTablistTarget(e.target)) {
			return;
		}

		const event = new StandardKeyboardEvent(e);
		let delta: 1 | -1 | 'home' | 'end' | undefined;
		if (event.equals(KeyCode.RightArrow) || event.equals(KeyCode.DownArrow)) {
			delta = 1;
		} else if (event.equals(KeyCode.LeftArrow) || event.equals(KeyCode.UpArrow)) {
			delta = -1;
		} else if (event.equals(KeyCode.Home)) {
			delta = 'home';
		} else if (event.equals(KeyCode.End)) {
			delta = 'end';
		}
		if (delta === undefined) {
			return;
		}

		EventHelper.stop(e, true);
		if (phase === 'up') {
			return;
		}

		const tablistHost = e.target;
		void cycleSameConversationChatTablist(this.editorGroupsService, delta).then(() => {
			focusActiveConversationChatTab(tablistHost);
		});
	}
}

registerWorkbenchContribution2(ConversationPartFocusTracker.ID, ConversationPartFocusTracker, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ConversationChatTablistKeyboard.ID, ConversationChatTablistKeyboard, WorkbenchPhase.AfterRestored);

const conversationChatTablistSelector = '.conversation-editor-part-host .tabs-container[role="tablist"]';

function isConversationChatTablistTarget(target: EventTarget | null): target is HTMLElement {
	if (!isHTMLElement(target)) {
		return false;
	}
	if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
		return false;
	}
	return !!target.closest(conversationChatTablistSelector);
}

function cycleSameConversationChatTablist(editorGroupsService: IEditorGroupsService, delta: 1 | -1 | 'home' | 'end'): Promise<void> {
	const part = editorGroupsService.getActiveConversationEditorPart();
	if (!part) {
		return Promise.resolve();
	}

	const group = part.groups.includes(part.activeGroup) && !part.isGroupHidden(part.activeGroup)
		? part.activeGroup
		: part.groups.find(candidate => !part.isGroupHidden(candidate) && candidate.count > 0);
	if (!group) {
		return Promise.resolve();
	}

	const editors = group.getEditors(EditorsOrder.SEQUENTIAL);
	if (editors.length === 0) {
		return Promise.resolve();
	}

	const activeIndex = group.activeEditor ? editors.indexOf(group.activeEditor) : -1;
	let nextIndex: number;
	if (delta === 'home') {
		nextIndex = 0;
	} else if (delta === 'end') {
		nextIndex = editors.length - 1;
	} else {
		nextIndex = activeIndex < 0
			? (delta > 0 ? 0 : editors.length - 1)
			: (activeIndex + delta + editors.length) % editors.length;
	}
	const target = editors[nextIndex];
	if (!target || target === group.activeEditor) {
		return Promise.resolve();
	}
	return group.openEditor(target, { preserveFocus: true }).then(() => undefined);
}

function focusActiveConversationChatTab(from: HTMLElement): void {
	const tablist = from.closest(conversationChatTablistSelector);
	const activeTab = tablist?.querySelector('.tab.active') as HTMLElement | null;
	activeTab?.focus();
}

function cycleConversationChatTab(editorGroupsService: IEditorGroupsService, delta: 1 | -1): Promise<void> {
	const part = editorGroupsService.getActiveConversationEditorPart();
	if (!part) {
		return Promise.resolve();
	}

	const groups = part.groups.filter(group => !part.isGroupHidden(group) && group.count > 0);
	if (groups.length === 0) {
		return Promise.resolve();
	}

	const activeGroup = groups.includes(part.activeGroup) ? part.activeGroup : groups[0];
	const editors = activeGroup.getEditors(EditorsOrder.SEQUENTIAL);
	const activeIndex = activeGroup.activeEditor ? editors.indexOf(activeGroup.activeEditor) : -1;
	const nextIndex = activeIndex + delta;
	if (nextIndex >= 0 && nextIndex < editors.length) {
		return activeGroup.openEditor(editors[nextIndex]).then(() => undefined);
	}

	const groupIndex = groups.indexOf(activeGroup);
	const nextGroup = groups[(groupIndex + delta + groups.length) % groups.length];
	if (!nextGroup) {
		return Promise.resolve();
	}
	const nextEditors = nextGroup.getEditors(EditorsOrder.SEQUENTIAL);
	const target = delta > 0 ? nextEditors[0] : nextEditors[nextEditors.length - 1];
	if (!target) {
		return Promise.resolve();
	}
	return nextGroup.openEditor(target).then(() => undefined);
}

function conversationPartHasFocus(accessor: ServicesAccessor): boolean {
	return accessor.get(IWorkbenchLayoutService).hasFocus(Parts.CONVERSATION_PART);
}

registerAction2(class ConversationSplitSessionWindowAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.conversation.splitSessionWindow',
			title: localize2('conversationSplitSessionWindow', 'Split Conversation Editor'),
			category: localize2('conversation', 'Conversation'),
			f1: true,
			precondition: ConversationVisibleContext,
			keybinding: {
				weight: conversationKeybindingWeight,
				when: conversationKeybindingWhen,
				primary: KeyMod.CtrlCmd | KeyCode.Backslash,
			},
		});
	}

	override run(accessor: ServicesAccessor): Promise<void> {
		if (!conversationPartHasFocus(accessor)) {
			return Promise.resolve();
		}
		return accessor.get(IConversationSessionChatService).splitSessionWindow();
	}
});

registerAction2(class ConversationNextChatTabAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.conversation.nextChatTab',
			title: localize2('conversationNextChatTab', 'Open Next Conversation Chat'),
			category: localize2('conversation', 'Conversation'),
			f1: true,
			precondition: ConversationVisibleContext,
			// Q5b: chat tabs reuse workbench.action.nextEditor / previousEditor.
			// Do not bind Ctrl/Cmd+PageUp/PageDown here.
		});
	}

	override run(accessor: ServicesAccessor): Promise<void> {
		if (!conversationPartHasFocus(accessor)) {
			return Promise.resolve();
		}
		return cycleConversationChatTab(accessor.get(IEditorGroupsService), 1);
	}
});

registerAction2(class ConversationPreviousChatTabAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.conversation.previousChatTab',
			title: localize2('conversationPreviousChatTab', 'Open Previous Conversation Chat'),
			category: localize2('conversation', 'Conversation'),
			f1: true,
			precondition: ConversationVisibleContext,
		});
	}

	override run(accessor: ServicesAccessor): Promise<void> {
		if (!conversationPartHasFocus(accessor)) {
			return Promise.resolve();
		}
		return cycleConversationChatTab(accessor.get(IEditorGroupsService), -1);
	}
});
