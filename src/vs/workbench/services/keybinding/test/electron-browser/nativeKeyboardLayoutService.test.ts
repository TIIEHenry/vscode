/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { IChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';
import { IKeyboardLayoutInfo, IKeyboardMapping } from '../../../../../platform/keyboardLayout/common/keyboardLayout.js';
import { IKeyboardLayoutData } from '../../../../../platform/keyboardLayout/common/keyboardLayoutService.js';
import { NativeKeyboardLayoutService } from '../../electron-browser/nativeKeyboardLayoutService.js';

function layoutData(value: string, id: string): IKeyboardLayoutData {
	return {
		keyboardMapping: {
			KeyA: {
				value,
				withShift: value.toUpperCase(),
				withAltGr: value,
				withShiftAltGr: value.toUpperCase(),
			},
		} as IKeyboardMapping,
		keyboardLayoutInfo: { id, lang: 'en', localizedName: id } as IKeyboardLayoutInfo,
	};
}

class KeyboardLayoutChannel implements IChannel {
	readonly onDidChange = new Emitter<IKeyboardLayoutData>();
	reads = 0;
	listens = 0;
	failures = 0;
	data: IKeyboardLayoutData;
	private gate: Promise<void> | undefined;

	constructor(data: IKeyboardLayoutData) {
		this.data = data;
	}

	hold(gate: Promise<void>): void {
		this.gate = gate;
	}

	call<T>(command: string): Promise<T> {
		assert.strictEqual(command, 'getKeyboardLayoutData');
		this.reads++;
		if (this.failures > 0) {
			this.failures--;
			return Promise.reject(new Error('layout read failed'));
		}
		const data = this.data as T;
		return this.gate ? this.gate.then(() => data) : Promise.resolve(data);
	}

	listen<T>(event: string): Event<T> {
		assert.strictEqual(event, 'onDidChangeKeyboardLayout');
		this.listens++;
		return this.onDidChange.event as Event<T>;
	}
}

function createService(channel: KeyboardLayoutChannel): NativeKeyboardLayoutService {
	const mainProcessService = new class extends mock<IMainProcessService>() {
		override getChannel(channelName: string): IChannel {
			assert.strictEqual(channelName, 'keyboardLayout');
			return channel;
		}
	};
	return new NativeKeyboardLayoutService(mainProcessService);
}

suite('NativeKeyboardLayoutService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('a failed initialize is read again and does not subscribe twice', async () => {
		const data = layoutData('a', 'us');
		const channel = new KeyboardLayoutChannel(data);
		channel.failures = 1;
		store.add(channel.onDidChange);
		const service = store.add(createService(channel));
		assert.strictEqual(channel.listens, 1);

		const failed = service.initialize();
		await assert.rejects(failed, /layout read failed/);
		assert.strictEqual(channel.reads, 1);
		assert.strictEqual(service.getRawKeyboardMapping(), null);
		assert.strictEqual(channel.listens, 1);

		const retried = service.initialize();
		assert.notStrictEqual(retried, failed);
		await retried;
		assert.strictEqual(channel.reads, 2);
		assert.strictEqual(service.getRawKeyboardMapping(), data.keyboardMapping);
		assert.strictEqual(service.getCurrentKeyboardLayout(), data.keyboardLayoutInfo);

		const cached = service.initialize();
		assert.strictEqual(cached, retried);
		await cached;
		assert.strictEqual(channel.reads, 2);
		assert.strictEqual(channel.listens, 1);
	});

	test('concurrent initialize shares one read', async () => {
		const data = layoutData('a', 'us');
		const channel = new KeyboardLayoutChannel(data);
		let release!: () => void;
		const gate = new Promise<void>(resolve => { release = resolve; });
		channel.hold(gate);
		store.add(channel.onDidChange);
		const service = store.add(createService(channel));

		const first = service.initialize();
		const second = service.initialize();
		try {
			assert.strictEqual(first, second);
			assert.strictEqual(channel.reads, 1);
			assert.strictEqual(channel.listens, 1);
		} finally {
			release();
		}

		await first;
		await second;
		assert.strictEqual(channel.reads, 1);
		assert.strictEqual(channel.listens, 1);
		assert.strictEqual(service.getRawKeyboardMapping(), data.keyboardMapping);

		const cached = service.initialize();
		assert.strictEqual(cached, first);
		await cached;
		assert.strictEqual(channel.reads, 1);
		assert.strictEqual(channel.listens, 1);
	});

	test('a layout change after a failed init reads again without another subscription', async () => {
		const read = layoutData('a', 'us');
		const changed = layoutData('q', 'de');
		const channel = new KeyboardLayoutChannel(read);
		channel.failures = 1;
		store.add(channel.onDidChange);
		const service = store.add(createService(channel));

		await assert.rejects(service.initialize(), /layout read failed/);
		assert.strictEqual(channel.reads, 1);
		assert.strictEqual(channel.listens, 1);

		const seen = Event.toPromise(service.onDidChangeKeyboardLayout, store);
		channel.onDidChange.fire(changed);
		await seen;

		assert.strictEqual(channel.reads, 2);
		assert.strictEqual(channel.listens, 1);
		assert.strictEqual(service.getRawKeyboardMapping(), changed.keyboardMapping);
		assert.strictEqual(service.getCurrentKeyboardLayout(), changed.keyboardLayoutInfo);

		channel.onDidChange.fire(changed);
		await Promise.resolve();
		assert.strictEqual(channel.reads, 2);
		assert.strictEqual(channel.listens, 1);
	});
});
