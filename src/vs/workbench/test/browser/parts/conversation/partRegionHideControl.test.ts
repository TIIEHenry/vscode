/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { ToggleConversationVisibilityActionId, ToggleSourcesVisibilityActionId } from '../../../../browser/actions/layoutActions.js';
import { appendPartRegionHideControl } from '../../../../browser/parts/conversation/partRegionHideControl.js';
import { IWorkbenchLayoutService, Parts } from '../../../../services/layout/browser/layoutService.js';

suite('PartRegionHideControl', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function hideLabelElement(part: Parts.CONVERSATION_PART | Parts.SOURCES_PART, label: string, disposables: DisposableStore, keybindingService?: IKeybindingService): HTMLElement {
		const parent = document.createElement('div');
		appendPartRegionHideControl(parent, {} as IWorkbenchLayoutService, part, label, disposable => disposables.add(disposable), keybindingService);
		return parent.querySelector('.part-region-hide-actions .action-label') as HTMLElement;
	}

	test('tooltip carries the region toggle keybinding and follows keybinding updates', () => {
		const disposables = store.add(new DisposableStore());
		const onDidUpdateKeybindings = disposables.add(new Emitter<void>());
		const labels = new Map<string, string>([
			[ToggleConversationVisibilityActionId, 'Ctrl+Alt+Shift+T'],
			[ToggleSourcesVisibilityActionId, 'Ctrl+Alt+Shift+S'],
		]);
		const keybindingService = {
			onDidUpdateKeybindings: onDidUpdateKeybindings.event,
			lookupKeybinding: (commandId: string) => {
				const label = labels.get(commandId);
				return label ? { getLabel: () => label } : undefined;
			},
		} as unknown as IKeybindingService;

		const conversation = hideLabelElement(Parts.CONVERSATION_PART, 'Hide Conversation', disposables, keybindingService);
		const sources = hideLabelElement(Parts.SOURCES_PART, 'Hide Sources', disposables, keybindingService);
		const withoutService = hideLabelElement(Parts.SOURCES_PART, 'Hide Sources', disposables);
		const initial = [conversation, sources, withoutService].map(element => element.getAttribute('aria-label'));

		labels.delete(ToggleConversationVisibilityActionId);
		onDidUpdateKeybindings.fire();

		assert.deepStrictEqual({ initial, afterUnbind: conversation.getAttribute('aria-label') }, {
			initial: ['Hide Conversation (Ctrl+Alt+Shift+T)', 'Hide Sources (Ctrl+Alt+Shift+S)', 'Hide Sources'],
			afterUnbind: 'Hide Conversation',
		});
	});
});
