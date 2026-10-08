/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { FileSystemProviderCapabilities, FileSystemProviderErrorCode, FileType, toFileSystemProviderErrorCode } from '../../../../../platform/files/common/files.js';
import { ChatEditingNotebookFileSystemProvider } from '../../browser/chatEditing/notebook/chatEditingNotebookFileSystemProvider.js';
import { ChatEditingNotebookSnapshotScheme } from '../../browser/chatEditing/notebook/chatEditingModifiedNotebookSnapshot.js';
import { IChatEditingService, IChatEditingSession } from '../../common/editing/chatEditingService.js';
import { LocalChatSessionUri } from '../../common/model/chatUri.js';

suite('ChatEditingNotebookFileSystemProvider', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function createProvider(chatEditingService?: IChatEditingService): ChatEditingNotebookFileSystemProvider {
		const service = chatEditingService ?? new class extends mock<IChatEditingService>() { }();
		return new ChatEditingNotebookFileSystemProvider(service);
	}

	test('capabilities flags', () => {
		const provider = createProvider();
		assert.strictEqual(
			provider.capabilities,
			FileSystemProviderCapabilities.Readonly | FileSystemProviderCapabilities.FileAtomicRead
		);
		assert.strictEqual((provider.capabilities & FileSystemProviderCapabilities.FileReadWrite), 0);
		assert.strictEqual((provider.capabilities & FileSystemProviderCapabilities.Readonly), FileSystemProviderCapabilities.Readonly);
		assert.strictEqual((provider.capabilities & FileSystemProviderCapabilities.FileAtomicRead), FileSystemProviderCapabilities.FileAtomicRead);
	});

	test('registerFile registers content, allows reading, and cleans up on dispose', async () => {
		const provider = createProvider();
		const testUri = URI.from({ scheme: ChatEditingNotebookSnapshotScheme, path: '/test-notebook.ipynb' });
		const buffer = VSBuffer.fromString('notebook content payload');

		const registration = ChatEditingNotebookFileSystemProvider.registerFile(testUri, buffer);

		const readContent = await provider.readFile(testUri);
		assert.strictEqual(VSBuffer.wrap(readContent).toString(), 'notebook content payload');

		registration.dispose();

		await assert.rejects(
			async () => provider.readFile(testUri),
			(err: any) => {
				assert.strictEqual(toFileSystemProviderErrorCode(err), FileSystemProviderErrorCode.FileNotFound);
				return true;
			}
		);
	});

	test('registerFile does not delete newer registration on stale dispose', async () => {
		const provider = createProvider();
		const testUri = URI.from({ scheme: ChatEditingNotebookSnapshotScheme, path: '/stale-dispose-test.ipynb' });
		const buffer1 = VSBuffer.fromString('initial content');
		const buffer2 = VSBuffer.fromString('updated content');

		const registration1 = ChatEditingNotebookFileSystemProvider.registerFile(testUri, buffer1);
		disposables.add(ChatEditingNotebookFileSystemProvider.registerFile(testUri, buffer2));

		// Disposing stale registration1 should not remove buffer2
		registration1.dispose();

		const readContent = await provider.readFile(testUri);
		assert.strictEqual(VSBuffer.wrap(readContent).toString(), 'updated content');
	});

	test('reads snapshot contents based on mock IChatEditingService', async () => {
		const sessionId = 'session-123';
		const requestId = 'request-456';
		const undoStop = 'stop-789';
		const viewType = 'jupyter-notebook';
		const expectedBuffer = VSBuffer.fromString('notebook snapshot json representation');

		let capturedRequestId: string | undefined;
		let capturedUri: URI | undefined;
		let capturedStopId: string | undefined;

		const mockSession = new class extends mock<IChatEditingSession>() {
			override async getSnapshotContents(reqId: string, uri: URI, stopId: string | undefined): Promise<VSBuffer | undefined> {
				capturedRequestId = reqId;
				capturedUri = uri;
				capturedStopId = stopId;
				return expectedBuffer;
			}
		}();

		const sessionResource = LocalChatSessionUri.forSession(sessionId);
		const mockService = new class extends mock<IChatEditingService>() {
			override getEditingSession(resource: URI): IChatEditingSession | undefined {
				if (resource.toString() === sessionResource.toString()) {
					return mockSession;
				}
				return undefined;
			}
		}();

		const provider = createProvider(mockService);
		const resourceUri = URI.from({
			scheme: ChatEditingNotebookSnapshotScheme,
			path: '/workspace/test.ipynb',
			query: JSON.stringify({ sessionId, requestId, viewType, undoStop })
		});

		const content = await provider.readFile(resourceUri);
		assert.strictEqual(VSBuffer.wrap(content).toString(), 'notebook snapshot json representation');
		assert.strictEqual(capturedRequestId, requestId);
		assert.strictEqual(capturedUri?.toString(), resourceUri.toString());
		assert.strictEqual(capturedStopId, undoStop);
	});

	test('reads snapshot without undoStop passing undefined to getSnapshotContents', async () => {
		const sessionId = 'session-abc';
		const requestId = 'request-def';
		const viewType = 'jupyter-notebook';
		const expectedBuffer = VSBuffer.fromString('snapshot without stop');

		let capturedStopId: string | undefined = 'initial';

		const mockSession = new class extends mock<IChatEditingSession>() {
			override async getSnapshotContents(_reqId: string, _uri: URI, stopId: string | undefined): Promise<VSBuffer | undefined> {
				capturedStopId = stopId;
				return expectedBuffer;
			}
		}();

		const mockService = new class extends mock<IChatEditingService>() {
			override getEditingSession(resource: URI): IChatEditingSession | undefined {
				if (resource.toString() === LocalChatSessionUri.forSession(sessionId).toString()) {
					return mockSession;
				}
				return undefined;
			}
		}();

		const provider = createProvider(mockService);
		const resourceUri = URI.from({
			scheme: ChatEditingNotebookSnapshotScheme,
			path: '/workspace/test.ipynb',
			query: JSON.stringify({ sessionId, requestId, viewType })
		});

		const content = await provider.readFile(resourceUri);
		assert.strictEqual(VSBuffer.wrap(content).toString(), 'snapshot without stop');
		assert.strictEqual(capturedStopId, undefined);
	});

	test('throws FileNotFound when viewType is missing', async () => {
		const provider = createProvider();
		const resourceUri = URI.from({
			scheme: ChatEditingNotebookSnapshotScheme,
			path: '/test.ipynb',
			query: JSON.stringify({ sessionId: 'session-1', requestId: 'request-1' })
		});

		await assert.rejects(
			async () => provider.readFile(resourceUri),
			(err: any) => {
				assert.strictEqual(toFileSystemProviderErrorCode(err), FileSystemProviderErrorCode.FileNotFound);
				assert.match(err.message, /viewType not found/);
				return true;
			}
		);
	});

	test('throws FileNotFound when session is not found', async () => {
		const mockService = new class extends mock<IChatEditingService>() {
			override getEditingSession(): IChatEditingSession | undefined {
				return undefined;
			}
		}();
		const provider = createProvider(mockService);
		const resourceUri = URI.from({
			scheme: ChatEditingNotebookSnapshotScheme,
			path: '/test.ipynb',
			query: JSON.stringify({ sessionId: 'nonexistent-session', requestId: 'request-1', viewType: 'jupyter' })
		});

		await assert.rejects(
			async () => provider.readFile(resourceUri),
			(err: any) => {
				assert.strictEqual(toFileSystemProviderErrorCode(err), FileSystemProviderErrorCode.FileNotFound);
				assert.match(err.message, /session not found/);
				return true;
			}
		);
	});

	test('throws FileNotFound when requestId is missing', async () => {
		const mockSession = new class extends mock<IChatEditingSession>() { }();
		const mockService = new class extends mock<IChatEditingService>() {
			override getEditingSession(): IChatEditingSession | undefined {
				return mockSession;
			}
		}();
		const provider = createProvider(mockService);
		const resourceUri = URI.from({
			scheme: ChatEditingNotebookSnapshotScheme,
			path: '/test.ipynb',
			query: JSON.stringify({ sessionId: 'session-1', viewType: 'jupyter' })
		});

		await assert.rejects(
			async () => provider.readFile(resourceUri),
			(err: any) => {
				assert.strictEqual(toFileSystemProviderErrorCode(err), FileSystemProviderErrorCode.FileNotFound);
				assert.match(err.message, /session not found/);
				return true;
			}
		);
	});

	test('throws FileNotFound when snapshot is not found', async () => {
		const mockSession = new class extends mock<IChatEditingSession>() {
			override async getSnapshotContents(): Promise<VSBuffer | undefined> {
				return undefined;
			}
		}();
		const sessionId = 'session-1';
		const mockService = new class extends mock<IChatEditingService>() {
			override getEditingSession(resource: URI): IChatEditingSession | undefined {
				if (resource.toString() === LocalChatSessionUri.forSession(sessionId).toString()) {
					return mockSession;
				}
				return undefined;
			}
		}();
		const provider = createProvider(mockService);
		const resourceUri = URI.from({
			scheme: ChatEditingNotebookSnapshotScheme,
			path: '/test.ipynb',
			query: JSON.stringify({ sessionId, requestId: 'req-1', viewType: 'jupyter' })
		});

		await assert.rejects(
			async () => provider.readFile(resourceUri),
			(err: any) => {
				assert.strictEqual(toFileSystemProviderErrorCode(err), FileSystemProviderErrorCode.FileNotFound);
				assert.match(err.message, /snapshot not found/);
				return true;
			}
		);
	});

	test('throws FileNotFound on unparseable query', async () => {
		const provider = createProvider();
		const resourceUri = URI.from({
			scheme: ChatEditingNotebookSnapshotScheme,
			path: '/test.ipynb',
			query: 'not-a-valid-json'
		});

		await assert.rejects(
			async () => provider.readFile(resourceUri),
			(err: any) => {
				assert.strictEqual(toFileSystemProviderErrorCode(err), FileSystemProviderErrorCode.FileNotFound);
				return true;
			}
		);
	});

	test('mkdir, delete, rename throw NoPermissions', async () => {
		const provider = createProvider();
		const testUri = URI.parse('chat-editing-notebook-snapshot-model:/test.ipynb');
		const targetUri = URI.parse('chat-editing-notebook-snapshot-model:/renamed.ipynb');

		await assert.rejects(
			async () => provider.mkdir(testUri),
			(err: any) => {
				assert.strictEqual(toFileSystemProviderErrorCode(err), FileSystemProviderErrorCode.NoPermissions);
				assert.strictEqual(err.message, 'FileSystemProvider is readonly');
				return true;
			}
		);

		await assert.rejects(
			async () => provider.delete(testUri, { recursive: false, useTrash: false, atomic: false }),
			(err: any) => {
				assert.strictEqual(toFileSystemProviderErrorCode(err), FileSystemProviderErrorCode.NoPermissions);
				assert.strictEqual(err.message, 'FileSystemProvider is readonly');
				return true;
			}
		);

		await assert.rejects(
			async () => provider.rename(testUri, targetUri, { overwrite: false }),
			(err: any) => {
				assert.strictEqual(toFileSystemProviderErrorCode(err), FileSystemProviderErrorCode.NoPermissions);
				assert.strictEqual(err.message, 'FileSystemProvider is readonly');
				return true;
			}
		);
	});

	test('readdir throws FileNotADirectory', async () => {
		const provider = createProvider();
		const testUri = URI.parse('chat-editing-notebook-snapshot-model:/test-dir');

		await assert.rejects(
			async () => provider.readdir(testUri),
			(err: any) => {
				assert.strictEqual(toFileSystemProviderErrorCode(err), FileSystemProviderErrorCode.FileNotADirectory);
				assert.strictEqual(err.message, 'File not a directory');
				return true;
			}
		);
	});

	test('stat returns file stat and watch returns disposable', async () => {
		const provider = createProvider();
		const testUri = URI.parse('chat-editing-notebook-snapshot-model:/test.ipynb');

		const stat = await provider.stat(testUri);
		assert.strictEqual(stat.type, FileType.File);
		assert.strictEqual(stat.ctime, 0);
		assert.strictEqual(stat.mtime, 0);
		assert.strictEqual(stat.size, 0);

		const watchDisposable = provider.watch(testUri, { recursive: false, excludes: [] });
		assert.ok(watchDisposable);
		watchDisposable.dispose();
	});
});
