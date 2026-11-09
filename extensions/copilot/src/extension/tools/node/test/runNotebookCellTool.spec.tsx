/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, describe, expect, test, vi } from 'vitest';
import { IEndpointProvider } from '../../../../platform/endpoint/common/endpointProvider';
import { IExtensionsService } from '../../../../platform/extensions/common/extensionsService';
import { IAlternativeNotebookContentService } from '../../../../platform/notebook/common/alternativeContent';
import { getCellId } from '../../../../platform/notebook/common/helpers';
import { INotebookService } from '../../../../platform/notebook/common/notebookService';
import { PromptPathRepresentationService } from '../../../../platform/prompts/common/promptPathRepresentationService';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry';
import { TestWorkspaceService } from '../../../../platform/test/node/testWorkspaceService';
import { ExtHostNotebookDocumentData } from '../../../../util/common/test/shims/notebookDocument';
import { CancellationToken } from '../../../../util/vs/base/common/cancellation';
import { CancellationError, isCancellationError } from '../../../../util/vs/base/common/errors';
import { DisposableStore } from '../../../../util/vs/base/common/lifecycle';
import { URI } from '../../../../util/vs/base/common/uri';
import { IInstantiationService } from '../../../../util/vs/platform/instantiation/common/instantiation';
import { NotebookCellData, NotebookCellKind, NotebookData } from '../../../../vscodeTypes';
import { IToolsService } from '../../common/toolsService';
import { RunNotebookCellTool } from '../runNotebookCellTool';

describe('Run Notebook Cell Tool', () => {
	const disposables = new DisposableStore();
	afterAll(() => {
		disposables.clear();
	});

	function createNotebook() {
		const cells = [
			new NotebookCellData(NotebookCellKind.Code, 'import os', 'python'),
			new NotebookCellData(NotebookCellKind.Code, 'print("Hello World")', 'python'),
		];
		return ExtHostNotebookDocumentData.fromNotebookData(URI.file('notebook.ipynb'), new NotebookData(cells), 'jupyter-notebook');
	}

	// Only the failure paths run here, so the services that render results
	// (instantiation, alternative content, endpoints) are never reached.
	function createTool(notebook: ExtHostNotebookDocumentData, notebookService: Partial<INotebookService>) {
		const workspaceService = disposables.add(new TestWorkspaceService([], [], [notebook.document]));
		const toolsService = { invokeTool: vi.fn() };
		const tool = new RunNotebookCellTool(
			{} as unknown as IInstantiationService,
			new PromptPathRepresentationService(new TestWorkspaceService()),
			workspaceService,
			{ trackAgentUsage: () => { }, getFollowState: () => false, ...notebookService } as unknown as INotebookService,
			{} as unknown as IAlternativeNotebookContentService,
			// Report the Jupyter extension as installed so invoke does not run the install-extension tool.
			{ getExtension: () => ({}) } as unknown as IExtensionsService,
			{} as unknown as IEndpointProvider,
			toolsService as unknown as IToolsService,
			{ sendMSFTTelemetryEvent: () => { } } as unknown as ITelemetryService,
		);
		return { tool, toolsService };
	}

	function invoke(tool: RunNotebookCellTool, notebook: ExtHostNotebookDocumentData, cellId: string) {
		return tool.invoke({ input: { filePath: notebook.uri.toString(), cellId }, toolInvocationToken: undefined }, CancellationToken.None);
	}

	test('rejects with the lookup error when the cell was deleted after confirmation', async () => {
		const notebook = createNotebook();
		const { tool } = createTool(notebook, {});

		await expect(invoke(tool, notebook, 'deleted-cell')).rejects.toThrow(/not found in the notebook/);
	});

	test('rejects with the kernel selection error instead of resolving to undefined', async () => {
		const notebook = createNotebook();
		const error = new Error('kernel selection failed');
		const { tool, toolsService } = createTool(notebook, { ensureKernelSelected: () => Promise.reject(error) });

		await expect(invoke(tool, notebook, getCellId(notebook.document.cellAt(1)))).rejects.toBe(error);
		expect(toolsService.invokeTool).not.toHaveBeenCalled();
	});

	test('rejects with the run command error instead of resolving to undefined', async () => {
		const notebook = createNotebook();
		const error = new Error('notebook.cell.execute failed');
		const { tool } = createTool(notebook, {
			ensureKernelSelected: () => Promise.resolve(),
			runCells: () => Promise.reject(error),
		});

		await expect(invoke(tool, notebook, getCellId(notebook.document.cellAt(1)))).rejects.toBe(error);
	});

	test('keeps a cancellation error as a cancellation', async () => {
		const notebook = createNotebook();
		const { tool } = createTool(notebook, { ensureKernelSelected: () => Promise.reject(new CancellationError()) });

		await expect(invoke(tool, notebook, getCellId(notebook.document.cellAt(1)))).rejects.toSatisfy(isCancellationError);
	});
});
