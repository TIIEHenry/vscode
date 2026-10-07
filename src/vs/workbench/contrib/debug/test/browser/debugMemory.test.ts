/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { decodeBase64, encodeBase64, VSBuffer } from '../../../../../base/common/buffer.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { mockObject, MockObject } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { DebugMemoryFileSystemProvider } from '../../browser/debugMemory.js';
import { IDebugModel, IDebugService, MemoryRangeType, State } from '../../common/debug.js';
import { getUriForDebugMemory, MemoryRegion } from '../../common/debugModel.js';
import { MockSession } from '../common/mockDebug.js';

suite('Debug - Memory', () => {
	const dapResponseCommon = {
		command: 'someCommand',
		type: 'response',
		seq: 1,
		request_seq: 1,
		success: true,
	};

	const dapMemoryEvent = (body: DebugProtocol.MemoryEvent['body']): DebugProtocol.MemoryEvent => ({
		seq: 1,
		type: 'event',
		event: 'memory',
		body,
	});

	ensureNoDisposablesAreLeakedInTestSuite();

	suite('MemoryRegion', () => {
		let memory: VSBuffer;
		let unreadable: number;
		let invalidateMemoryEmitter: Emitter<DebugProtocol.MemoryEvent>;
		let session: MockObject<MockSession, 'onDidInvalidateMemory'>;
		let region: MemoryRegion;

		setup(() => {
			const memoryBuf = new Uint8Array(1024);
			for (let i = 0; i < memoryBuf.length; i++) {
				memoryBuf[i] = i; // will be 0-255
			}
			memory = VSBuffer.wrap(memoryBuf);
			invalidateMemoryEmitter = new Emitter();
			unreadable = 0;

			session = mockObject<MockSession>()({
				onDidInvalidateMemory: invalidateMemoryEmitter.event
			});

			session.readMemory.callsFake((ref: string, fromOffset: number, count: number) => {
				const res: DebugProtocol.ReadMemoryResponse = ({
					...dapResponseCommon,
					body: {
						address: '0',
						data: encodeBase64(memory.slice(fromOffset, fromOffset + Math.max(0, count - unreadable))),
						unreadableBytes: unreadable
					}
				});

				unreadable = 0;

				return Promise.resolve(res);
			});

			session.writeMemory.callsFake((ref: string, fromOffset: number, data: string): DebugProtocol.WriteMemoryResponse => {
				const decoded = decodeBase64(data);
				for (let i = 0; i < decoded.byteLength; i++) {
					memory.buffer[fromOffset + i] = decoded.buffer[i];
				}

				return ({
					...dapResponseCommon,
					body: {
						bytesWritten: decoded.byteLength,
						offset: fromOffset,
					}
				});
			});

			// eslint-disable-next-line local/code-no-any-casts
			region = new MemoryRegion('ref', session as any);
		});

		teardown(() => {
			region.dispose();
		});

		function trackRegionSessionIo(readCalls?: { offset: number; count: number }[], writeCalls?: { offset: number; length: number }[]): void {
			if (readCalls) {
				session.readMemory.callsFake((_ref: string, fromOffset: number, count: number) => {
					readCalls.push({ offset: fromOffset, count });
					const res: DebugProtocol.ReadMemoryResponse = ({
						...dapResponseCommon,
						body: {
							address: '0',
							data: encodeBase64(memory.slice(fromOffset, fromOffset + Math.max(0, count - unreadable))),
							unreadableBytes: unreadable
						}
					});
					unreadable = 0;
					return Promise.resolve(res);
				});
			}
			if (writeCalls) {
				session.writeMemory.callsFake((_ref: string, fromOffset: number, data: string) => {
					const decoded = decodeBase64(data);
					writeCalls.push({ offset: fromOffset, length: decoded.byteLength });
					for (let i = 0; i < decoded.byteLength; i++) {
						memory.buffer[fromOffset + i] = decoded.buffer[i];
					}
					return ({
						...dapResponseCommon,
						body: {
							bytesWritten: decoded.byteLength,
							offset: fromOffset,
						}
					});
				});
			}
		}

		function createMemoryFileProvider(): DebugMemoryFileSystemProvider {
			const sessionId = 'test-session';
			const debugSession = mockObject<MockSession>()({
				onDidInvalidateMemory: invalidateMemoryEmitter.event,
				capabilities: { supportsWriteMemoryRequest: true },
				state: State.Stopped,
			});
			debugSession.getMemory.callsFake(() => region);
			const debugService = mockObject<IDebugService>()({
				onDidEndSession: Event.None,
				getModel: (): IDebugModel => ({
					getSession: (id: string) => id === sessionId ? debugSession as unknown as MockSession : undefined,
				} as IDebugModel),
			});
			return new DebugMemoryFileSystemProvider(debugService as unknown as IDebugService);
		}

		test('reads a simple range', async () => {
			assert.deepStrictEqual(await region.read(10, 14), [
				{ type: MemoryRangeType.Valid, offset: 10, length: 4, data: VSBuffer.wrap(new Uint8Array([10, 11, 12, 13])) }
			]);
		});

		test('reads a non-contiguous range', async () => {
			unreadable = 3;
			assert.deepStrictEqual(await region.read(10, 14), [
				{ type: MemoryRangeType.Valid, offset: 10, length: 1, data: VSBuffer.wrap(new Uint8Array([10])) },
				{ type: MemoryRangeType.Unreadable, offset: 11, length: 3 },
			]);
		});

		test('emits invalidate range from memory event offset and count', () => {
			const invalidations: { fromOffset: number; toOffset: number }[] = [];
			const store = new DisposableStore();
			store.add(region.onDidInvalidate(e => invalidations.push(e)));

			invalidateMemoryEmitter.fire(dapMemoryEvent({ memoryReference: 'ref', offset: 100, count: 16 }));
			invalidateMemoryEmitter.fire(dapMemoryEvent({ memoryReference: 'ref', offset: 0, count: 16 }));
			invalidateMemoryEmitter.fire(dapMemoryEvent({ memoryReference: 'ref', offset: -8, count: 4 }));
			invalidateMemoryEmitter.fire(dapMemoryEvent({ memoryReference: 'other', offset: 100, count: 16 }));

			assert.deepStrictEqual(invalidations, [
				{ fromOffset: 100, toOffset: 116 },
				{ fromOffset: 0, toOffset: 16 },
				{ fromOffset: -8, toOffset: -4 },
			]);
			store.dispose();
		});

		test('returns short valid range when adapter returns fewer bytes without unreadableBytes', async () => {
			for (const unreadableBytes of [undefined, 0] as const) {
				session.readMemory.callsFake((_ref: string, fromOffset: number, _count: number) => {
					const body: DebugProtocol.ReadMemoryResponse['body'] = {
						address: '0',
						data: encodeBase64(VSBuffer.wrap(new Uint8Array([fromOffset, fromOffset + 1]))),
					};
					if (unreadableBytes === 0) {
						body.unreadableBytes = 0;
					}
					return Promise.resolve({
						...dapResponseCommon,
						body,
					});
				});

				const result = await region.read(5, 10);
				assert.strictEqual(result.length, 1, `unreadableBytes=${String(unreadableBytes)}`);
				assert.strictEqual(result[0].type, MemoryRangeType.Valid);
				if (result[0].type === MemoryRangeType.Valid) {
					assert.strictEqual(result[0].length, 2);
					assert.deepStrictEqual(Array.from(result[0].data.buffer), [5, 6]);
				}
			}
		});

		test('still zero-pads readable segment when unreadableBytes is greater than zero', async () => {
			session.readMemory.callsFake((_ref: string, fromOffset: number, _count: number) => {
				const res: DebugProtocol.ReadMemoryResponse = ({
					...dapResponseCommon,
					body: {
						address: '0',
						data: encodeBase64(VSBuffer.wrap(new Uint8Array([fromOffset]))),
						unreadableBytes: 1,
					}
				});
				return Promise.resolve(res);
			});

			const result = await region.read(20, 23);
			assert.deepStrictEqual(result, [
				{ type: MemoryRangeType.Valid, offset: 20, length: 2, data: VSBuffer.wrap(new Uint8Array([20, 0])) },
				{ type: MemoryRangeType.Unreadable, offset: 22, length: 1 },
			]);
		});

		test('DebugMemoryFileSystemProvider read uses file position as memory offset', async () => {
			const readCalls: { offset: number; count: number }[] = [];
			trackRegionSessionIo(readCalls);
			const provider = createMemoryFileProvider();
			const uri = getUriForDebugMemory('test-session', 'ref');
			const fd = await provider.open(uri, { create: false });
			const buffer = new Uint8Array(4096);
			await provider.read(fd, 8192, buffer, 0, 4096);
			await provider.read(fd, 0, buffer, 0, 256);
			await provider.close(fd);
			provider.dispose();

			assert.deepStrictEqual(readCalls, [
				{ offset: 8192, count: 4096 },
				{ offset: 0, count: 256 },
			]);
		});

		test('DebugMemoryFileSystemProvider readFile and writeFile use range-relative offsets', async () => {
			const readCalls: { offset: number; count: number }[] = [];
			const writeCalls: { offset: number; length: number }[] = [];
			trackRegionSessionIo(readCalls, writeCalls);
			const provider = createMemoryFileProvider();
			const uri = getUriForDebugMemory('test-session', 'ref', { fromOffset: 100, toOffset: 116 });
			const content = new Uint8Array(16);
			for (let i = 0; i < content.length; i++) {
				content[i] = 100 + i;
			}
			await provider.writeFile(uri, content);
			const readBack = await provider.readFile(uri);
			provider.dispose();

			assert.deepStrictEqual(writeCalls, [{ offset: 100, length: 16 }]);
			assert.deepStrictEqual(readCalls, [{ offset: 100, count: 16 }]);
			assert.deepStrictEqual(Array.from(readBack), Array.from(content));
		});

		test('DebugMemoryFileSystemProvider writeFile with range starting at zero writes to offset zero', async () => {
			const writeCalls: { offset: number; length: number }[] = [];
			trackRegionSessionIo(undefined, writeCalls);
			const provider = createMemoryFileProvider();
			const uri = getUriForDebugMemory('test-session', 'ref', { fromOffset: 0, toOffset: 4 });
			await provider.writeFile(uri, new Uint8Array([1, 2, 3, 4]));
			provider.dispose();

			assert.deepStrictEqual(writeCalls, [{ offset: 0, length: 4 }]);
		});
	});
});
