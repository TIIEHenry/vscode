/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, describe, expect, it, vi } from 'vitest';

const appendFile = vi.hoisted(() => vi.fn());
const appendFileSync = vi.hoisted(() => vi.fn());

vi.mock('fs/promises', async () => {
	const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
	return { ...actual, appendFile };
});

vi.mock('fs', async () => {
	const actual = await vi.importActual<typeof import('fs')>('fs');
	return { ...actual, appendFileSync };
});

import { FlushableSafeJSONLFile } from '../safeFileWriteUtils';

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (error: unknown) => void } {
	let resolve!: () => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<void>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe('FlushableSafeJSONLFile', () => {
	afterEach(() => {
		appendFile.mockReset();
		appendFileSync.mockReset();
	});

	it('keeps the batch when appendFile rejects and writes it once on the next flush', async () => {
		appendFile.mockRejectedValueOnce(new Error('disk'));
		appendFile.mockResolvedValue(undefined);
		const file = new FlushableSafeJSONLFile('/tmp/recorder.jsonl');

		file.appendEntry({ a: 1 });
		await expect(file.flushAsync()).rejects.toThrow('disk');
		file.appendEntry({ b: 2 });
		await file.flushAsync();

		expect(appendFile).toHaveBeenCalledTimes(2);
		const second = String(appendFile.mock.calls[1][1]);
		expect(second.indexOf('{"a":1}')).toBeGreaterThanOrEqual(0);
		expect(second.indexOf('{"a":1}')).toBeLessThan(second.indexOf('{"b":2}'));
	});

	it('leaves entries appended during an in-flight write queued after that batch', async () => {
		const gate = deferred();
		appendFile.mockImplementation(() => gate.promise);
		const file = new FlushableSafeJSONLFile('/tmp/recorder.jsonl');

		file.appendEntry({ a: 1 });
		const flushing = file.flushAsync();
		file.appendEntry({ b: 2 });
		file.flushSync();
		expect(appendFileSync).not.toHaveBeenCalled();

		gate.resolve();
		await flushing;

		expect(appendFile).toHaveBeenCalledTimes(1);
		expect(String(appendFile.mock.calls[0][1])).toContain('{"a":1}');
		expect(String(appendFile.mock.calls[0][1])).not.toContain('{"b":2}');

		appendFile.mockResolvedValue(undefined);
		await file.flushAsync();
		expect(String(appendFile.mock.calls[1][1])).toContain('{"b":2}');
		expect(String(appendFile.mock.calls[1][1])).not.toContain('{"a":1}');
	});

	it('keeps the batch when appendFileSync throws and writes it on the next flushSync', () => {
		appendFileSync.mockImplementationOnce(() => {
			throw new Error('disk');
		});
		appendFileSync.mockImplementation(() => undefined);
		const file = new FlushableSafeJSONLFile('/tmp/recorder.jsonl');

		file.appendEntry({ a: 1 });
		expect(() => file.flushSync()).toThrow('disk');
		file.flushSync();

		expect(appendFileSync).toHaveBeenCalledTimes(2);
		expect(String(appendFileSync.mock.calls[1][1])).toContain('{"a":1}');
	});
});
