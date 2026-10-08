/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../../../base/common/buffer.js';
import { Event } from '../../../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../../../base/common/map.js';
import { URI } from '../../../../../../base/common/uri.js';
import { createFileSystemProviderError, FileSystemProviderCapabilities, FileSystemProviderErrorCode, FileType, IFileChange, IFileDeleteOptions, IFileOverwriteOptions, IFileService, IFileSystemProvider, IStat, IWatchOptions } from '../../../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution } from '../../../../../common/contributions.js';
import { IChatEditingService } from '../../../common/editing/chatEditingService.js';
import { LocalChatSessionUri } from '../../../common/model/chatUri.js';
import { ChatEditingNotebookSnapshotScheme } from './chatEditingModifiedNotebookSnapshot.js';


export class ChatEditingNotebookFileSystemProviderContrib extends Disposable implements IWorkbenchContribution {
	static ID = 'chatEditingNotebookFileSystemProviderContribution';
	constructor(
		@IFileService private readonly fileService: IFileService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {

		super();
		const fileSystemProvider = instantiationService.createInstance(ChatEditingNotebookFileSystemProvider);
		this._register(this.fileService.registerProvider(ChatEditingNotebookSnapshotScheme, fileSystemProvider));
	}
}

type ChatEditingSnapshotNotebookContentQueryData = { sessionId: string; requestId: string | undefined; undoStop: string | undefined; viewType: string };

export class ChatEditingNotebookFileSystemProvider implements IFileSystemProvider {
	private static registeredFiles = new ResourceMap<VSBuffer>();
	public readonly capabilities: FileSystemProviderCapabilities = FileSystemProviderCapabilities.Readonly | FileSystemProviderCapabilities.FileAtomicRead;
	public static registerFile(resource: URI, buffer: VSBuffer): IDisposable {
		ChatEditingNotebookFileSystemProvider.registeredFiles.set(resource, buffer);
		return {
			dispose() {
				if (ChatEditingNotebookFileSystemProvider.registeredFiles.get(resource) === buffer) {
					ChatEditingNotebookFileSystemProvider.registeredFiles.delete(resource);
				}
			}
		};
	}

	constructor(@IChatEditingService private readonly _chatEditingService: IChatEditingService) { }

	readonly onDidChangeCapabilities = Event.None;
	readonly onDidChangeFile: Event<readonly IFileChange[]> = Event.None;
	watch(_resource: URI, _opts: IWatchOptions): IDisposable {
		return Disposable.None;
	}
	async stat(_resource: URI): Promise<IStat> {
		return {
			type: FileType.File,
			ctime: 0,
			mtime: 0,
			size: 0
		};
	}
	async mkdir(_resource: URI): Promise<void> {
		throw createFileSystemProviderError('FileSystemProvider is readonly', FileSystemProviderErrorCode.NoPermissions);
	}
	async readdir(_resource: URI): Promise<[string, FileType][]> {
		throw createFileSystemProviderError('File not a directory', FileSystemProviderErrorCode.FileNotADirectory);
	}
	async delete(_resource: URI, _opts: IFileDeleteOptions): Promise<void> {
		throw createFileSystemProviderError('FileSystemProvider is readonly', FileSystemProviderErrorCode.NoPermissions);
	}
	async rename(_from: URI, _to: URI, _opts: IFileOverwriteOptions): Promise<void> {
		throw createFileSystemProviderError('FileSystemProvider is readonly', FileSystemProviderErrorCode.NoPermissions);
	}
	async readFile(resource: URI): Promise<Uint8Array> {
		const buffer = ChatEditingNotebookFileSystemProvider.registeredFiles.get(resource);
		if (buffer) {
			return buffer.buffer;
		}
		let queryData: ChatEditingSnapshotNotebookContentQueryData;
		try {
			queryData = JSON.parse(resource.query) as ChatEditingSnapshotNotebookContentQueryData;
		} catch {
			throw createFileSystemProviderError('File not found', FileSystemProviderErrorCode.FileNotFound);
		}
		if (!queryData?.viewType) {
			throw createFileSystemProviderError('File not found, viewType not found', FileSystemProviderErrorCode.FileNotFound);
		}
		const session = this._chatEditingService.getEditingSession(LocalChatSessionUri.forSession(queryData.sessionId));
		if (!session || !queryData.requestId) {
			throw createFileSystemProviderError('File not found, session not found', FileSystemProviderErrorCode.FileNotFound);
		}
		const snapshotEntry = await session.getSnapshotContents(queryData.requestId, resource, queryData.undoStop || undefined);
		if (!snapshotEntry) {
			throw createFileSystemProviderError('File not found, snapshot not found', FileSystemProviderErrorCode.FileNotFound);
		}

		return snapshotEntry.buffer;
	}
}
