/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { strictEqual } from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TerminalGroup } from '../../browser/terminalGroup.js';
import { ITerminalInstance } from '../../browser/terminal.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';

suite('TerminalGroup', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createMockInstance(id: number, hadFocusOnExit: boolean = false): ITerminalInstance & { focusCount: number; lastFocusArg: boolean | undefined } {
		let focusCalled = 0;
		let focusArg: boolean | undefined;
		const onDisposed = store.add(new Emitter<ITerminalInstance>());
		const onDidFocus = store.add(new Emitter<ITerminalInstance>());
		return {
			instanceId: id,
			hadFocusOnExit,
			onDisposed: onDisposed.event,
			onDidFocus: onDidFocus.event,
			capabilities: {
				onDidChangeCapabilities: Event.None
			},
			focus: (force?: boolean) => {
				focusCalled++;
				focusArg = force;
			},
			get focusCount() { return focusCalled; },
			get lastFocusArg() { return focusArg; },
			detachFromElement: () => { }
		} as unknown as ITerminalInstance & { focusCount: number; lastFocusArg: boolean | undefined };
	}

	test('should not focus next instance when active instance hadFocusOnExit is false', () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const group = store.add(instantiationService.createInstance(TerminalGroup, undefined, undefined));

		const instance1 = createMockInstance(1, false);
		const instance2 = createMockInstance(2, false);

		group.addInstance(instance1);
		group.addInstance(instance2);
		strictEqual(group.activeInstance, instance1);

		group.removeInstance(instance1);
		strictEqual(group.activeInstance, instance2);
		strictEqual(instance2.focusCount, 0);

		group.removeInstance(instance2);
	});

	test('should focus next instance with force=true when active instance hadFocusOnExit is true', () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const group = store.add(instantiationService.createInstance(TerminalGroup, undefined, undefined));

		const instance1 = createMockInstance(1, true);
		const instance2 = createMockInstance(2, false);

		group.addInstance(instance1);
		group.addInstance(instance2);
		strictEqual(group.activeInstance, instance1);

		group.removeInstance(instance1);
		strictEqual(group.activeInstance, instance2);
		strictEqual(instance2.focusCount, 1);
		strictEqual(instance2.lastFocusArg, true);

		group.removeInstance(instance2);
	});
});
