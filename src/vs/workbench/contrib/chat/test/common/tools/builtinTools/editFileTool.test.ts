/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../../../base/common/cancellation.js';
import { isCancellationError } from '../../../../../../../base/common/errors.js';
import { observableValue } from '../../../../../../../base/common/observable.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
import { ICodeMapperRequest, ICodeMapperResponse, ICodeMapperResult, ICodeMapperService } from '../../../../common/editing/chatCodeMapperService.js';
import { IChatEditingSession, IModifiedFileEntry } from '../../../../common/editing/chatEditingService.js';
import { ChatModel } from '../../../../common/model/chatModel.js';
import { EditTool } from '../../../../common/tools/builtinTools/editFileTool.js';
import { IToolInvocation, ToolProgress } from '../../../../common/tools/languageModelToolsService.js';
import { INotebookService } from '../../../../../notebook/common/notebookService.js';

interface IRecordedProgress {
	requestId: string;
	progress: unknown;
}

function createModel(options: {
	requests: { id: string; isComplete?: boolean; isCanceled?: boolean }[];
	editingSession: IChatEditingSession;
	progress: IRecordedProgress[];
}): ChatModel {
	return {
		getRequests: () => options.requests.map(request => ({
			id: request.id,
			response: {
				isComplete: request.isComplete ?? false,
				isCanceled: request.isCanceled ?? false,
			},
		})),
		acceptResponseProgress: (request: { id: string }, progress: unknown) => {
			options.progress.push({ requestId: request.id, progress });
		},
		editingSession: options.editingSession,
	} as unknown as ChatModel;
}

function createChatService(model: ChatModel): { getSession: () => ChatModel } {
	return { getSession: () => model };
}

function createEditingSession(uri: URI, modified: ReturnType<typeof observableValue<boolean>>): IChatEditingSession {
	const entry = {
		modifiedURI: uri,
		isCurrentlyBeingModifiedBy: modified,
	} as unknown as IModifiedFileEntry;
	return {
		entries: observableValue<readonly IModifiedFileEntry[]>('entries', [entry]),
	} as unknown as IChatEditingSession;
}

function createInvocation(chatRequestId?: string): IToolInvocation {
	return {
		callId: 'call-1',
		toolId: 'vscode_editFile_internal',
		parameters: {
			uri: URI.file('/file.ts'),
			explanation: 'edit',
			code: 'const value = 1;',
		},
		chatRequestId,
		context: { sessionResource: URI.parse('test://session') },
	};
}

function createTool(mapCode: ICodeMapperService['mapCode'], model: ChatModel): EditTool {
	const codeMapperService = { mapCode } as ICodeMapperService;
	const notebookService = {
		hasSupportedNotebooks: () => false,
		getNotebookTextModel: () => undefined,
	} as unknown as INotebookService;
	return new EditTool(createChatService(model) as never, codeMapperService, notebookService);
}

const countTokens = async () => 0;
const noProgress: ToolProgress = { report() { } };

suite('EditTool', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('reports success only after a real edit callback and the edit settles', async () => {
		const uri = URI.file('/file.ts');
		const modified = observableValue<boolean>('modified', true);
		const progress: IRecordedProgress[] = [];
		const model = createModel({
			requests: [{ id: 'request-1' }],
			editingSession: createEditingSession(uri, modified),
			progress,
		});
		const tool = createTool(async (_request: ICodeMapperRequest, response: ICodeMapperResponse): Promise<ICodeMapperResult> => {
			response.textEdit(uri, [{ range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }, text: 'x' }]);
			setTimeout(() => modified.set(false, undefined), 0);
			return {};
		}, model);

		const result = await tool.invoke(createInvocation('request-1'), countTokens, noProgress, CancellationToken.None);

		assert.deepStrictEqual(result.content, [{ kind: 'text', value: 'The file was edited successfully' }]);
		assert.ok(progress.some(p => (p.progress as { kind?: string }).kind === 'textEdit'));
	});

	test('does not report success when mapping returns undefined', async () => {
		const uri = URI.file('/file.ts');
		const modified = observableValue<boolean>('modified', false);
		const model = createModel({
			requests: [{ id: 'request-1' }],
			editingSession: createEditingSession(uri, modified),
			progress: [],
		});
		const tool = createTool(async () => undefined, model);

		await assert.rejects(
			tool.invoke(createInvocation('request-1'), countTokens, noProgress, CancellationToken.None),
			/did not produce any changes/,
		);
	});

	test('does not report success when mapping produced no edit callback', async () => {
		const uri = URI.file('/file.ts');
		const modified = observableValue<boolean>('modified', false);
		const model = createModel({
			requests: [{ id: 'request-1' }],
			editingSession: createEditingSession(uri, modified),
			progress: [],
		});
		const tool = createTool(async () => ({}), model);

		await assert.rejects(
			tool.invoke(createInvocation('request-1'), countTokens, noProgress, CancellationToken.None),
			/did not produce any changes/,
		);
	});

	test('propagates cancellation instead of reporting success', async () => {
		const uri = URI.file('/file.ts');
		const modified = observableValue<boolean>('modified', false);
		const model = createModel({
			requests: [{ id: 'request-1' }],
			editingSession: createEditingSession(uri, modified),
			progress: [],
		});
		const tool = createTool(async () => undefined, model);

		await assert.rejects(
			tool.invoke(createInvocation('request-1'), countTokens, noProgress, CancellationToken.Cancelled),
			err => isCancellationError(err),
		);
	});

	test('writes progress to the request named by chatRequestId, not the last request', async () => {
		const uri = URI.file('/file.ts');
		const modified = observableValue<boolean>('modified', true);
		const progress: IRecordedProgress[] = [];
		const model = createModel({
			requests: [
				{ id: 'request-reopened' },
				{ id: 'request-later', isComplete: true },
			],
			editingSession: createEditingSession(uri, modified),
			progress,
		});
		const tool = createTool(async (_request: ICodeMapperRequest, response: ICodeMapperResponse): Promise<ICodeMapperResult> => {
			response.textEdit(uri, [{ range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 }, text: 'x' }]);
			setTimeout(() => modified.set(false, undefined), 0);
			return {};
		}, model);

		await tool.invoke(createInvocation('request-reopened'), countTokens, noProgress, CancellationToken.None);

		assert.ok(progress.length > 0);
		assert.ok(progress.every(p => p.requestId === 'request-reopened'));
	});

	test('refuses to write progress when the target request is complete', async () => {
		const uri = URI.file('/file.ts');
		const modified = observableValue<boolean>('modified', false);
		const progress: IRecordedProgress[] = [];
		const model = createModel({
			requests: [{ id: 'request-complete', isComplete: true }],
			editingSession: createEditingSession(uri, modified),
			progress,
		});
		const tool = createTool(async () => ({}), model);

		await assert.rejects(
			tool.invoke(createInvocation('request-complete'), countTokens, noProgress, CancellationToken.None),
			/no longer active/,
		);
		assert.deepStrictEqual(progress, []);
	});
});
