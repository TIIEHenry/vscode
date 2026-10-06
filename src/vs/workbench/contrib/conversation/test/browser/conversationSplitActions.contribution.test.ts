/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { IWorkbenchLayoutService, Parts } from '../../../../services/layout/browser/layoutService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationChatTablistKeyboard } from '../../browser/conversationSplitActions.contribution.js';

suite('Conversation split actions contribution', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('tablist arrow keys cycle tabs in the column that owns the focused tablist', async () => {
		const editorLeft = { id: 'left-a' };
		const editorLeftNext = { id: 'left-b' };
		const editorRight = { id: 'right-a' };
		let openedInLeft = 0;
		let openedInRight = 0;

		const leftGroupEl = document.createElement('div');
		leftGroupEl.className = 'editor-group-container';
		const rightGroupEl = document.createElement('div');
		rightGroupEl.className = 'editor-group-container';

		const leftGroup = {
			element: leftGroupEl,
			count: 2,
			activeEditor: editorLeft,
			getEditors: () => [editorLeft, editorLeftNext],
			openEditor: () => {
				openedInLeft++;
				return Promise.resolve(undefined);
			},
		};
		const rightGroup = {
			element: rightGroupEl,
			count: 1,
			activeEditor: editorRight,
			getEditors: () => [editorRight],
			openEditor: () => {
				openedInRight++;
				return Promise.resolve(undefined);
			},
		};

		const part = {
			groups: [leftGroup, rightGroup],
			activeGroup: rightGroup,
			isGroupHidden: () => false,
		};

		const instantiationService = workbenchInstantiationService(undefined, store);
		const layoutService = instantiationService.get(IWorkbenchLayoutService);
		(layoutService as { hasFocus(part: Parts): boolean }).hasFocus = (target: Parts) => target === Parts.CONVERSATION_PART;
		instantiationService.stub(IEditorGroupsService, {
			getActiveConversationEditorPart: () => part,
		} as unknown as IEditorGroupsService);
		store.add(instantiationService.createInstance(ConversationChatTablistKeyboard));

		const host = document.createElement('div');
		host.className = 'conversation-editor-part-host';
		const leftTablist = document.createElement('div');
		leftTablist.className = 'tabs-container';
		leftTablist.setAttribute('role', 'tablist');
		const leftTab = document.createElement('div');
		leftTab.className = 'tab';
		leftTab.tabIndex = 0;
		leftTablist.appendChild(leftTab);
		leftGroupEl.appendChild(leftTablist);
		host.appendChild(leftGroupEl);
		host.appendChild(rightGroupEl);
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });

		leftTab.focus();
		assert.strictEqual(document.activeElement, leftTab);

		const event = new KeyboardEvent('keydown', {
			key: 'ArrowRight',
			code: 'ArrowRight',
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, 'keyCode', { get: () => 39 });
		leftTab.dispatchEvent(event);

		await timeout(0);

		assert.strictEqual(openedInLeft, 1);
		assert.strictEqual(openedInRight, 0);
	});
});
