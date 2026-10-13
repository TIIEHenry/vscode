/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import type * as nativeKeymap from 'native-keymap';
import { isCI } from '../../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { LifecycleMainPhase } from '../../../lifecycle/electron-main/lifecycleMainService.js';
import { TestLifecycleMainService } from '../../../test/electron-main/workbenchTestServices.js';
import { KeyboardLayoutMainService } from '../../electron-main/keyboardLayoutMainService.js';

class IdleLifecycleMainService extends TestLifecycleMainService {
	override when(_phase: LifecycleMainPhase): Promise<void> {
		return new Promise(() => {
			// Leave AfterWindowOpen pending so the test controls every read.
		});
	}
}

interface IKeymapProbe {
	loads: number;
	reads: number;
	registrations: number;
	failLoads: number;
	failReads: number;
	throwOnRegister: boolean;
	listeners: Array<() => void>;
	readonly mapping: { KeyA: { value: string; withShift: string; withAltGr: string; withShiftAltGr: string } };
	readonly layoutInfo: { model: string; group: number; layout: string; variant: string; options: string; rules: string };
}

function createProbe(): IKeymapProbe {
	return {
		loads: 0,
		reads: 0,
		registrations: 0,
		failLoads: 0,
		failReads: 0,
		throwOnRegister: false,
		listeners: [],
		mapping: { KeyA: { value: 'a', withShift: 'A', withAltGr: 'a', withShiftAltGr: 'A' } },
		layoutInfo: { model: 'pc105', group: 0, layout: 'us', variant: '', options: '', rules: 'evdev' },
	};
}

function createModule(probe: IKeymapProbe): typeof nativeKeymap {
	return {
		getKeyMap: () => {
			probe.reads++;
			if (probe.failReads > 0) {
				probe.failReads--;
				throw new Error('keymap read failed');
			}
			return probe.mapping;
		},
		getCurrentKeyboardLayout: () => probe.layoutInfo,
		onDidChangeKeyboardLayout: (callback: () => void) => {
			probe.registrations++;
			probe.listeners.push(callback);
			if (probe.throwOnRegister) {
				probe.throwOnRegister = false;
				throw new Error('register failed');
			}
		},
		isISOKeyboard: () => false,
	} as typeof nativeKeymap;
}

class TestKeyboardLayoutMainService extends KeyboardLayoutMainService {
	constructor(
		private readonly loadNativeKeymap: () => Promise<typeof nativeKeymap>,
	) {
		super(new IdleLifecycleMainService());
	}

	protected override _loadNativeKeymap(): Promise<typeof nativeKeymap> {
		return this.loadNativeKeymap();
	}
}

function createService(probe: IKeymapProbe): TestKeyboardLayoutMainService {
	return new TestKeyboardLayoutMainService(async () => {
		probe.loads++;
		if (probe.failLoads > 0) {
			probe.failLoads--;
			throw new Error('import failed');
		}
		return createModule(probe);
	});
}

function registeredListeners(): number {
	return isCI ? 0 : 1;
}

suite('KeyboardLayoutMainService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('a failed keymap read is tried again and the listener is registered once', async () => {
		const probe = createProbe();
		probe.failReads = 1;
		const service = store.add(createService(probe));

		await assert.rejects(service.getKeyboardLayoutData(), /keymap read failed/);
		assert.strictEqual(probe.loads, 1);
		assert.strictEqual(probe.reads, 1);
		assert.strictEqual(probe.registrations, 0);

		const data = await service.getKeyboardLayoutData();
		assert.strictEqual(probe.loads, 2);
		assert.strictEqual(probe.reads, 2);
		assert.strictEqual(probe.registrations, registeredListeners());
		assert.strictEqual(data.keyboardMapping, probe.mapping);
		assert.strictEqual(data.keyboardLayoutInfo, probe.layoutInfo);

		const cached = await service.getKeyboardLayoutData();
		assert.strictEqual(cached, data);
		assert.strictEqual(probe.loads, 2);
		assert.strictEqual(probe.reads, 2);
		assert.strictEqual(probe.registrations, registeredListeners());
		assert.strictEqual(probe.listeners.length, registeredListeners());
	});

	test('a failed native-keymap import is tried again', async () => {
		const probe = createProbe();
		probe.failLoads = 1;
		const service = store.add(createService(probe));

		const failed = service.getKeyboardLayoutData();
		const shared = service.getKeyboardLayoutData();
		assert.strictEqual(probe.loads, 1);
		await assert.rejects(failed, /import failed/);
		await assert.rejects(shared, /import failed/);
		assert.strictEqual(probe.reads, 0);
		assert.strictEqual(probe.registrations, 0);

		const data = await service.getKeyboardLayoutData();
		assert.strictEqual(probe.loads, 2);
		assert.strictEqual(probe.registrations, registeredListeners());
		assert.strictEqual(data.keyboardLayoutInfo, probe.layoutInfo);

		await service.getKeyboardLayoutData();
		assert.strictEqual(probe.loads, 2);
		assert.strictEqual(probe.registrations, registeredListeners());
	});

	test('in-flight getKeyboardLayoutData shares one native-keymap load', async () => {
		const probe = createProbe();
		let release!: () => void;
		const gate = new Promise<void>(resolve => { release = resolve; });
		const service = store.add(new TestKeyboardLayoutMainService(async () => {
			probe.loads++;
			await gate;
			return createModule(probe);
		}));

		const first = service.getKeyboardLayoutData();
		const second = service.getKeyboardLayoutData();
		assert.strictEqual(probe.loads, 1);

		release();
		const firstData = await first;
		const secondData = await second;
		assert.strictEqual(firstData, secondData);
		assert.strictEqual(probe.loads, 1);
		assert.strictEqual(probe.reads, 1);
		assert.strictEqual(probe.registrations, registeredListeners());

		await service.getKeyboardLayoutData();
		assert.strictEqual(probe.loads, 1);
		assert.strictEqual(probe.reads, 1);
		assert.strictEqual(probe.registrations, registeredListeners());
	});

	test('a thrown listener registration is not stacked on retry', async () => {
		const probe = createProbe();
		probe.throwOnRegister = !isCI;
		const service = store.add(createService(probe));

		if (isCI) {
			const data = await service.getKeyboardLayoutData();
			assert.strictEqual(probe.registrations, 0);
			assert.strictEqual(probe.loads, 1);
			assert.strictEqual((await service.getKeyboardLayoutData()), data);
			assert.strictEqual(probe.registrations, 0);
			assert.strictEqual(probe.loads, 1);
			return;
		}

		await assert.rejects(service.getKeyboardLayoutData(), /register failed/);
		assert.strictEqual(probe.loads, 1);
		assert.strictEqual(probe.reads, 1);
		assert.strictEqual(probe.registrations, 1);
		assert.strictEqual(probe.listeners.length, 1);

		const data = await service.getKeyboardLayoutData();
		assert.strictEqual(data.keyboardMapping, probe.mapping);
		assert.strictEqual(probe.loads, 2);
		assert.strictEqual(probe.reads, 2);
		assert.strictEqual(probe.registrations, 1);
		assert.strictEqual(probe.listeners.length, 1);

		await service.getKeyboardLayoutData();
		assert.strictEqual(probe.loads, 2);
		assert.strictEqual(probe.registrations, 1);
	});
});
