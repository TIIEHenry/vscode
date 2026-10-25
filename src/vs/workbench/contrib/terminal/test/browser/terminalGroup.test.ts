/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { strictEqual } from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { TerminalGroup } from '../../browser/terminalGroup.js';
import { TerminalGroupService } from '../../browser/terminalGroupService.js';
import { ITerminalGroup, ITerminalInstance } from '../../browser/terminal.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';

suite('TerminalGroup', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createMockInstance(id: number, hadFocusOnExit: boolean = false, hasFocus: boolean = false): ITerminalInstance & { focusCount: number; lastFocusArg: boolean | undefined } {
		let focusCalled = 0;
		let focusArg: boolean | undefined;
		const onDisposed = store.add(new Emitter<ITerminalInstance>());
		const onDidFocus = store.add(new Emitter<ITerminalInstance>());
		return {
			instanceId: id,
			hadFocusOnExit,
			hasFocus,
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

	test('should not focus next instance when hadFocusOnExit is false even if hasFocus is true', () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const group = store.add(instantiationService.createInstance(TerminalGroup, undefined, undefined));

		const instance1 = createMockInstance(1, false, true);
		const instance2 = createMockInstance(2, false, false);

		group.addInstance(instance1);
		group.addInstance(instance2);
		strictEqual(group.activeInstance, instance1);

		group.removeInstance(instance1);
		strictEqual(group.activeInstance, instance2);
		strictEqual(instance2.focusCount, 0);

		group.removeInstance(instance2);
	});
});

suite('TerminalGroupService focus restore', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	interface FocusHandle {
		raw: ITerminalInstance;
		readonly focusCount: number;
		readonly lastFocusArg: boolean | undefined;
		readonly activeGroupOnFocus: boolean | undefined;
		setHasFocus(value: boolean): void;
	}

	const holder: { service?: TerminalGroupService } = {};

	function createFocusInstance(id: number, hasFocus: boolean): FocusHandle {
		let focusCalled = 0;
		let focusArg: boolean | undefined;
		let focused = hasFocus;
		let activeGroupOnFocus: boolean | undefined;
		const onDisposed = store.add(new Emitter<ITerminalInstance>());
		const onDidFocus = store.add(new Emitter<ITerminalInstance>());
		const raw = {
			instanceId: id,
			hadFocusOnExit: false,
			get hasFocus() { return focused; },
			onDisposed: onDisposed.event,
			onDidFocus: onDidFocus.event,
			capabilities: {
				onDidChangeCapabilities: Event.None
			},
			focus: (force?: boolean) => {
				focusCalled++;
				focusArg = force;
				const service = holder.service;
				activeGroupOnFocus = !!service && service.getGroupForInstance(raw as unknown as ITerminalInstance) === service.activeGroup;
			},
			setVisible: () => { },
			detachFromElement: () => { focused = false; }
		} as unknown as ITerminalInstance;
		return {
			raw,
			get focusCount() { return focusCalled; },
			get lastFocusArg() { return focusArg; },
			get activeGroupOnFocus() { return activeGroupOnFocus; },
			setHasFocus(value: boolean) { focused = value; }
		};
	}

	function createService(): TerminalGroupService {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IViewsService, { isViewVisible: () => true });
		instantiationService.stub(IViewDescriptorService, { getViewLocationById: () => null });
		const service = store.add(instantiationService.createInstance(TerminalGroupService));
		holder.service = service;
		return service;
	}

	function dropFocusOnRemove(group: ITerminalGroup, handle: FocusHandle): void {
		const removable = group as { removeInstance(instance: ITerminalInstance): void };
		const original = removable.removeInstance.bind(group);
		removable.removeInstance = (candidate) => {
			if (candidate === handle.raw) {
				handle.setHasFocus(false);
			}
			original(candidate);
		};
	}

	function disposeGroups(service: TerminalGroupService): void {
		for (const group of [...service.groups]) {
			for (const instance of [...group.terminalInstances]) {
				group.removeInstance(instance);
			}
		}
	}

	test('unsplitInstance focuses the instance that had focus after its new group is active', () => {
		const service = createService();
		const stayed = createFocusInstance(1, false);
		const moved = createFocusInstance(2, true);
		const group = service.createGroup(stayed.raw);
		group.addInstance(moved.raw);
		group.setActiveInstanceByIndex(1);
		dropFocusOnRemove(group, moved);

		service.unsplitInstance(moved.raw);

		strictEqual(moved.focusCount, 1);
		strictEqual(moved.lastFocusArg, true);
		strictEqual(moved.activeGroupOnFocus, true);
		strictEqual(stayed.focusCount, 0);
		strictEqual(moved.raw.hadFocusOnExit, false);
		strictEqual(service.getGroupForInstance(moved.raw) !== group, true);
		disposeGroups(service);
	});

	test('unsplitInstance does not focus when hasFocus was false', () => {
		const service = createService();
		const stayed = createFocusInstance(1, false);
		const moved = createFocusInstance(2, false);
		const group = service.createGroup(stayed.raw);
		group.addInstance(moved.raw);
		dropFocusOnRemove(group, moved);

		service.unsplitInstance(moved.raw);

		strictEqual(moved.focusCount, 0);
		strictEqual(stayed.focusCount, 0);
		disposeGroups(service);
	});

	test('cross-group moveInstance focuses the moved instance and not the one left behind', () => {
		const service = createService();
		const moved = createFocusInstance(1, true);
		const stayed = createFocusInstance(2, false);
		const target = createFocusInstance(3, false);
		const sourceGroup = service.createGroup(moved.raw);
		sourceGroup.addInstance(stayed.raw);
		const targetGroup = service.createGroup(target.raw);
		dropFocusOnRemove(sourceGroup, moved);

		service.moveInstance(moved.raw, target.raw, 'after');

		strictEqual(moved.focusCount, 1);
		strictEqual(moved.lastFocusArg, true);
		strictEqual(moved.activeGroupOnFocus, true);
		strictEqual(service.activeGroup, targetGroup);
		strictEqual(stayed.focusCount, 0);
		strictEqual(target.focusCount, 0);
		strictEqual(moved.raw.hadFocusOnExit, false);
		disposeGroups(service);
	});

	test('same-group moveInstance focuses the moved instance after rearrange', () => {
		const service = createService();
		const moved = createFocusInstance(1, true);
		const other = createFocusInstance(2, false);
		const group = service.createGroup(moved.raw);
		group.addInstance(other.raw);
		const movable = group as { moveInstance(instances: ITerminalInstance | ITerminalInstance[], index: number, position: 'before' | 'after'): void };
		const original = movable.moveInstance.bind(group);
		movable.moveInstance = (instances, index, position) => {
			const list = Array.isArray(instances) ? instances : [instances];
			if (list.includes(moved.raw)) {
				moved.setHasFocus(false);
			}
			original(instances, index, position);
		};

		service.moveInstance(moved.raw, other.raw, 'after');

		strictEqual(moved.focusCount, 1);
		strictEqual(moved.lastFocusArg, true);
		strictEqual(moved.activeGroupOnFocus, true);
		strictEqual(other.focusCount, 0);
		strictEqual(moved.raw.hadFocusOnExit, false);
		disposeGroups(service);
	});

	test('same-group moveInstance keeps the active instance when an unfocused instance moves before it', () => {
		const service = createService();
		const active = createFocusInstance(1, false);
		const moved = createFocusInstance(2, false);
		const group = service.createGroup(active.raw);
		group.addInstance(moved.raw);
		group.setActiveInstanceByIndex(0);

		group.moveInstance(moved.raw, active.raw, 'before');

		strictEqual(group.activeInstance, active.raw);
		strictEqual(moved.focusCount, 0);
		disposeGroups(service);
	});

	test('joinInstances focuses only the moved instance that had focus', () => {
		const service = createService();
		const moved = createFocusInstance(1, true);
		const stayed = createFocusInstance(2, false);
		const anchor = createFocusInstance(3, false);
		const sourceGroup = service.createGroup(moved.raw);
		sourceGroup.addInstance(stayed.raw);
		sourceGroup.setActiveInstanceByIndex(0);
		service.createGroup(anchor.raw);
		dropFocusOnRemove(sourceGroup, moved);

		service.joinInstances([anchor.raw, moved.raw]);

		strictEqual(moved.focusCount, 1);
		strictEqual(moved.lastFocusArg, true);
		strictEqual(moved.activeGroupOnFocus, true);
		strictEqual(stayed.focusCount, 0);
		strictEqual(anchor.focusCount, 0);
		strictEqual(moved.raw.hadFocusOnExit, false);
		strictEqual(service.getGroupForInstance(moved.raw), service.getGroupForInstance(anchor.raw));
		disposeGroups(service);
	});
});
