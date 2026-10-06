/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { strictEqual } from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TerminalEditor } from '../../browser/terminalEditor.js';
import { ITerminalEditorService, ITerminalInstance } from '../../browser/terminal.js';
import { TerminalEditorInput } from '../../browser/terminalEditorInput.js';
import { TestEditorGroupView, TestTerminalEditorService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IMenu } from '../../../../../platform/actions/common/actions.js';

suite('TerminalEditor', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createMockInstance(id: number): ITerminalInstance & { mouseEventCalls: MouseEvent[] } {
		const mouseEventCalls: MouseEvent[] = [];
		const onDidFocus = store.add(new Emitter<ITerminalInstance>());
		return {
			instanceId: id,
			mouseEventCalls,
			onDidFocus: onDidFocus.event,
			handleMouseEvent: async (event: MouseEvent, _menu: IMenu) => {
				mouseEventCalls.push(event);
				return { cancelContextMenu: false };
			},
			attachToElement: () => { },
			detachFromElement: () => { },
			setVisible: () => { },
			shellLaunchConfig: {},
			domElement: document.createElement('div')
		} as unknown as ITerminalInstance & { mouseEventCalls: MouseEvent[] };
	}

	test('mousedown dispatches to this editor instance instead of service activeInstance', async () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const terminalEditorService = instantiationService.get(ITerminalEditorService) as TestTerminalEditorService;

		const page1Instance = createMockInstance(1);
		const page2Instance = createMockInstance(2);

		terminalEditorService.instances = [page1Instance, page2Instance];
		terminalEditorService.activeInstance = page2Instance;

		const group = new TestEditorGroupView(1);
		const editor = store.add(instantiationService.createInstance(TerminalEditor, group));

		const container = document.createElement('div');
		editor.create(container);

		const input1 = {
			terminalInstance: page1Instance,
			setCopyLaunchConfig: () => { }
		} as unknown as TerminalEditorInput;

		(editor as unknown as { _editorInput?: TerminalEditorInput })._editorInput = input1;

		const mouseEvent = new MouseEvent('mousedown', { bubbles: true, button: 1 });
		container.dispatchEvent(mouseEvent);

		await new Promise(resolve => setTimeout(resolve, 10));

		strictEqual(page1Instance.mouseEventCalls.length, 1);
		strictEqual(page2Instance.mouseEventCalls.length, 0);
	});
});
