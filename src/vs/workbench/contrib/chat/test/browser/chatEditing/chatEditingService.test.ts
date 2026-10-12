/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../../base/common/event.js';
import { Disposable, DisposableStore, IDisposable, IReference } from '../../../../../../base/common/lifecycle.js';
import { autorun, IReader, observableValue, waitForState } from '../../../../../../base/common/observable.js';
import { isEqual } from '../../../../../../base/common/resources.js';
import { assertType } from '../../../../../../base/common/types.js';
import { URI } from '../../../../../../base/common/uri.js';
import { mock } from '../../../../../../base/test/common/mock.js';
import { runWithFakedTimers } from '../../../../../../base/test/common/timeTravelScheduler.js';
import { assertThrowsAsync, ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { EditOperation } from '../../../../../../editor/common/core/editOperation.js';
import { Position } from '../../../../../../editor/common/core/position.js';
import { Range } from '../../../../../../editor/common/core/range.js';
import { TextEdit } from '../../../../../../editor/common/languages.js';
import { DeferredPromise, timeout } from '../../../../../../base/common/async.js';
import { VSBuffer } from '../../../../../../base/common/buffer.js';
import { FileOperationError, FileOperationResult, IFileService } from '../../../../../../platform/files/common/files.js';
import { IBulkEditResult, IBulkEditService } from '../../../../../../editor/browser/services/bulkEditService.js';
import { IEditorWorkerService } from '../../../../../../editor/common/services/editorWorker.js';
import { IModelService } from '../../../../../../editor/common/services/model.js';
import { IResolvedTextEditorModel, ITextModelService } from '../../../../../../editor/common/services/resolverService.js';
import { SyncDescriptor } from '../../../../../../platform/instantiation/common/descriptors.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../../../platform/instantiation/common/serviceCollection.js';
import { MockContextKeyService } from '../../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { IWorkbenchAssignmentService } from '../../../../../services/assignment/common/assignmentService.js';
import { NullWorkbenchAssignmentService } from '../../../../../services/assignment/test/common/nullAssignmentService.js';
import { nullExtensionDescription } from '../../../../../services/extensions/common/extensions.js';
import { TestTextFileService, workbenchInstantiationService } from '../../../../../test/browser/workbenchTestServices.js';
import { ITextFileService, isTextFileEditorModel } from '../../../../../services/textfile/common/textfiles.js';
import { IWorkspaceEditingService } from '../../../../../services/workspaces/common/workspaceEditing.js';
import { TestWorkerService } from '../../../../inlineChat/test/browser/testWorkerService.js';
import { IMcpService } from '../../../../mcp/common/mcpTypes.js';
import { TestMcpService } from '../../../../mcp/test/common/testMcpService.js';
import { IMultiDiffSourceResolver, IMultiDiffSourceResolverService } from '../../../../multiDiffEditor/browser/multiDiffSourceResolverService.js';
import { NotebookTextModel } from '../../../../notebook/common/model/notebookTextModel.js';
import { INotebookService } from '../../../../notebook/common/notebookService.js';
import { ChatEditingService } from '../../../browser/chatEditing/chatEditingServiceImpl.js';
import { ChatEditingModifiedDocumentEntry } from '../../../browser/chatEditing/chatEditingModifiedDocumentEntry.js';
import { ChatSessionsService } from '../../../browser/chatSessions/chatSessions.contribution.js';
import { ChatAgentService, IChatAgentData, IChatAgentImplementation, IChatAgentService } from '../../../common/participants/chatAgents.js';
import { ChatEditingSessionState, IChatEditReviewSession, IChatEditingService, IChatEditingSession, IModifiedFileEntry, ModifiedFileEntryState } from '../../../common/editing/chatEditingService.js';
import { ChatModel, IChatResponseModel } from '../../../common/model/chatModel.js';
import { IChatService } from '../../../common/chatService/chatService.js';
import { ChatService } from '../../../common/chatService/chatServiceImpl.js';
import { IChatSessionsService } from '../../../common/chatSessionsService.js';
import { IChatSlashCommandService } from '../../../common/participants/chatSlashCommands.js';
import { ChatTransferService, IChatTransferService } from '../../../common/model/chatTransferService.js';
import { IChatVariablesService } from '../../../common/attachments/chatVariables.js';
import { ChatAgentLocation, ChatModeKind } from '../../../common/constants.js';
import { ILanguageModelsService } from '../../../common/languageModels.js';
import { ICustomizationMigrationService } from '../../../common/promptSyntax/service/customizationMigrationService.js';
import { IPromptsService } from '../../../common/promptSyntax/service/promptsService.js';
import { NullLanguageModelsService } from '../../common/languageModels.js';
import { MockChatVariablesService } from '../../common/mockChatVariables.js';
import { MockPromptsService } from '../../common/promptSyntax/service/mockPromptsService.js';
import { IChatDebugService } from '../../../common/chatDebugService.js';
import { ChatDebugServiceImpl } from '../../../common/chatDebugServiceImpl.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';

function getAgentData(id: string): IChatAgentData {
	return {
		name: id,
		id: id,
		extensionId: nullExtensionDescription.identifier,
		extensionVersion: undefined,
		extensionPublisherId: '',
		publisherDisplayName: '',
		extensionDisplayName: '',
		locations: [ChatAgentLocation.Chat],
		modes: [ChatModeKind.Ask],
		metadata: {},
		slashCommands: [],
		disambiguation: [],
	};
}

suite('ChatEditingService', function () {

	const store = new DisposableStore();
	let editingService: ChatEditingService;
	let chatService: IChatService;
	let textModelService: ITextModelService;
	let testInsta: IInstantiationService;

	setup(function () {
		const collection = new ServiceCollection();
		collection.set(IWorkbenchAssignmentService, new NullWorkbenchAssignmentService());
		collection.set(IChatAgentService, new SyncDescriptor(ChatAgentService));
		collection.set(IChatVariablesService, new MockChatVariablesService());
		collection.set(IChatSlashCommandService, new class extends mock<IChatSlashCommandService>() { });
		collection.set(IChatTransferService, new SyncDescriptor(ChatTransferService));
		collection.set(IChatSessionsService, new SyncDescriptor(ChatSessionsService));
		collection.set(IChatEditingService, new SyncDescriptor(ChatEditingService));
		collection.set(IEditorWorkerService, new SyncDescriptor(TestWorkerService));
		collection.set(IChatService, new SyncDescriptor(ChatService));
		collection.set(IMcpService, new TestMcpService());
		collection.set(IPromptsService, new MockPromptsService());
		collection.set(ICustomizationMigrationService, new class extends mock<ICustomizationMigrationService>() { });
		collection.set(ILanguageModelsService, new SyncDescriptor(NullLanguageModelsService));
		const contextKeyService = store.add(new MockContextKeyService());
		collection.set(IChatDebugService, store.add(new ChatDebugServiceImpl(new TestConfigurationService(), contextKeyService)));
		collection.set(IMultiDiffSourceResolverService, new class extends mock<IMultiDiffSourceResolverService>() {
			override registerResolver(_resolver: IMultiDiffSourceResolver): IDisposable {
				return Disposable.None;
			}
		});
		collection.set(IWorkspaceEditingService, new class extends mock<IWorkspaceEditingService>() {
			override readonly onDidEnterWorkspace = Event.None;
		});
		collection.set(IBulkEditService, new class extends mock<IBulkEditService>() {
			override async apply(): Promise<IBulkEditResult> {
				return { ariaSummary: '', isApplied: true };
			}
		});
		collection.set(INotebookService, new class extends mock<INotebookService>() {
			override getNotebookTextModel(_uri: URI): NotebookTextModel | undefined {
				return undefined;
			}
			override hasSupportedNotebooks(_resource: URI): boolean {
				return false;
			}
		});
		const insta = store.add(store.add(workbenchInstantiationService(undefined, store)).createChild(collection));
		testInsta = insta;
		store.add(insta.get(IEditorWorkerService) as TestWorkerService);
		const value = insta.get(IChatEditingService);
		assert.ok(value instanceof ChatEditingService);
		editingService = value;

		chatService = insta.get(IChatService);

		store.add(insta.get(IChatSessionsService) as ChatSessionsService); // Needs to be disposed in between test runs to clear extensionPoint contribution
		store.add(chatService as ChatService);
		chatService.setSaveModelsEnabled(false);

		const chatAgentService = insta.get(IChatAgentService);

		const agent: IChatAgentImplementation = {
			async invoke(request, progress, history, token) {
				return {};
			},
		};
		store.add(chatAgentService.registerAgent('testAgent', { ...getAgentData('testAgent'), isDefault: true }));
		store.add(chatAgentService.registerAgentImplementation('testAgent', agent));

		textModelService = insta.get(ITextModelService);

		const modelService = insta.get(IModelService);

		store.add(textModelService.registerTextModelContentProvider('test', {
			async provideTextContent(resource) {
				return store.add(modelService.createModel(resource.path.repeat(10), null, resource, false));
			},
		}));
	});

	teardown(async () => {
		store.clear();
	});

	ensureNoDisposablesAreLeakedInTestSuite();

	function createReviewSession(entry: IModifiedFileEntry): IChatEditReviewSession {
		return store.add(new class extends Disposable implements IChatEditReviewSession {
			private readonly onDidDisposeEmitter = this._register(new Emitter<void>());

			readonly isGlobalEditingSession = false;
			readonly chatSessionResource = URI.parse('test://review-session');
			readonly onDidDispose = this.onDidDisposeEmitter.event;
			readonly entries = observableValue<readonly IModifiedFileEntry[]>('entries', [entry]);

			override dispose(): void {
				this.onDidDisposeEmitter.fire();
				super.dispose();
			}

			getEntry(uri: URI): IModifiedFileEntry | undefined {
				return isEqual(uri, entry.modifiedURI) ? entry : undefined;
			}

			readEntry(uri: URI, _reader: IReader): IModifiedFileEntry | undefined {
				return this.getEntry(uri);
			}

			async accept(..._uris: URI[]): Promise<void> { }

			async reject(..._uris: URI[]): Promise<void> { }
		});
	}

	function createReviewEntry(uri: URI): IModifiedFileEntry {
		return new class extends mock<IModifiedFileEntry>() {
			override readonly modifiedURI = uri;
			override readonly isCurrentlyBeingModifiedBy = observableValue<{ responseModel: IChatResponseModel; undoStopId: string | undefined } | undefined>('isCurrentlyBeingModifiedBy', undefined);
			override readonly state = observableValue('state', ModifiedFileEntryState.Modified);
		};
	}

	test('create session', async function () {
		assert.ok(editingService);

		const modelRef = chatService.startNewLocalSession(ChatAgentLocation.EditorInline);
		const model = modelRef.object as ChatModel;
		const session = editingService.createEditingSession(model, true);

		assert.strictEqual(session.chatSessionResource.toString(), model.sessionResource.toString());
		assert.strictEqual(session.isGlobalEditingSession, true);

		await assertThrowsAsync(async () => {
			// DUPE not allowed
			editingService.createEditingSession(model);
		});

		session.dispose();
		modelRef.dispose();
	});

	test('register edit review session', () => {
		const entry = createReviewEntry(URI.parse('test://review-entry'));
		const session = createReviewSession(entry);
		const registration = store.add(editingService.registerEditReviewSession(session));

		assert.deepStrictEqual(editingService.editingSessionsObs.get(), [session]);

		registration.dispose();

		assert.deepStrictEqual(editingService.editingSessionsObs.get(), []);
	});

	test('registered edit review session is not returned as an editing session', () => {
		const session = createReviewSession(createReviewEntry(URI.parse('test://review-entry')));
		store.add(editingService.registerEditReviewSession(session));

		assert.strictEqual(editingService.getEditingSession(session.chatSessionResource), undefined);
	});

	test('registered edit review entries are discoverable', () => {
		const entry = createReviewEntry(URI.parse('test://review-entry'));
		store.add(editingService.registerEditReviewSession(createReviewSession(entry)));

		let discoveredEntry: IModifiedFileEntry | undefined;
		store.add(autorun(reader => {
			discoveredEntry = editingService.editingSessionsObs.read(reader)
				.find(session => session.getEntry(entry.modifiedURI))
				?.readEntry(entry.modifiedURI, reader);
		}));

		assert.strictEqual(discoveredEntry, entry);
	});

	test('create session, file entry & isCurrentlyBeingModifiedBy', async function () {
		assert.ok(editingService);

		const uri = URI.from({ scheme: 'test', path: 'HelloWorld' });

		const modelRef = store.add(chatService.startNewLocalSession(ChatAgentLocation.Chat));
		const model = modelRef.object as ChatModel;
		const session = model.editingSession;
		if (!session) {
			assert.fail('session not created');
		}

		const chatRequest = model?.addRequest({ text: '', parts: [] }, { variables: [] }, 0);
		assertType(chatRequest.response);
		chatRequest.response.updateContent({ kind: 'textEdit', uri, edits: [], done: false });
		chatRequest.response.updateContent({ kind: 'textEdit', uri, edits: [{ range: new Range(1, 1, 1, 1), text: 'FarBoo\n' }], done: false });
		chatRequest.response.updateContent({ kind: 'textEdit', uri, edits: [], done: true });

		const entry = await waitForState(session.entries.map(value => value.find(a => isEqual(a.modifiedURI, uri))));

		assert.ok(isEqual(entry.modifiedURI, uri));

		await waitForState(entry.isCurrentlyBeingModifiedBy.map(value => value === chatRequest.response));
		assert.ok(entry.isCurrentlyBeingModifiedBy.get()?.responseModel === chatRequest.response);

		const unset = waitForState(entry.isCurrentlyBeingModifiedBy.map(res => res === undefined));

		chatRequest.response.complete();

		await unset;

		await entry.reject();
	});

	async function idleAfterEdit(session: IChatEditingSession, model: ChatModel, uri: URI, edits: TextEdit[]) {
		const isStreaming = waitForState(session.state.map(s => s === ChatEditingSessionState.StreamingEdits), Boolean);

		const chatRequest = model.addRequest({ text: '', parts: [] }, { variables: [] }, 0);
		assertType(chatRequest.response);

		chatRequest.response.updateContent({ kind: 'textEdit', uri, edits, done: true });

		const entry = await waitForState(session.entries.map(value => value.find(a => isEqual(a.modifiedURI, uri))));

		assert.ok(isEqual(entry.modifiedURI, uri));

		chatRequest.response.complete();

		await isStreaming;

		const isIdle = waitForState(session.state.map(s => s === ChatEditingSessionState.Idle), Boolean);
		await isIdle;

		return entry;
	}

	test('mirror typing outside -> accept', async function () {
		return runWithFakedTimers({}, async () => {
			assert.ok(editingService);

			const uri = URI.from({ scheme: 'test', path: 'abc\n' });

			const modelRef = store.add(chatService.startNewLocalSession(ChatAgentLocation.Chat));
			const model = modelRef.object as ChatModel;
			const session = model.editingSession;
			assertType(session, 'session not created');

			const entry = await idleAfterEdit(session, model, uri, [{ range: new Range(1, 1, 1, 1), text: 'FarBoo\n' }]);
			const original = store.add(await textModelService.createModelReference(entry.originalURI)).object.textEditorModel;
			const modified = store.add(await textModelService.createModelReference(entry.modifiedURI)).object.textEditorModel;

			assert.strictEqual(entry.state.get(), ModifiedFileEntryState.Modified);

			assert.strictEqual(original.getValue(), 'abc\n'.repeat(10));
			assert.strictEqual(modified.getValue(), 'FarBoo\n' + 'abc\n'.repeat(10));

			modified.pushEditOperations(null, [EditOperation.insert(new Position(3, 1), 'USER_TYPE\n')], () => null);

			assert.ok(modified.getValue().includes('USER_TYPE'));
			assert.ok(original.getValue().includes('USER_TYPE'));

			await entry.accept();
			assert.strictEqual(modified.getValue(), original.getValue());
			assert.strictEqual(entry.state.get(), ModifiedFileEntryState.Accepted);

			assert.ok(modified.getValue().includes('FarBoo'));
			assert.ok(original.getValue().includes('FarBoo'));
		});
	});

	test('mirror typing outside -> reject', async function () {
		return runWithFakedTimers({}, async () => {
			assert.ok(editingService);

			const uri = URI.from({ scheme: 'test', path: 'abc\n' });

			const modelRef = store.add(chatService.startNewLocalSession(ChatAgentLocation.Chat));
			const model = modelRef.object as ChatModel;
			const session = model.editingSession;
			assertType(session, 'session not created');

			const entry = await idleAfterEdit(session, model, uri, [{ range: new Range(1, 1, 1, 1), text: 'FarBoo\n' }]);
			const original = store.add(await textModelService.createModelReference(entry.originalURI)).object.textEditorModel;
			const modified = store.add(await textModelService.createModelReference(entry.modifiedURI)).object.textEditorModel;

			assert.strictEqual(entry.state.get(), ModifiedFileEntryState.Modified);

			assert.strictEqual(original.getValue(), 'abc\n'.repeat(10));
			assert.strictEqual(modified.getValue(), 'FarBoo\n' + 'abc\n'.repeat(10));

			modified.pushEditOperations(null, [EditOperation.insert(new Position(3, 1), 'USER_TYPE\n')], () => null);

			assert.ok(modified.getValue().includes('USER_TYPE'));
			assert.ok(original.getValue().includes('USER_TYPE'));

			await entry.reject();
			assert.strictEqual(modified.getValue(), original.getValue());
			assert.strictEqual(entry.state.get(), ModifiedFileEntryState.Rejected);

			assert.ok(!modified.getValue().includes('FarBoo'));
			assert.ok(!original.getValue().includes('FarBoo'));
		});
	});

	test('NO mirror typing inside -> accept', async function () {
		return runWithFakedTimers({}, async () => {
			assert.ok(editingService);

			const uri = URI.from({ scheme: 'test', path: 'abc\n' });

			const modelRef = store.add(chatService.startNewLocalSession(ChatAgentLocation.Chat));
			const model = modelRef.object as ChatModel;
			const session = model.editingSession;
			assertType(session, 'session not created');

			const entry = await idleAfterEdit(session, model, uri, [{ range: new Range(1, 1, 1, 1), text: 'FarBoo\n' }]);
			const original = store.add(await textModelService.createModelReference(entry.originalURI)).object.textEditorModel;
			const modified = store.add(await textModelService.createModelReference(entry.modifiedURI)).object.textEditorModel;

			assert.strictEqual(entry.state.get(), ModifiedFileEntryState.Modified);

			assert.strictEqual(original.getValue(), 'abc\n'.repeat(10));
			assert.strictEqual(modified.getValue(), 'FarBoo\n' + 'abc\n'.repeat(10));

			modified.pushEditOperations(null, [EditOperation.replace(new Range(1, 2, 1, 7), 'ooBar')], () => null);

			assert.ok(modified.getValue().includes('FooBar'));
			assert.ok(!original.getValue().includes('FooBar')); // typed in the AI edits, DO NOT transpose

			await entry.accept();
			assert.strictEqual(modified.getValue(), original.getValue());
			assert.strictEqual(entry.state.get(), ModifiedFileEntryState.Accepted);

			assert.ok(modified.getValue().includes('FooBar'));
			assert.ok(original.getValue().includes('FooBar'));
		});
	});

	test('ChatEditingService merges text edits it shouldn\'t merge, #272679', async function () {
		return runWithFakedTimers({}, async () => {
			assert.ok(editingService);

			const uri = URI.from({ scheme: 'test', path: 'abc' });

			const modified = store.add(await textModelService.createModelReference(uri)).object.textEditorModel;

			const modelRef = store.add(chatService.startNewLocalSession(ChatAgentLocation.Chat));
			const model = modelRef.object as ChatModel;
			const session = model.editingSession;
			assertType(session, 'session not created');

			modified.setValue('');
			await idleAfterEdit(session, model, uri, [{ range: new Range(1, 1, 1, 1), text: 'a' }, { range: new Range(1, 1, 1, 1), text: 'b' }]);
			assert.strictEqual(modified.getValue(), 'ab');

			modified.setValue('');
			await idleAfterEdit(session, model, uri, [{ range: new Range(1, 1, 1, 1), text: 'a' }]);
			await idleAfterEdit(session, model, uri, [{ range: new Range(1, 1, 1, 1), text: 'b' }]);
			assert.strictEqual(modified.getValue(), 'ba');
		});
	});

	test('stopExternalEdits maps contentFor by start resources order when reads finish out of order', async function () {
		const fileService = testInsta.invokeFunction(accessor => accessor.get(IFileService));
		const resourceA = URI.from({ scheme: 'test', path: '/parallel-a.ts' });
		const resourceB = URI.from({ scheme: 'test', path: '/parallel-b.ts' });
		const beforeA = URI.from({ scheme: 'test', path: '/before-a' });
		const beforeB = URI.from({ scheme: 'test', path: '/before-b' });
		const afterA = URI.from({ scheme: 'test', path: '/after-a' });
		const afterB = URI.from({ scheme: 'test', path: '/after-b' });

		await fileService.writeFile(beforeA, VSBuffer.fromString('BEFORE_A'));
		await fileService.writeFile(beforeB, VSBuffer.fromString('BEFORE_B'));
		await fileService.writeFile(afterA, VSBuffer.fromString('AFTER_A'));
		await fileService.writeFile(afterB, VSBuffer.fromString('AFTER_B'));

		const releaseA = new DeferredPromise<void>();
		const origRead = fileService.readFile.bind(fileService);
		fileService.readFile = async (resource: URI) => {
			if (isEqual(resource, beforeA)) {
				await releaseA.p;
			}
			return origRead(resource);
		};

		const modelRef = store.add(chatService.startNewLocalSession(ChatAgentLocation.Chat));
		const model = modelRef.object as ChatModel;
		const session = model.editingSession;
		assertType(session, 'session not created');

		const chatRequest = model.addRequest({ text: '', parts: [] }, { variables: [] }, 0);
		assertType(chatRequest.response);
		const undoStopId = 'external-parallel';
		const operationId = 42;

		const startPromise = session.startExternalEdits(chatRequest.response, operationId, [resourceA, resourceB], undoStopId, [beforeA, beforeB]);
		releaseA.complete();
		await startPromise;

		const progress = await session.stopExternalEdits(chatRequest.response, operationId, [afterA, afterB]);
		const editTextsForA = progress
			.filter((p): p is { kind: 'textEdit'; uri: URI; edits: TextEdit[] } => p.kind === 'textEdit' && isEqual(p.uri, resourceA))
			.flatMap(p => p.edits.map(e => e.text ?? ''))
			.join('');
		const editTextsForB = progress
			.filter((p): p is { kind: 'textEdit'; uri: URI; edits: TextEdit[] } => p.kind === 'textEdit' && isEqual(p.uri, resourceB))
			.flatMap(p => p.edits.map(e => e.text ?? ''))
			.join('');
		assert.ok(editTextsForA.includes('AFTER_A'), 'resource A timeline edits should target AFTER_A content');
		assert.ok(!editTextsForA.includes('AFTER_B'), 'resource A must not use AFTER_B content');
		assert.ok(editTextsForB.includes('AFTER_B'), 'resource B timeline edits should target AFTER_B content');
		assert.ok(!editTextsForB.includes('AFTER_A'), 'resource B must not use AFTER_A content');

		fileService.readFile = origRead;
	});

	test('startExternalEdits keeps initial content when contentFor read fails', async function () {
		const resource = URI.from({ scheme: 'test', path: '/read-fail-target.ts' });
		const failingContent = URI.from({ scheme: 'test', path: '/missing-before' });

		const modelRef = store.add(chatService.startNewLocalSession(ChatAgentLocation.Chat));
		const model = modelRef.object as ChatModel;
		const session = model.editingSession;
		assertType(session, 'session not created');

		const chatRequest = model.addRequest({ text: '', parts: [] }, { variables: [] }, 0);
		assertType(chatRequest.response);
		const undoStopId = 'external-read-fail';
		const operationId = 43;

		const entry = await idleAfterEdit(session, model, resource, [{ range: new Range(1, 1, 1, 1), text: 'disk-body\n' }]) as ChatEditingModifiedDocumentEntry;
		const initialBeforeExternal = entry.initialContent;

		await session.startExternalEdits(chatRequest.response, operationId, [resource], undoStopId, [failingContent]);
		const stopProgress = await session.stopExternalEdits(chatRequest.response, operationId, [failingContent]);

		assert.strictEqual(entry.initialContent, initialBeforeExternal);
		assert.strictEqual(stopProgress.length, 0, 'timeline must not record edits when contentFor read fails at stop');
	});

	async function rejectCreatedFile(options: {
		resource: URI;
		prepare?: () => void;
		deleteResult: 'ok' | 'missing' | 'denied';
		textFile: boolean;
	}): Promise<void> {
		options.prepare?.();
		const modelRef = store.add(chatService.startNewLocalSession(ChatAgentLocation.Chat));
		const model = modelRef.object as ChatModel;
		const session = model.editingSession;
		assertType(session, 'session not created');

		const fileService = testInsta.invokeFunction(accessor => accessor.get(IFileService));
		const originalDel = fileService.del.bind(fileService);
		const worker = testInsta.invokeFunction(accessor => accessor.get(IEditorWorkerService)) as TestWorkerService;
		const modelService = testInsta.invokeFunction(accessor => accessor.get(IModelService));
		const originalComputeDiff = worker.computeDiff.bind(worker);
		worker.computeDiff = (async (...args: Parameters<TestWorkerService['computeDiff']>) => {
			const [original, modified] = args;
			try {
				return await originalComputeDiff(...args);
			} catch (error) {
				if (!modelService.getModel(original) || !modelService.getModel(modified)) {
					return null;
				}
				throw error;
			}
		}) as TestWorkerService['computeDiff'];
		let resolved: IReference<IResolvedTextEditorModel> | undefined;
		let entry: ChatEditingModifiedDocumentEntry | undefined;
		try {
			const created = await idleAfterEdit(session, model, options.resource, [{ range: new Range(1, 1, 1, 1), text: 'created-body\n' }]);
			assert.ok(created instanceof ChatEditingModifiedDocumentEntry);
			entry = created;
			assert.strictEqual(created.createdInRequestId, created.lastModifyingRequestId);

			resolved = await textModelService.createModelReference(options.resource);
			assert.strictEqual(isTextFileEditorModel(resolved.object), options.textFile);
			const events: string[] = [];
			if (isTextFileEditorModel(resolved.object)) {
				const originalRevert = resolved.object.revert.bind(resolved.object);
				resolved.object.revert = async revertOptions => {
					events.push('revert');
					assert.strictEqual(revertOptions?.soft, true);
					return originalRevert(revertOptions);
				};
			}

			fileService.del = async (target, deleteOptions) => {
				events.push('del');
				if (options.deleteResult === 'missing') {
					throw new FileOperationError('missing', FileOperationResult.FILE_NOT_FOUND);
				}
				if (options.deleteResult === 'denied') {
					throw new FileOperationError('denied', FileOperationResult.FILE_PERMISSION_DENIED);
				}
				return originalDel(target, deleteOptions);
			};

			if (options.deleteResult === 'denied') {
				await assertThrowsAsync(() => created.reject());
				assert.strictEqual(session.entries.get().some(candidate => isEqual(candidate.modifiedURI, options.resource)), true);
				assert.strictEqual(created.state.get(), ModifiedFileEntryState.Modified);
			} else {
				await created.reject();
				assert.strictEqual(session.entries.get().some(candidate => isEqual(candidate.modifiedURI, options.resource)), false);
			}
			assert.deepStrictEqual(events, options.textFile ? ['revert', 'del'] : ['del']);
		} finally {
			fileService.del = originalDel;
			resolved?.dispose();
			if (options.deleteResult === 'denied') {
				entry?.dispose();
			}
			// Text file models are disposed asynchronously after the last reference drops.
			await timeout(0);
		}
	}

	function failFirstTextFileRead(): void {
		const textFileService = testInsta.invokeFunction(accessor => accessor.get(ITextFileService)) as TestTextFileService;
		textFileService.setReadStreamErrorOnce(new FileOperationError('missing', FileOperationResult.FILE_NOT_FOUND));
	}

	function failFirstVirtualResolve(scheme: string): void {
		let failedOnce = false;
		store.add(textModelService.registerTextModelContentProvider(scheme, {
			async provideTextContent(resource) {
				if (!failedOnce) {
					failedOnce = true;
					return null;
				}
				return store.add(testInsta.invokeFunction(accessor => accessor.get(IModelService)).createModel('created', null, resource));
			}
		}));
	}

	test('rejecting a created text file deletes it and drops the entry', async () => {
		await rejectCreatedFile({
			resource: URI.file('/created-by-chat-ok.txt'),
			prepare: failFirstTextFileRead,
			deleteResult: 'ok',
			textFile: true,
		});
	});

	test('rejecting a created text file treats FILE_NOT_FOUND as deleted', async () => {
		await rejectCreatedFile({
			resource: URI.file('/created-by-chat-missing.txt'),
			prepare: failFirstTextFileRead,
			deleteResult: 'missing',
			textFile: true,
		});
	});

	test('rejecting a created text file keeps the entry when delete fails', async () => {
		await rejectCreatedFile({
			resource: URI.file('/created-by-chat-denied.txt'),
			prepare: failFirstTextFileRead,
			deleteResult: 'denied',
			textFile: true,
		});
	});

	test('rejecting a created non-text file deletes it and drops the entry', async () => {
		await rejectCreatedFile({
			resource: URI.from({ scheme: 'created-virtual-ok', path: '/created.txt' }),
			prepare: () => failFirstVirtualResolve('created-virtual-ok'),
			deleteResult: 'ok',
			textFile: false,
		});
	});

	test('rejecting a created non-text file keeps the entry when delete fails', async () => {
		await rejectCreatedFile({
			resource: URI.from({ scheme: 'created-virtual-denied', path: '/created.txt' }),
			prepare: () => failFirstVirtualResolve('created-virtual-denied'),
			deleteResult: 'denied',
			textFile: false,
		});
	});

});
