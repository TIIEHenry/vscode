/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { RunOnceWorker } from '../../../../../base/common/async.js';
import { VSBuffer, newWriteableBufferStream } from '../../../../../base/common/buffer.js';
import { CancellationToken, CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { isCancellationError } from '../../../../../base/common/errors.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { listenStream } from '../../../../../base/common/stream.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ByteSize, FileOperationError, FileOperationResult, IFileService } from '../../../../../platform/files/common/files.js';
import { IUndoRedoElement, IUndoRedoService, UndoRedoElementType } from '../../../../../platform/undoRedo/common/undoRedo.js';
import { UndoRedoService } from '../../../../../platform/undoRedo/common/undoRedoService.js';
import { ExplorerItem } from '../../common/explorerModel.js';
import { UNDO_REDO_SOURCE } from '../../browser/explorerService.js';
import { BrowserFileUpload, FileDownload } from '../../browser/fileImportExport.js';

interface IUploadEntry {
	name: string | undefined;
	isFile: boolean;
	isDirectory: boolean;
	file(resolve: (file: File) => void, reject: () => void): void;
	createReader(): { readEntries(resolve: (entries: IUploadEntry[]) => void, reject: () => void): void };
}

interface IUploadResult {
	isFile: boolean;
	resource: URI;
}

interface IUploadApi {
	doUpload(
		target: ExplorerItem,
		source: { items: Array<{ webkitGetAsEntry(): IUploadEntry | null }> },
		progress: { report(): void },
		token: CancellationToken,
	): Promise<IUploadResult[]>;
	doUploadFileUnbuffered(
		resource: URI,
		file: File,
		progressReporter: (fileSize: number, bytesUploaded: number) => void,
		token: CancellationToken,
	): Promise<void>;
}

interface IDownloadOperation {
	startTime: number;
	progressScheduler: { work(step: { message?: string }): void };
	filesTotal: number;
	filesDownloaded: number;
	totalBytesDownloaded: number;
	fileBytesDownloaded: number;
}

interface IDownloadApi {
	downloadFileUnbufferedBrowser(resource: URI, target: FileSystemWritableFileStream, operation: IDownloadOperation, token: CancellationToken): Promise<void>;
	downloadFileBufferedBrowser(resource: URI, target: FileSystemWritableFileStream, operation: IDownloadOperation, token: CancellationToken): Promise<void>;
}

type FileReaderMode = 'error' | 'cancel-on-read' | 'load';

class ScriptedFileReader {
	result: ArrayBuffer | string | null = null;
	error: DOMException | null = null;
	onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
	onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
	onabort: ((event: ProgressEvent<FileReader>) => void) | null = null;

	constructor(private readonly mode: FileReaderMode, private readonly onRead?: () => void) { }

	abort(): void {
		this.onabort?.(new ProgressEvent('abort') as ProgressEvent<FileReader>);
	}

	readAsArrayBuffer(_file: Blob): void {
		if (this.mode === 'error') {
			this.error = new DOMException('read failed');
			this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
			return;
		}
		if (this.mode === 'cancel-on-read') {
			this.onRead?.();
			return;
		}
		const bytes = new Uint8Array([4, 5, 6]);
		this.result = bytes.buffer;
		this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>);
	}
}

function bytesEqual(actual: Uint8Array | undefined, expected: Uint8Array): boolean {
	if (!actual || actual.byteLength !== expected.byteLength) {
		return false;
	}
	for (let i = 0; i < expected.byteLength; i++) {
		if (actual[i] !== expected[i]) {
			return false;
		}
	}
	return true;
}

function downloadOperation(store: Pick<DisposableStore, 'add'>): IDownloadOperation {
	return {
		startTime: Date.now() - 1000,
		progressScheduler: store.add(new RunOnceWorker(() => { }, 1000)),
		filesTotal: 1,
		filesDownloaded: 0,
		totalBytesDownloaded: 0,
		fileBytesDownloaded: 0,
	};
}

function fakeWritable(): { calls: string[]; target: FileSystemWritableFileStream } {
	const calls: string[] = [];
	const target = {
		write: async () => { calls.push('write'); },
		close: async () => { calls.push('close'); },
		abort: async () => { calls.push('abort'); },
	};
	return { calls, target: target as unknown as FileSystemWritableFileStream };
}

function fileEntry(name: string, file: File): IUploadEntry {
	return {
		name,
		isFile: true,
		isDirectory: false,
		file: resolve => resolve(file),
		createReader: () => { throw new Error('not a directory'); },
	};
}

function rejectingUndoRedo(): { service: UndoRedoService; confirms: { count: number } } {
	const confirms = { count: 0 };
	const service = new UndoRedoService(
		{
			confirm: async () => {
				confirms.count++;
				return { confirmed: false };
			},
		} as never,
		{ warn() { }, error() { }, info() { }, notify() { } } as never,
	);
	return { service, confirms };
}

function pushCapturedDeletion(service: UndoRedoService, resource: URI, files: Map<string, Uint8Array>, bytes: Uint8Array): void {
	const captured = bytes.slice();
	files.delete(resource.toString());
	const element: IUndoRedoElement = {
		type: UndoRedoElementType.Workspace,
		resources: [resource],
		label: 'Overwrite',
		code: 'undoredo.explorerOperation',
		undo: () => { files.set(resource.toString(), captured.slice()); },
		redo: () => { files.delete(resource.toString()); },
	};
	service.pushElement(element, undefined, UNDO_REDO_SOURCE);
}

function directoryEntry(name: string): IUploadEntry {
	return {
		name,
		isFile: false,
		isDirectory: true,
		file: (_resolve, reject) => reject(),
		createReader: () => ({
			readEntries: resolve => resolve([]),
		}),
	};
}

suite('Files - Browser download cancel', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const resource = URI.file('/download/note.txt');

	function createDownload(fileService: object): IDownloadApi {
		return new FileDownload(
			fileService as IFileService,
			undefined!,
			undefined!,
			undefined!,
			undefined!,
			undefined!,
		) as unknown as IDownloadApi;
	}

	test('small file cancel aborts without write or close', async () => {
		const cts = store.add(new CancellationTokenSource());
		cts.cancel();
		const { calls, target } = fakeWritable();
		const download = createDownload({
			readFile: async () => ({ name: 'note.txt', size: 4, value: VSBuffer.fromString('data') }),
		});

		await download.downloadFileUnbufferedBrowser(resource, target, downloadOperation(store), cts.token);

		assert.deepStrictEqual(calls, ['abort']);
	});

	test('readFile failure aborts without close', async () => {
		const cts = store.add(new CancellationTokenSource());
		const { calls, target } = fakeWritable();
		const download = createDownload({
			readFile: async () => { throw new Error('read failed'); },
		});

		await assert.rejects(
			() => download.downloadFileUnbufferedBrowser(resource, target, downloadOperation(store), cts.token),
			/read failed/,
		);
		assert.deepStrictEqual(calls, ['abort']);
	});

	test('readFileStream failure aborts without close', async () => {
		const cts = store.add(new CancellationTokenSource());
		const { calls, target } = fakeWritable();
		const download = createDownload({
			readFileStream: async () => { throw new Error('stream read failed'); },
		});

		await assert.rejects(
			() => download.downloadFileBufferedBrowser(resource, target, downloadOperation(store), cts.token),
			/stream read failed/,
		);
		assert.deepStrictEqual(calls, ['abort']);
	});

	test('large file cancel aborts without write or close', async () => {
		const cts = store.add(new CancellationTokenSource());
		const { calls, target } = fakeWritable();
		const download = createDownload({
			readFileStream: async () => {
				cts.cancel();
				return { name: 'big.bin', size: ByteSize.MB + 1, value: newWriteableBufferStream() };
			},
		});

		await download.downloadFileBufferedBrowser(resource, target, downloadOperation(store), cts.token);

		assert.deepStrictEqual(calls, ['abort']);
	});

	test('large file cancellation after listen aborts without close', async () => {
		const cts = store.add(new CancellationTokenSource());
		const { calls, target } = fakeWritable();
		const source = newWriteableBufferStream();
		const originalOn = source.on.bind(source);
		(source as unknown as { on(event: string, listener: (...args: unknown[]) => void): void }).on = (event, listener) => {
			(originalOn as unknown as (event: string, listener: (...args: unknown[]) => void) => void)(event, listener);
			if (event === 'data') {
				cts.cancel();
			}
		};
		const download = createDownload({
			readFileStream: async () => ({ name: 'big.bin', size: ByteSize.MB + 1, value: source }),
		});

		await assert.rejects(
			() => download.downloadFileBufferedBrowser(resource, target, downloadOperation(store), cts.token),
			error => isCancellationError(error),
		);
		assert.deepStrictEqual(calls, ['abort']);
	});

	test('large file onError aborts without close', async () => {
		const cts = store.add(new CancellationTokenSource());
		const { calls, target } = fakeWritable();
		const source = newWriteableBufferStream();
		source.error(new Error('boom'));
		source.end();
		const download = createDownload({
			readFileStream: async () => ({ name: 'big.bin', size: ByteSize.MB + 1, value: source }),
		});

		await assert.rejects(
			() => download.downloadFileBufferedBrowser(resource, target, downloadOperation(store), cts.token),
			/boom/,
		);
		assert.deepStrictEqual(calls, ['abort']);
	});

	test('large file onEnd closes without abort', async () => {
		const cts = store.add(new CancellationTokenSource());
		const { calls, target } = fakeWritable();
		const source = newWriteableBufferStream();
		source.write(VSBuffer.fromString('xyz'));
		source.end();
		const download = createDownload({
			readFileStream: async () => ({ name: 'big.bin', size: ByteSize.MB + 1, value: source }),
		});

		await download.downloadFileBufferedBrowser(resource, target, downloadOperation(store), cts.token);

		assert.deepStrictEqual(calls, ['write', 'close']);
	});
});

suite('Files - Browser upload cancel', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	let originalFileReader: typeof FileReader;

	setup(() => {
		originalFileReader = globalThis.FileReader;
	});

	teardown(() => {
		globalThis.FileReader = originalFileReader;
	});

	function installFileReader(mode: FileReaderMode, onRead?: () => void): void {
		globalThis.FileReader = function () {
			return new ScriptedFileReader(mode, onRead);
		} as unknown as typeof FileReader;
	}

	test('confirmed overwrite cancel before write restores original bytes and omits the uri', async () => {
		const root = URI.file('/upload-root');
		const destination = joinPath(root, 'note.txt');
		const other = joinPath(root, 'other.txt');
		const refused = joinPath(root, 'refused.txt');
		const original = new Uint8Array([1, 2, 3, 4]);
		const otherBytes = new Uint8Array([8, 8]);
		const refusedBytes = new Uint8Array([3]);
		const files = new Map<string, Uint8Array>([
			[destination.toString(), original.slice()],
			[refused.toString(), refusedBytes.slice()],
		]);
		const cts = store.add(new CancellationTokenSource());
		const { service: undoRedo, confirms } = rejectingUndoRedo();
		let writeCount = 0;
		let deleteCount = 0;
		const fileService = {
			hasCapability: () => false,
			writeFile: async () => { writeCount++; },
			del: async () => { deleteCount++; },
			createFolder: async () => undefined,
		};
		const upload = new BrowserFileUpload(
			undefined!,
			{ confirm: async () => ({ confirmed: true }) } as never,
			{
				applyBulkEdit: async () => {
					pushCapturedDeletion(undoRedo, destination, files, original);
					files.set(other.toString(), otherBytes.slice());
					pushCapturedDeletion(undoRedo, other, files, otherBytes);
					cts.cancel();
				},
			} as never,
			{ openEditor: async () => undefined } as never,
			fileService as unknown as IFileService,
			undoRedo,
		) as unknown as IUploadApi;
		const target = new ExplorerItem(root, fileService as unknown as IFileService, undefined!, undefined!, undefined, true, false, false, false, 'upload-root');
		target.addChild(new ExplorerItem(destination, fileService as unknown as IFileService, undefined!, undefined!, undefined, false, false, false, false, 'note.txt'));

		assert.notStrictEqual(UNDO_REDO_SOURCE.id, 0);
		pushCapturedDeletion(undoRedo, refused, files, refusedBytes);
		await undoRedo.undo(refused);
		assert.strictEqual(confirms.count, 1);
		assert.strictEqual(files.has(refused.toString()), false);

		const results = await upload.doUpload(target, {
			items: [{ webkitGetAsEntry: () => fileEntry('note.txt', { name: 'note.txt', size: 3 } as File) }],
		}, { report() { } }, cts.token);

		assert.strictEqual(writeCount, 0);
		assert.strictEqual(deleteCount, 0);
		assert.strictEqual(confirms.count, 1);
		assert.deepStrictEqual(results, []);
		assert.ok(bytesEqual(files.get(destination.toString()), original));
		assert.strictEqual(files.has(other.toString()), false);
	});

	test('large file cancel errors the stream instead of a successful end and restores original bytes', async () => {
		const root = URI.file('/upload-root');
		const destination = joinPath(root, 'big.bin');
		const original = new Uint8Array([9, 9, 9]);
		const chunk = new Uint8Array([5, 5, 5, 5]);
		const files = new Map<string, Uint8Array>([[destination.toString(), original.slice()]]);
		const cts = store.add(new CancellationTokenSource());
		const { service: undoRedo, confirms } = rejectingUndoRedo();
		const rollbackOps: string[] = [];
		const streamEvents: string[] = [];
		let streamError: unknown;
		let writeSucceeded = false;
		let sawPartial = false;
		const fileService = {
			hasCapability: () => false,
			del: async (resource: URI) => {
				rollbackOps.push('del');
				if (!files.has(resource.toString())) {
					throw new FileOperationError('missing', FileOperationResult.FILE_NOT_FOUND);
				}
				files.delete(resource.toString());
			},
			createFolder: async () => undefined,
			writeFile: async (_resource: URI, content: VSBuffer | object) => {
				if (content instanceof VSBuffer) {
					files.set(destination.toString(), Uint8Array.from(content.buffer.subarray(0, content.byteLength)));
					writeSucceeded = true;
					return;
				}
				await new Promise<void>((resolve, reject) => {
					let settled = false;
					listenStream(content as Parameters<typeof listenStream>[0], {
						onData: chunkBuffer => {
							sawPartial = true;
							const data = chunkBuffer as VSBuffer;
							files.set(destination.toString(), Uint8Array.from(data.buffer.subarray(0, data.byteLength)));
							streamEvents.push('data');
							cts.cancel();
						},
						onError: error => {
							streamEvents.push('error');
							streamError = error;
							if (!settled) {
								settled = true;
								reject(error);
							}
						},
						onEnd: () => {
							streamEvents.push('end');
							if (!settled) {
								settled = true;
								writeSucceeded = true;
								resolve();
							}
						},
					});
				});
			},
		};
		const upload = new BrowserFileUpload(
			undefined!,
			{ confirm: async () => ({ confirmed: true }) } as never,
			{
				applyBulkEdit: async () => {
					pushCapturedDeletion(undoRedo, destination, files, original);
				},
			} as never,
			{ openEditor: async () => undefined } as never,
			fileService as unknown as IFileService,
			undoRedo,
		) as unknown as IUploadApi;
		const target = new ExplorerItem(root, fileService as unknown as IFileService, undefined!, undefined!, undefined, true, false, false, false, 'upload-root');
		target.addChild(new ExplorerItem(destination, fileService as unknown as IFileService, undefined!, undefined!, undefined, false, false, false, false, 'big.bin'));
		const file = {
			name: 'big.bin',
			size: ByteSize.MB + 8,
			stream: () => ({
				getReader: () => {
					let sent = false;
					return {
						read: async () => {
							if (!sent) {
								sent = true;
								return { done: false, value: chunk };
							}
							return { done: true, value: undefined };
						},
					};
				},
			}),
		} as unknown as File;

		const results = await upload.doUpload(target, {
			items: [{ webkitGetAsEntry: () => fileEntry('big.bin', file) }],
		}, { report() { } }, cts.token);

		assert.ok(sawPartial);
		assert.ok(streamEvents.includes('error'));
		assert.ok(streamEvents.indexOf('error') < streamEvents.indexOf('end'));
		assert.strictEqual(writeSucceeded, false);
		assert.ok(isCancellationError(streamError));
		assert.deepStrictEqual(rollbackOps, ['del']);
		assert.strictEqual(confirms.count, 0);
		assert.deepStrictEqual(results, []);
		assert.ok(bytesEqual(files.get(destination.toString()), original));
	});

	test('new large file cancel leaves no target and does not treat end as success', async () => {
		const root = URI.file('/upload-root');
		const destination = joinPath(root, 'fresh.bin');
		const files = new Map<string, Uint8Array>();
		const cts = store.add(new CancellationTokenSource());
		const streamEvents: string[] = [];
		let writeSucceeded = false;
		let undoCount = 0;
		const fileService = {
			hasCapability: () => false,
			del: async (resource: URI) => {
				if (!files.has(resource.toString())) {
					throw new FileOperationError('missing', FileOperationResult.FILE_NOT_FOUND);
				}
				files.delete(resource.toString());
			},
			createFolder: async () => undefined,
			writeFile: async (resource: URI, content: VSBuffer | object) => {
				if (content instanceof VSBuffer) {
					writeSucceeded = true;
					files.set(resource.toString(), Uint8Array.from(content.buffer.subarray(0, content.byteLength)));
					return;
				}
				await new Promise<void>((resolve, reject) => {
					let settled = false;
					listenStream(content as Parameters<typeof listenStream>[0], {
						onData: chunkBuffer => {
							const data = chunkBuffer as VSBuffer;
							files.set(resource.toString(), Uint8Array.from(data.buffer.subarray(0, data.byteLength)));
							streamEvents.push('data');
							cts.cancel();
						},
						onError: error => {
							streamEvents.push('error');
							if (!settled) {
								settled = true;
								reject(error);
							}
						},
						onEnd: () => {
							streamEvents.push('end');
							if (!settled) {
								settled = true;
								writeSucceeded = true;
								resolve();
							}
						},
					});
				});
			},
		};
		const upload = new BrowserFileUpload(
			undefined!,
			{ confirm: async () => ({ confirmed: true }) } as never,
			{ applyBulkEdit: async () => { throw new Error('new file must not delete via bulk edit'); } } as never,
			{ openEditor: async () => undefined } as never,
			fileService as unknown as IFileService,
			{ undo: async () => { undoCount++; } } as unknown as IUndoRedoService,
		) as unknown as IUploadApi;
		const target = new ExplorerItem(root, fileService as unknown as IFileService, undefined!, undefined!, undefined, true, false, false, false, 'upload-root');
		const file = {
			name: 'fresh.bin',
			size: ByteSize.MB + 4,
			stream: () => ({
				getReader: () => {
					let sent = false;
					return {
						read: async () => {
							if (!sent) {
								sent = true;
								return { done: false, value: new Uint8Array([1, 2]) };
							}
							return { done: true, value: undefined };
						},
					};
				},
			}),
		} as unknown as File;

		const results = await upload.doUpload(target, {
			items: [{ webkitGetAsEntry: () => fileEntry('fresh.bin', file) }],
		}, { report() { } }, cts.token);

		assert.ok(streamEvents.includes('error'));
		assert.strictEqual(writeSucceeded, false);
		assert.strictEqual(undoCount, 0);
		assert.strictEqual(files.has(destination.toString()), false);
		assert.deepStrictEqual(results, []);
	});

	test('small file and streamless file cancel do not writeFile', async () => {
		const root = URI.file('/upload-root');
		const cts = store.add(new CancellationTokenSource());
		let writeCount = 0;
		const deleted: string[] = [];
		const fileService = {
			hasCapability: () => false,
			writeFile: async () => { writeCount++; },
			del: async (resource: URI) => {
				deleted.push(resource.toString());
				throw new FileOperationError('missing', FileOperationResult.FILE_NOT_FOUND);
			},
			createFolder: async () => undefined,
		};
		const upload = new BrowserFileUpload(
			undefined!,
			{ confirm: async () => ({ confirmed: false }) } as never,
			{ applyBulkEdit: async () => undefined } as never,
			{ openEditor: async () => undefined } as never,
			fileService as unknown as IFileService,
			{ undo: async () => undefined } as unknown as IUndoRedoService,
		) as unknown as IUploadApi;
		const target = new ExplorerItem(root, fileService as unknown as IFileService, undefined!, undefined!, undefined, true, false, false, false, 'upload-root');

		installFileReader('cancel-on-read', () => cts.cancel());
		const atLimit = {
			name: 'at-limit.txt',
			size: ByteSize.MB,
			stream: () => { throw new Error('stream should not be used at ByteSize.MB'); },
		} as unknown as File;
		const noStream = { name: 'plain.txt', size: ByteSize.MB + 20 } as unknown as File;

		const atLimitResults = await upload.doUpload(target, {
			items: [{ webkitGetAsEntry: () => fileEntry('at-limit.txt', atLimit) }],
		}, { report() { } }, cts.token);
		const plainToken = store.add(new CancellationTokenSource());
		installFileReader('cancel-on-read', () => plainToken.cancel());
		const plainResults = await upload.doUpload(target, {
			items: [{ webkitGetAsEntry: () => fileEntry('plain.txt', noStream) }],
		}, { report() { } }, plainToken.token);

		assert.strictEqual(writeCount, 0);
		assert.deepStrictEqual(atLimitResults, []);
		assert.deepStrictEqual(plainResults, []);
		assert.ok(deleted.includes(joinPath(root, 'at-limit.txt').toString()));
		assert.ok(deleted.includes(joinPath(root, 'plain.txt').toString()));
	});

	test('FileReader error rejects and does not writeFile', async () => {
		installFileReader('error');
		const cts = store.add(new CancellationTokenSource());
		let writeCount = 0;
		const upload = new BrowserFileUpload(
			undefined!,
			undefined!,
			undefined!,
			undefined!,
			{ writeFile: async () => { writeCount++; } } as unknown as IFileService,
			{ undo: async () => undefined } as unknown as IUndoRedoService,
		) as unknown as IUploadApi;

		await assert.rejects(
			() => upload.doUploadFileUnbuffered(URI.file('/upload-root/bad.txt'), { name: 'bad.txt', size: 4 } as File, () => { }, cts.token),
			error => error instanceof DOMException && /read failed/.test(error.message),
		);
		assert.strictEqual(writeCount, 0);
	});

	test('directory confirm does not apply the delete bulk edit', async () => {
		const root = URI.file('/upload-root');
		const destination = joinPath(root, 'folder');
		const cts = store.add(new CancellationTokenSource());
		let bulkEdits = 0;
		let confirmations = 0;
		const fileService = {
			hasCapability: () => false,
			createFolder: async () => undefined,
			writeFile: async () => undefined,
			del: async () => undefined,
		};
		const upload = new BrowserFileUpload(
			undefined!,
			{ confirm: async () => { confirmations++; return { confirmed: true }; } } as never,
			{ applyBulkEdit: async () => { bulkEdits++; } } as never,
			{ openEditor: async () => undefined } as never,
			fileService as unknown as IFileService,
			{ undo: async () => undefined } as unknown as IUndoRedoService,
		) as unknown as IUploadApi;
		const target = new ExplorerItem(root, fileService as unknown as IFileService, undefined!, undefined!, undefined, true, false, false, false, 'upload-root');
		target.addChild(new ExplorerItem(destination, fileService as unknown as IFileService, undefined!, undefined!, undefined, true, false, false, false, 'folder'));

		const results = await upload.doUpload(target, {
			items: [{ webkitGetAsEntry: () => directoryEntry('folder') }],
		}, { report() { } }, cts.token);

		assert.strictEqual(confirmations, 1);
		assert.strictEqual(bulkEdits, 0);
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].isFile, false);
		assert.strictEqual(results[0].resource.toString(), destination.toString());
	});

	test('declined overwrite does not delete or write', async () => {
		const root = URI.file('/upload-root');
		const destination = joinPath(root, 'keep.txt');
		const original = new Uint8Array([7]);
		const files = new Map<string, Uint8Array>([[destination.toString(), original]]);
		const cts = store.add(new CancellationTokenSource());
		let writeCount = 0;
		let bulkEdits = 0;
		const fileService = {
			hasCapability: () => false,
			writeFile: async () => { writeCount++; },
			del: async () => undefined,
		};
		const upload = new BrowserFileUpload(
			undefined!,
			{ confirm: async () => ({ confirmed: false }) } as never,
			{ applyBulkEdit: async () => { bulkEdits++; } } as never,
			{ openEditor: async () => undefined } as never,
			fileService as unknown as IFileService,
			{ undo: async () => { throw new Error('undo should not run'); } } as unknown as IUndoRedoService,
		) as unknown as IUploadApi;
		const target = new ExplorerItem(root, fileService as unknown as IFileService, undefined!, undefined!, undefined, true, false, false, false, 'upload-root');
		target.addChild(new ExplorerItem(destination, fileService as unknown as IFileService, undefined!, undefined!, undefined, false, false, false, false, 'keep.txt'));

		const results = await upload.doUpload(target, {
			items: [{ webkitGetAsEntry: () => fileEntry('keep.txt', { name: 'keep.txt', size: 1 } as File) }],
		}, { report() { } }, cts.token);

		assert.strictEqual(bulkEdits, 0);
		assert.strictEqual(writeCount, 0);
		assert.deepStrictEqual(results, []);
		assert.ok(bytesEqual(files.get(destination.toString()), original));
	});

	test('completed small upload still writes and returns the uri', async () => {
		installFileReader('load');
		const root = URI.file('/upload-root');
		const destination = joinPath(root, 'ok.txt');
		const cts = store.add(new CancellationTokenSource());
		const written: URI[] = [];
		const fileService = {
			hasCapability: () => false,
			writeFile: async (resource: URI) => { written.push(resource); },
			del: async () => undefined,
		};
		const upload = new BrowserFileUpload(
			undefined!,
			{ confirm: async () => ({ confirmed: false }) } as never,
			{ applyBulkEdit: async () => undefined } as never,
			{ openEditor: async () => undefined } as never,
			fileService as unknown as IFileService,
			{ undo: async () => undefined } as unknown as IUndoRedoService,
		) as unknown as IUploadApi;
		const target = new ExplorerItem(root, fileService as unknown as IFileService, undefined!, undefined!, undefined, true, false, false, false, 'upload-root');

		const results = await upload.doUpload(target, {
			items: [{ webkitGetAsEntry: () => fileEntry('ok.txt', { name: 'ok.txt', size: 3 } as File) }],
		}, { report() { } }, cts.token);

		assert.strictEqual(written.length, 1);
		assert.strictEqual(written[0].toString(), destination.toString());
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].resource.toString(), destination.toString());
	});

	test('token already canceled before a small read rejects without writeFile', async () => {
		const cts = store.add(new CancellationTokenSource());
		cts.cancel();
		let writeCount = 0;
		const upload = new BrowserFileUpload(
			undefined!,
			undefined!,
			undefined!,
			undefined!,
			{ writeFile: async () => { writeCount++; } } as unknown as IFileService,
			{ undo: async () => undefined } as unknown as IUndoRedoService,
		) as unknown as IUploadApi;

		await assert.rejects(
			() => upload.doUploadFileUnbuffered(URI.file('/upload-root/late.txt'), { name: 'late.txt', size: 2 } as File, () => { }, cts.token),
			(error: unknown) => isCancellationError(error),
		);
		assert.strictEqual(writeCount, 0);
	});
});
