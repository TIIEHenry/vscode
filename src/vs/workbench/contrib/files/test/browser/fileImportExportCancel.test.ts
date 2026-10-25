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
import { INotificationService } from '../../../../../platform/notification/common/notification.js';

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
	filesClosed: string[];
	totalBytesDownloaded: number;
	fileBytesDownloaded: number;
}

interface IDownloadApi {
	downloadViaFileSystemAccess(stat: { resource: URI; name: string; isDirectory: boolean; isFile: boolean; size: number; children?: ReadonlyArray<{ resource: URI; name: string; size: number; isFile: boolean }> }, progress: { report(step: unknown): void }, cts: CancellationTokenSource, activeWindow: { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }): Promise<void>;
	downloadFileUnbufferedBrowser(resource: URI, target: FileSystemWritableFileStream, operation: IDownloadOperation, token: CancellationToken): Promise<void>;
	downloadFileBufferedBrowser(resource: URI, target: FileSystemWritableFileStream, operation: IDownloadOperation, token: CancellationToken): Promise<void>;
	downloadFileBrowser(targetFolder: FileSystemDirectoryHandle, file: { resource: URI; name: string; size: number }, operation: IDownloadOperation, token: CancellationToken): Promise<boolean>;
	downloadFolderBrowser(parent: FileSystemDirectoryHandle, folder: { resource: URI; name: string; children?: ReadonlyArray<{ resource: URI; name: string; size: number; isFile: boolean }> }, operation: IDownloadOperation, token: CancellationToken): Promise<boolean>;
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
		filesClosed: [],
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

function directoryEntry(name: string, children: IUploadEntry[] = []): IUploadEntry {
	return {
		name,
		isFile: false,
		isDirectory: true,
		file: (_resolve, reject) => reject(),
		createReader: () => {
			let pending = children;
			return {
				readEntries: resolve => {
					const chunk = pending;
					pending = [];
					resolve(chunk);
				},
			};
		},
	};
}

function fakeDownloadDirectory(initialNames: string[], createWritableError?: Error): { names: Set<string>; removed: string[]; calls: string[]; handleGets: number; handle: FileSystemDirectoryHandle } {
	const names = new Set(initialNames);
	const removed: string[] = [];
	const calls: string[] = [];
	let handleGets = 0;
	const handle = {
		getFileHandle: async (name: string, options?: { create?: boolean }) => {
			handleGets++;
			if (!names.has(name)) {
				if (!options?.create) {
					throw new DOMException('not found', 'NotFoundError');
				}
				names.add(name);
			}
			return {
				createWritable: async () => {
					if (createWritableError) {
						throw createWritableError;
					}
					return {
						write: async () => { calls.push('write'); },
						close: async () => { calls.push('close'); },
						abort: async () => { calls.push('abort'); },
					};
				},
			};
		},
		removeEntry: async (name: string) => {
			if (!names.has(name)) {
				throw new DOMException('not found', 'NotFoundError');
			}
			names.delete(name);
			removed.push(name);
		},
	};
	return {
		names,
		removed,
		calls,
		get handleGets() { return handleGets; },
		handle: handle as unknown as FileSystemDirectoryHandle,
	};
}

interface IFakeFsNode {
	files: Set<string>;
	dirs: Map<string, IFakeFsNode>;
	handle: FileSystemDirectoryHandle;
}

function fakeDownloadTree(): {
	root: FileSystemDirectoryHandle;
	removed: string[];
	calls: string[];
	hasFile(path: string): boolean;
	hasDir(path: string): boolean;
	putDir(path: string): void;
	putFile(path: string): void;
} {
	const removed: string[] = [];
	const calls: string[] = [];

	const makeNode = (nodePath: string): IFakeFsNode => {
		const node: IFakeFsNode = {
			files: new Set(),
			dirs: new Map(),
			handle: undefined!,
		};
		const handle = {
			getFileHandle: async (name: string, options?: { create?: boolean }) => {
				if (node.dirs.has(name)) {
					throw new DOMException('type mismatch', 'TypeMismatchError');
				}
				if (!node.files.has(name)) {
					if (!options?.create) {
						throw new DOMException('not found', 'NotFoundError');
					}
					node.files.add(name);
				}
				const filePath = nodePath ? `${nodePath}/${name}` : name;
				return {
					createWritable: async () => ({
						write: async () => { calls.push(`write:${filePath}`); },
						close: async () => { calls.push(`close:${filePath}`); },
						abort: async () => { calls.push(`abort:${filePath}`); },
					}),
				};
			},
			getDirectoryHandle: async (name: string, options?: { create?: boolean }) => {
				if (node.files.has(name)) {
					throw new DOMException('type mismatch', 'TypeMismatchError');
				}
				let child = node.dirs.get(name);
				if (!child) {
					if (!options?.create) {
						throw new DOMException('not found', 'NotFoundError');
					}
					const childPath = nodePath ? `${nodePath}/${name}` : name;
					child = makeNode(childPath);
					node.dirs.set(name, child);
				}
				return child.handle;
			},
			removeEntry: async (name: string, options?: { recursive?: boolean }) => {
				const childDir = node.dirs.get(name);
				if (childDir) {
					const empty = childDir.files.size === 0 && childDir.dirs.size === 0;
					if (!empty && !options?.recursive) {
						throw new DOMException('not empty', 'InvalidModificationError');
					}
					node.dirs.delete(name);
					removed.push(nodePath ? `${nodePath}/${name}` : name);
					return;
				}
				if (!node.files.has(name)) {
					throw new DOMException('not found', 'NotFoundError');
				}
				node.files.delete(name);
				removed.push(nodePath ? `${nodePath}/${name}` : name);
			},
		};
		node.handle = handle as unknown as FileSystemDirectoryHandle;
		return node;
	};

	const root = makeNode('');
	const lookup = (path: string): IFakeFsNode | undefined => {
		if (!path) {
			return root;
		}
		let current: IFakeFsNode | undefined = root;
		for (const part of path.split('/')) {
			current = current?.dirs.get(part);
			if (!current) {
				return undefined;
			}
		}
		return current;
	};
	const ensureDir = (path: string): IFakeFsNode => {
		let current = root;
		let currentPath = '';
		for (const part of path.split('/')) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			let child = current.dirs.get(part);
			if (!child) {
				child = makeNode(currentPath);
				current.dirs.set(part, child);
			}
			current = child;
		}
		return current;
	};

	return {
		root: root.handle,
		removed,
		calls,
		hasFile(path: string): boolean {
			const slash = path.lastIndexOf('/');
			const parentPath = slash === -1 ? '' : path.slice(0, slash);
			const name = slash === -1 ? path : path.slice(slash + 1);
			return !!lookup(parentPath)?.files.has(name);
		},
		hasDir(path: string): boolean {
			if (!path) {
				return false;
			}
			return !!lookup(path);
		},
		putDir(path: string): void {
			ensureDir(path);
		},
		putFile(path: string): void {
			const slash = path.lastIndexOf('/');
			const parentPath = slash === -1 ? '' : path.slice(0, slash);
			const name = slash === -1 ? path : path.slice(slash + 1);
			const parent = parentPath ? ensureDir(parentPath) : root;
			parent.files.add(name);
		},
	};
}

suite('Files - Browser download cancel', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const resource = URI.file('/download/note.txt');

	function createDownload(fileService: object): IDownloadApi {
		return createDownloadWithNotification(fileService, { error() { } } as unknown as INotificationService);
	}

	function createDownloadWithNotification(fileService: object, notificationService: INotificationService): IDownloadApi {
		return new FileDownload(
			fileService as IFileService,
			undefined!,
			undefined!,
			{ warn() { } } as never,
			undefined!,
			undefined!,
			notificationService,
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

	test('canceled token does not create a download file handle', async () => {
		const cts = store.add(new CancellationTokenSource());
		cts.cancel();
		const dir = fakeDownloadDirectory([]);
		const download = createDownload({
			readFile: async () => { throw new Error('should not read'); },
		});
		const operation = downloadOperation(store);

		await download.downloadFileBrowser(dir.handle, { resource, name: 'note.txt', size: 4 }, operation, cts.token);

		assert.strictEqual(dir.handleGets, 0);
		assert.strictEqual(operation.filesDownloaded, 0);
		assert.deepStrictEqual(dir.removed, []);
		assert.strictEqual(dir.names.has('note.txt'), false);
	});

	test('new download file is removed when canceled before close', async () => {
		const cts = store.add(new CancellationTokenSource());
		const dir = fakeDownloadDirectory([]);
		const download = createDownload({
			readFile: async () => {
				cts.cancel();
				return { name: 'note.txt', size: 4, value: VSBuffer.fromString('data') };
			},
		});

		await download.downloadFileBrowser(dir.handle, { resource, name: 'note.txt', size: 4 }, downloadOperation(store), cts.token);

		assert.deepStrictEqual(dir.calls, ['abort']);
		assert.deepStrictEqual(dir.removed, ['note.txt']);
		assert.strictEqual(dir.names.has('note.txt'), false);
	});

	test('existing download file is kept when canceled before close', async () => {
		const cts = store.add(new CancellationTokenSource());
		const dir = fakeDownloadDirectory(['note.txt']);
		const download = createDownload({
			readFile: async () => {
				cts.cancel();
				return { name: 'note.txt', size: 4, value: VSBuffer.fromString('data') };
			},
		});

		await download.downloadFileBrowser(dir.handle, { resource, name: 'note.txt', size: 4 }, downloadOperation(store), cts.token);

		assert.deepStrictEqual(dir.calls, ['abort']);
		assert.deepStrictEqual(dir.removed, []);
		assert.strictEqual(dir.names.has('note.txt'), true);
	});

	test('new download file is removed when createWritable fails', async () => {
		const cts = store.add(new CancellationTokenSource());
		const dir = fakeDownloadDirectory([], new Error('cannot write'));
		const download = createDownload({
			readFile: async () => { throw new Error('should not read'); },
		});

		await assert.rejects(
			() => download.downloadFileBrowser(dir.handle, { resource, name: 'note.txt', size: 4 }, downloadOperation(store), cts.token),
			/cannot write/,
		);
		assert.deepStrictEqual(dir.removed, ['note.txt']);
		assert.strictEqual(dir.names.has('note.txt'), false);
	});

	test('existing download file is kept when createWritable fails', async () => {
		const cts = store.add(new CancellationTokenSource());
		const dir = fakeDownloadDirectory(['note.txt'], new Error('cannot write'));
		const download = createDownload({
			readFile: async () => { throw new Error('should not read'); },
		});

		await assert.rejects(
			() => download.downloadFileBrowser(dir.handle, { resource, name: 'note.txt', size: 4 }, downloadOperation(store), cts.token),
			/cannot write/,
		);
		assert.deepStrictEqual(dir.removed, []);
		assert.strictEqual(dir.names.has('note.txt'), true);
	});

	test('new large download file is removed when canceled before close', async () => {
		const cts = store.add(new CancellationTokenSource());
		const dir = fakeDownloadDirectory([]);
		const download = createDownload({
			readFileStream: async () => {
				cts.cancel();
				return { name: 'note.txt', size: ByteSize.MB + 1, value: newWriteableBufferStream() };
			},
		});

		await download.downloadFileBrowser(dir.handle, { resource, name: 'note.txt', size: ByteSize.MB + 1 }, downloadOperation(store), cts.token);

		assert.deepStrictEqual(dir.calls, ['abort']);
		assert.deepStrictEqual(dir.removed, ['note.txt']);
		assert.strictEqual(dir.names.has('note.txt'), false);
	});

	test('completed small download keeps the new file', async () => {
		const cts = store.add(new CancellationTokenSource());
		const dir = fakeDownloadDirectory([]);
		const download = createDownload({
			readFile: async () => ({ name: 'note.txt', size: 4, value: VSBuffer.fromString('data') }),
		});

		await download.downloadFileBrowser(dir.handle, { resource, name: 'note.txt', size: 4 }, downloadOperation(store), cts.token);

		assert.deepStrictEqual(dir.calls, ['write', 'close']);
		assert.deepStrictEqual(dir.removed, []);
		assert.strictEqual(dir.names.has('note.txt'), true);
	});

	test('canceled token does not create a download folder', async () => {
		const cts = store.add(new CancellationTokenSource());
		cts.cancel();
		const tree = fakeDownloadTree();
		let reads = 0;
		const download = createDownload({
			readFile: async () => {
				reads++;
				return { name: 'a.txt', size: 4, value: VSBuffer.fromString('data') };
			},
		});

		const committed = await download.downloadFolderBrowser(tree.root, {
			resource: URI.file('/src/notes'),
			name: 'notes',
			children: [{ resource: URI.file('/src/notes/a.txt'), name: 'a.txt', size: 4, isFile: true }],
		}, downloadOperation(store), cts.token);

		assert.strictEqual(committed, false);
		assert.strictEqual(tree.hasDir('notes'), false);
		assert.deepStrictEqual(tree.removed, []);
		assert.deepStrictEqual(tree.calls, []);
		assert.strictEqual(reads, 0);
	});

	test('canceled download of a new folder removes the folder and its file', async () => {
		const cts = store.add(new CancellationTokenSource());
		const tree = fakeDownloadTree();
		const download = createDownload({
			readFile: async () => {
				cts.cancel();
				return { name: 'a.txt', size: 4, value: VSBuffer.fromString('data') };
			},
		});

		const committed = await download.downloadFolderBrowser(tree.root, {
			resource: URI.file('/src/notes'),
			name: 'notes',
			children: [{ resource: URI.file('/src/notes/a.txt'), name: 'a.txt', size: 4, isFile: true }],
		}, downloadOperation(store), cts.token);

		assert.strictEqual(committed, false);
		assert.strictEqual(tree.hasDir('notes'), false);
		assert.strictEqual(tree.hasFile('notes/a.txt'), false);
		assert.deepStrictEqual(tree.calls, ['abort:notes/a.txt']);
		assert.deepStrictEqual(tree.removed, ['notes/a.txt', 'notes']);
	});

	test('canceled download into an existing folder keeps the folder and its old file', async () => {
		const cts = store.add(new CancellationTokenSource());
		const tree = fakeDownloadTree();
		tree.putDir('kept');
		tree.putFile('kept/old.txt');
		const download = createDownload({
			readFile: async () => {
				cts.cancel();
				return { name: 'a.txt', size: 4, value: VSBuffer.fromString('data') };
			},
		});

		const committed = await download.downloadFolderBrowser(tree.root, {
			resource: URI.file('/src/kept'),
			name: 'kept',
			children: [{ resource: URI.file('/src/kept/a.txt'), name: 'a.txt', size: 4, isFile: true }],
		}, downloadOperation(store), cts.token);

		assert.strictEqual(committed, false);
		assert.strictEqual(tree.hasDir('kept'), true);
		assert.strictEqual(tree.hasFile('kept/old.txt'), true);
		assert.strictEqual(tree.hasFile('kept/a.txt'), false);
		assert.deepStrictEqual(tree.removed, ['kept/a.txt']);
	});

	test('partial folder download keeps closed files and removes the unfinished file', async () => {
		const cts = store.add(new CancellationTokenSource());
		const tree = fakeDownloadTree();
		const download = createDownload({
			readFile: async (resource: URI) => {
				if (resource.path.endsWith('/b.txt')) {
					cts.cancel();
				}
				return { name: 'file.txt', size: 4, value: VSBuffer.fromString('data') };
			},
		});

		const committed = await download.downloadFolderBrowser(tree.root, {
			resource: URI.file('/src/notes'),
			name: 'notes',
			children: [
				{ resource: URI.file('/src/notes/a.txt'), name: 'a.txt', size: 4, isFile: true },
				{ resource: URI.file('/src/notes/b.txt'), name: 'b.txt', size: 4, isFile: true },
			],
		}, downloadOperation(store), cts.token);

		assert.strictEqual(committed, true);
		assert.strictEqual(tree.hasDir('notes'), true);
		assert.strictEqual(tree.hasFile('notes/a.txt'), true);
		assert.strictEqual(tree.hasFile('notes/b.txt'), false);
		assert.deepStrictEqual(tree.calls, ['write:notes/a.txt', 'close:notes/a.txt', 'abort:notes/b.txt']);
		assert.deepStrictEqual(tree.removed, ['notes/b.txt']);
	});

	test('canceled nested download removes empty directories this download created', async () => {
		const cts = store.add(new CancellationTokenSource());
		const tree = fakeDownloadTree();
		const nested = URI.file('/src/notes/nested');
		const nestedFile = URI.file('/src/notes/nested/b.txt');
		const download = createDownload({
			readFile: async () => {
				cts.cancel();
				return { name: 'b.txt', size: 4, value: VSBuffer.fromString('data') };
			},
			resolve: async (resource: URI) => ({
				resource,
				name: 'nested',
				children: [{ resource: nestedFile, name: 'b.txt', size: 4, isFile: true }],
			}),
		});

		const committed = await download.downloadFolderBrowser(tree.root, {
			resource: URI.file('/src/notes'),
			name: 'notes',
			children: [{ resource: nested, name: 'nested', size: 0, isFile: false }],
		}, downloadOperation(store), cts.token);

		assert.strictEqual(committed, false);
		assert.strictEqual(tree.hasDir('notes'), false);
		assert.strictEqual(tree.hasDir('notes/nested'), false);
		assert.strictEqual(tree.hasFile('notes/nested/b.txt'), false);
		assert.deepStrictEqual(tree.removed, ['notes/nested/b.txt', 'notes/nested', 'notes']);
	});

	test('folder download keeps a parent that already closed a file when a nested folder cancels', async () => {
		const cts = store.add(new CancellationTokenSource());
		const tree = fakeDownloadTree();
		const nested = URI.file('/src/notes/nested');
		const nestedFile = URI.file('/src/notes/nested/b.txt');
		const download = createDownload({
			readFile: async (resource: URI) => {
				if (resource.path.endsWith('/b.txt')) {
					cts.cancel();
				}
				return { name: 'file.txt', size: 4, value: VSBuffer.fromString('data') };
			},
			resolve: async (resource: URI) => ({
				resource,
				name: 'nested',
				children: [{ resource: nestedFile, name: 'b.txt', size: 4, isFile: true }],
			}),
		});

		const committed = await download.downloadFolderBrowser(tree.root, {
			resource: URI.file('/src/notes'),
			name: 'notes',
			children: [
				{ resource: URI.file('/src/notes/a.txt'), name: 'a.txt', size: 4, isFile: true },
				{ resource: nested, name: 'nested', size: 0, isFile: false },
			],
		}, downloadOperation(store), cts.token);

		assert.strictEqual(committed, true);
		assert.strictEqual(tree.hasDir('notes'), true);
		assert.strictEqual(tree.hasFile('notes/a.txt'), true);
		assert.strictEqual(tree.hasDir('notes/nested'), false);
		assert.strictEqual(tree.hasFile('notes/nested/b.txt'), false);
		assert.deepStrictEqual(tree.removed, ['notes/nested/b.txt', 'notes/nested']);
	});

	test('completed empty folder download leaves the directory', async () => {
		const cts = store.add(new CancellationTokenSource());
		const tree = fakeDownloadTree();
		const download = createDownload({
			readFile: async () => { throw new Error('should not read'); },
		});

		const committed = await download.downloadFolderBrowser(tree.root, {
			resource: URI.file('/src/notes'),
			name: 'notes',
			children: [],
		}, downloadOperation(store), cts.token);

		assert.strictEqual(committed, false);
		assert.strictEqual(tree.hasDir('notes'), true);
		assert.deepStrictEqual(tree.removed, []);
	});

	test('read failure removes a new download folder', async () => {
		const cts = store.add(new CancellationTokenSource());
		const tree = fakeDownloadTree();
		const download = createDownload({
			readFile: async () => { throw new Error('read failed'); },
		});

		await assert.rejects(
			() => download.downloadFolderBrowser(tree.root, {
				resource: URI.file('/src/notes'),
				name: 'notes',
				children: [{ resource: URI.file('/src/notes/a.txt'), name: 'a.txt', size: 4, isFile: true }],
			}, downloadOperation(store), cts.token),
			/read failed/,
		);
		assert.strictEqual(tree.hasDir('notes'), false);
		assert.strictEqual(tree.hasFile('notes/a.txt'), false);
		assert.deepStrictEqual(tree.calls, ['abort:notes/a.txt']);
		assert.deepStrictEqual(tree.removed, ['notes/a.txt', 'notes']);
	});

	test('directory picker cancellation ends quietly without a notification', async () => {
		const cts = store.add(new CancellationTokenSource());
		const errors: string[] = [];
		const download = createDownloadWithNotification({}, { error: message => errors.push(String(message)) } as unknown as INotificationService);

		await download.downloadViaFileSystemAccess(
			{ resource: URI.file('/src/notes'), name: 'notes', isDirectory: true, isFile: false, size: 0, children: [] },
			{ report() { } },
			cts,
			{ showDirectoryPicker: async () => { throw new DOMException('cancelled', 'AbortError'); } },
		);

		assert.strictEqual(cts.token.isCancellationRequested, true);
		assert.deepStrictEqual(errors, []);
	});

	test('write failure notifies with the already closed file and rethrows', async () => {
		const cts = store.add(new CancellationTokenSource());
		const tree = fakeDownloadTree();
		const errors: string[] = [];
		const download = createDownloadWithNotification({
			readFile: async (resource: URI) => {
				if (resource.path.endsWith('/b.txt')) {
					throw new Error('read failed');
				}
				return { name: 'a.txt', size: 4, value: VSBuffer.fromString('data') };
			},
		}, { error: message => errors.push(String(message)) } as unknown as INotificationService);

		await assert.rejects(
			() => download.downloadViaFileSystemAccess(
				{
					resource: URI.file('/src/notes'),
					name: 'notes',
					isDirectory: true,
					isFile: false,
					size: 0,
					children: [
						{ resource: URI.file('/src/notes/a.txt'), name: 'a.txt', size: 4, isFile: true },
						{ resource: URI.file('/src/notes/b.txt'), name: 'b.txt', size: 4, isFile: true },
					],
				},
				{ report() { } },
				cts,
				{ showDirectoryPicker: async () => tree.root },
			),
			/read failed/,
		);

		assert.strictEqual(errors.length, 1);
		assert.ok(errors[0].includes('a.txt'));
		assert.ok(errors[0].includes('read failed'));
		assert.deepStrictEqual(tree.calls, ['write:notes/a.txt', 'close:notes/a.txt', 'abort:notes/b.txt']);
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
			exists: async () => true,
			resolve: async () => ({ children: [] }),
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

	function rememberUploadFiles(resources: URI[]): Map<string, URI> {
		return new Map(resources.map(resource => [resource.toString(), resource]));
	}

	// FileSystemProviderCapabilities is a const enum and is erased from this test bundle.
	const PathCaseSensitive = 1 << 10;

	function uploadFileService(files: Map<string, URI>, onWrite?: (resource: URI) => void, caseSensitive = false) {
		return {
			hasCapability: (_resource: URI, capability: number) => caseSensitive && capability === PathCaseSensitive,
			exists: async (resource: URI) => files.has(resource.toString()),
			resolve: async (resource: URI) => {
				const prefix = resource.toString();
				if (!files.has(prefix)) {
					throw new FileOperationError('missing', FileOperationResult.FILE_NOT_FOUND);
				}
				const children: { resource: URI; name: string }[] = [];
				for (const [key, uri] of files) {
					if (!key.startsWith(prefix + '/')) {
						continue;
					}
					const name = key.slice(prefix.length + 1);
					if (name.includes('/')) {
						continue;
					}
					children.push({ resource: uri, name });
				}
				return { children };
			},
			createFolder: async (resource: URI) => {
				files.set(resource.toString(), resource);
			},
			writeFile: async (resource: URI) => {
				files.set(resource.toString(), resource);
				onWrite?.(resource);
			},
			del: async (resource: URI, options?: { recursive?: boolean }) => {
				const key = resource.toString();
				const victims = [...files.keys()].filter(existing => existing === key || (options?.recursive === true && existing.startsWith(key + '/')));
				if (victims.length === 0) {
					throw new FileOperationError('missing', FileOperationResult.FILE_NOT_FOUND);
				}
				for (const victim of victims) {
					files.delete(victim);
				}
			},
		};
	}

	test('canceled new directory upload removes the directory and its child file', async () => {
		installFileReader('load');
		const root = URI.file('/upload-root');
		const folder = joinPath(root, 'fresh');
		const child = joinPath(folder, 'a.txt');
		const files = rememberUploadFiles([]);
		const cts = store.add(new CancellationTokenSource());
		let bulkEdits = 0;
		const fileService = uploadFileService(files, resource => {
			if (resource.toString() === child.toString()) {
				cts.cancel();
			}
		});
		const upload = new BrowserFileUpload(
			undefined!,
			{ confirm: async () => ({ confirmed: true }) } as never,
			{ applyBulkEdit: async () => { bulkEdits++; } } as never,
			{ openEditor: async () => undefined } as never,
			fileService as unknown as IFileService,
			{ undo: async () => undefined } as unknown as IUndoRedoService,
		) as unknown as IUploadApi;
		const target = new ExplorerItem(root, fileService as unknown as IFileService, undefined!, undefined!, undefined, true, false, false, false, 'upload-root');

		const results = await upload.doUpload(target, {
			items: [{
				webkitGetAsEntry: () => directoryEntry('fresh', [
					fileEntry('a.txt', { name: 'a.txt', size: 3 } as File),
				]),
			}],
		}, { report() { } }, cts.token);

		assert.strictEqual(bulkEdits, 0);
		assert.deepStrictEqual(results, []);
		assert.strictEqual(files.has(child.toString()), false);
		assert.strictEqual(files.has(folder.toString()), false);
	});

	test('canceled upload into an existing directory removes only names created by this upload', async () => {
		installFileReader('load');
		const root = URI.file('/upload-root');
		const folder = joinPath(root, 'kept');
		const oldFile = joinPath(folder, 'old.txt');
		const nested = joinPath(folder, 'nested');
		const stayed = joinPath(nested, 'stay.txt');
		const fresh = joinPath(nested, 'fresh.txt');
		const createdFile = joinPath(folder, 'new.txt');
		const createdFolder = joinPath(folder, 'sub');
		const createdNested = joinPath(createdFolder, 'b.txt');
		const files = rememberUploadFiles([folder, oldFile, nested, stayed]);
		const cts = store.add(new CancellationTokenSource());
		let bulkEdits = 0;
		const fileService = uploadFileService(files, resource => {
			if (resource.toString() === createdNested.toString()) {
				cts.cancel();
			}
		});
		const upload = new BrowserFileUpload(
			undefined!,
			{ confirm: async () => ({ confirmed: true }) } as never,
			{ applyBulkEdit: async () => { bulkEdits++; } } as never,
			{ openEditor: async () => undefined } as never,
			fileService as unknown as IFileService,
			{ undo: async () => undefined } as unknown as IUndoRedoService,
		) as unknown as IUploadApi;
		const target = new ExplorerItem(root, fileService as unknown as IFileService, undefined!, undefined!, undefined, true, false, false, false, 'upload-root');
		target.addChild(new ExplorerItem(folder, fileService as unknown as IFileService, undefined!, undefined!, undefined, true, false, false, false, 'kept'));

		const results = await upload.doUpload(target, {
			items: [{
				webkitGetAsEntry: () => directoryEntry('kept', [
					fileEntry('new.txt', { name: 'new.txt', size: 3 } as File),
					directoryEntry('nested', [
						fileEntry('fresh.txt', { name: 'fresh.txt', size: 3 } as File),
					]),
					directoryEntry('sub', [
						fileEntry('b.txt', { name: 'b.txt', size: 3 } as File),
					]),
				]),
			}],
		}, { report() { } }, cts.token);

		assert.strictEqual(bulkEdits, 0);
		assert.deepStrictEqual(results, []);
		assert.strictEqual(files.has(folder.toString()), true);
		assert.strictEqual(files.has(oldFile.toString()), true);
		assert.strictEqual(files.has(nested.toString()), true);
		assert.strictEqual(files.has(stayed.toString()), true);
		assert.strictEqual(files.has(fresh.toString()), false);
		assert.strictEqual(files.has(createdFile.toString()), false);
		assert.strictEqual(files.has(createdFolder.toString()), false);
		assert.strictEqual(files.has(createdNested.toString()), false);
	});

	test('completed new directory upload keeps the directory and returns it', async () => {
		installFileReader('load');
		const root = URI.file('/upload-root');
		const folder = joinPath(root, 'fresh');
		const child = joinPath(folder, 'a.txt');
		const files = rememberUploadFiles([]);
		const cts = store.add(new CancellationTokenSource());
		let bulkEdits = 0;
		const fileService = uploadFileService(files);
		const upload = new BrowserFileUpload(
			undefined!,
			{ confirm: async () => ({ confirmed: true }) } as never,
			{ applyBulkEdit: async () => { bulkEdits++; } } as never,
			{ openEditor: async () => undefined } as never,
			fileService as unknown as IFileService,
			{ undo: async () => undefined } as unknown as IUndoRedoService,
		) as unknown as IUploadApi;
		const target = new ExplorerItem(root, fileService as unknown as IFileService, undefined!, undefined!, undefined, true, false, false, false, 'upload-root');

		const results = await upload.doUpload(target, {
			items: [{
				webkitGetAsEntry: () => directoryEntry('fresh', [
					fileEntry('a.txt', { name: 'a.txt', size: 3 } as File),
				]),
			}],
		}, { report() { } }, cts.token);

		assert.strictEqual(bulkEdits, 0);
		assert.strictEqual(results.length, 1);
		assert.strictEqual(results[0].isFile, false);
		assert.strictEqual(results[0].resource.toString(), folder.toString());
		assert.strictEqual(files.has(folder.toString()), true);
		assert.strictEqual(files.has(child.toString()), true);
	});

	async function uploadDifferentCase(caseSensitive: boolean): Promise<{ deleted: string[]; hasExisting: boolean; hasUploaded: boolean; results: IUploadResult[] }> {
		installFileReader('load');
		const root = URI.file('/upload-root');
		const folder = joinPath(root, 'kept');
		const existing = joinPath(folder, 'Old.txt');
		const uploaded = joinPath(folder, 'old.txt');
		const files = rememberUploadFiles([folder, existing]);
		const cts = store.add(new CancellationTokenSource());
		const deleted: string[] = [];
		const base = uploadFileService(files, resource => {
			if (resource.toString() === uploaded.toString()) {
				cts.cancel();
			}
		}, caseSensitive);
		const fileService = {
			...base,
			del: async (resource: URI, options?: { recursive?: boolean }) => {
				deleted.push(resource.toString());
				await base.del(resource, options);
			},
		};
		const upload = new BrowserFileUpload(
			undefined!,
			{ confirm: async () => ({ confirmed: true }) } as never,
			{ applyBulkEdit: async () => { throw new Error('bulk edit'); } } as never,
			{ openEditor: async () => undefined } as never,
			fileService as unknown as IFileService,
			{ undo: async () => undefined } as unknown as IUndoRedoService,
		) as unknown as IUploadApi;
		const target = new ExplorerItem(root, fileService as unknown as IFileService, undefined!, undefined!, undefined, true, false, false, false, 'upload-root');
		target.addChild(new ExplorerItem(folder, fileService as unknown as IFileService, undefined!, undefined!, undefined, true, false, false, false, 'kept'));

		const results = await upload.doUpload(target, {
			items: [{
				webkitGetAsEntry: () => directoryEntry('kept', [
					fileEntry('old.txt', { name: 'old.txt', size: 3 } as File),
				]),
			}],
		}, { report() { } }, cts.token);

		return {
			deleted,
			hasExisting: files.has(existing.toString()),
			hasUploaded: files.has(uploaded.toString()),
			results,
		};
	}

	test('canceled case-insensitive upload does not delete the existing child it overwrote', async () => {
		const { deleted, hasExisting, hasUploaded, results } = await uploadDifferentCase(false);

		assert.deepStrictEqual(results, []);
		assert.deepStrictEqual(deleted, []);
		assert.strictEqual(hasExisting, true);
		assert.strictEqual(hasUploaded, true);
	});

	test('canceled case-sensitive upload deletes only the new different-cased child', async () => {
		const root = URI.file('/upload-root');
		const { deleted, hasExisting, hasUploaded, results } = await uploadDifferentCase(true);

		assert.deepStrictEqual(results, []);
		assert.deepStrictEqual(deleted, [joinPath(root, 'kept', 'old.txt').toString()]);
		assert.strictEqual(hasExisting, true);
		assert.strictEqual(hasUploaded, false);
	});
});
