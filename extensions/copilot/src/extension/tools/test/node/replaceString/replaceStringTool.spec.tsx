/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'fs';
import { join } from 'path';
import { beforeEach, expect, it, suite } from 'vitest';
import type { LanguageModelToolInvocationOptions, LanguageModelToolInvocationPrepareOptions, TextEdit } from 'vscode';
import { NotebookDocumentSnapshot } from '../../../../../platform/editing/common/notebookDocumentSnapshot';
import { TextDocumentSnapshot } from '../../../../../platform/editing/common/textDocumentSnapshot';
import { IEndpointProvider } from '../../../../../platform/endpoint/common/endpointProvider';
import { ITestingServicesAccessor } from '../../../../../platform/test/node/services';
import { applyEdits } from '../../../../../platform/test/node/simulationWorkspace';
import { TestWorkspaceService } from '../../../../../platform/test/node/testWorkspaceService';
import { IWorkspaceService } from '../../../../../platform/workspace/common/workspaceService';
import { ChatResponseStreamImpl } from '../../../../../util/common/chatResponseStreamImpl';
import { createTextDocumentData, IExtHostDocumentData, setDocText } from '../../../../../util/common/test/shims/textDocument';
import { CancellationToken } from '../../../../../util/vs/base/common/cancellation';
import { ResourceMap, ResourceSet } from '../../../../../util/vs/base/common/map';
import { assertType } from '../../../../../util/vs/base/common/types';
import { URI } from '../../../../../util/vs/base/common/uri';
import { SyncDescriptor } from '../../../../../util/vs/platform/instantiation/common/descriptors';
import { IInstantiationService } from '../../../../../util/vs/platform/instantiation/common/instantiation';
import { ChatResponseTextEditPart, Range } from '../../../../../vscodeTypes';
import { ChatVariablesCollection } from '../../../../prompt/common/chatVariablesCollection';
import { WorkingCopyOriginalDocument } from '../../../../prompts/node/inline/workingCopies';
import { createExtensionUnitTestingServices } from '../../../../test/node/services';
import { IReplaceStringToolParams, ReplaceStringTool } from '../../../node/replaceStringTool';


suite('ReplaceString Tool', () => {

	let accessor: ITestingServicesAccessor;

	const path = join(__dirname, 'fixtures/math.js.txt');
	const fileTsUri = URI.file(path);

	beforeEach(function () {
		const services = createExtensionUnitTestingServices();

		const content = String(readFileSync(path));

		const testDoc = createTextDocumentData(fileTsUri, content, 'ts').document;
		services.define(IWorkspaceService, new SyncDescriptor(
			TestWorkspaceService, [[fileTsUri], [testDoc]]
		));

		accessor = services.createTestingAccessor();
	});

	it('whitespace change everywhere', async () => {

		const input: IReplaceStringToolParams = JSON.parse(`{
  "filePath": "${path.replaceAll('\\', '\\\\')}",
  "oldString": "export function div(a, b) {\\n  // console.log fff fff\\n  return a / b;\\n}",
  "newString": "export function div(A, b) {\\n  // console.log fff fff\\n  return A / b;\\n}"
}`);

		const tool = accessor.get(IInstantiationService).createInstance(ReplaceStringTool);

		expect(tool).toBeDefined();

		const document = accessor.get(IWorkspaceService).textDocuments.find(doc => doc.uri.toString() === fileTsUri.toString());
		assertType(document);

		const workingCopyDocument = new WorkingCopyOriginalDocument(document.getText());

		expect(document.getText().includes(input.oldString)).toBe(false); // TAB vs SPACES

		let seenEdits = 0;

		const stream = new ChatResponseStreamImpl((part) => {

			if (part instanceof ChatResponseTextEditPart) {
				const offsetEdits = workingCopyDocument.transformer.toOffsetEdit(part.edits);

				if (!workingCopyDocument.isNoop(offsetEdits)) {
					seenEdits++;
					workingCopyDocument.applyOffsetEdits(offsetEdits);
				}
			}

		}, () => { }, () => { }, undefined, undefined, () => Promise.resolve(undefined));

		const input2 = await tool.resolveInput(input, {
			history: [],
			stream,
			query: 'change a to A',
			chatVariables: new ChatVariablesCollection([]),
		});

		await tool.invoke({ input: input2, toolInvocationToken: undefined }, CancellationToken.None);

		expect(seenEdits).toBe(1);
		await expect(workingCopyDocument.text).toMatchFileSnapshot('fixtures/math.js.txt.expected');

	});

	it('should fail when input filePath resolves to URI outside allowedEditUris', async () => {
		const services = createExtensionUnitTestingServices();
		const settingsPath = join(__dirname, 'fixtures/settingsjson.txt');
		const inlineDocumentUri = URI.parse('vscode-userdata:/Users/jrieken/Library/Application%20Support/Code%20-%20Insiders/User/settings.json');
		const settingsUri = URI.file(settingsPath);

		const content = String(readFileSync(settingsPath));
		const testDoc = createTextDocumentData(settingsUri, content, 'jsonc').document;
		services.define(IWorkspaceService, new SyncDescriptor(
			TestWorkspaceService, [[settingsUri], [testDoc]]
		));

		const localAccessor = services.createTestingAccessor();

		const input: IReplaceStringToolParams = JSON.parse(`{
	"filePath": "${settingsUri.path}",
  "oldString": "  \\"typescript.inlayHints.functionLikeReturnTypes.enabled\\": true,\\n  \\"typescript.inlayHints.parameterTypes.enabled\\": true,\\n  \\"typescript.inlayHints.propertyDeclarationTypes.enabled\\": true,\\n  \\"typescript.inlayHints.variableTypes.enabled\\": true,\\n  // \\"typescript.referencesCodeLens.enabled\\": true,\\n  \\"typescript.preferences.useAliasesForRenames\\": false,\\n  \\"typescript.referencesCodeLens.enabled\\": false,\\n  \\"js/ts.tsserver.log\\": \\"off\\",\\n  \\"typescript.updateImportsOnFileMove.enabled\\": \\"always\\",",
  "newString": "  \\"js/ts.inlayHints.functionLikeReturnTypes.enabled\\": true,\\n  \\"js/ts.inlayHints.parameterTypes.enabled\\": true,\\n  \\"js/ts.inlayHints.propertyDeclarationTypes.enabled\\": true,\\n  \\"js/ts.inlayHints.variableTypes.enabled\\": true,\\n  // \\"js/ts.referencesCodeLens.enabled\\": true,\\n  \\"js/ts.preferences.useAliasesForRenames\\": false,\\n  \\"js/ts.referencesCodeLens.enabled\\": false,\\n  \\"js/ts.tsserver.log\\": \\"off\\",\\n  \\"js/ts.updateImportsOnFileMove.enabled\\": \\"always\\","
}`);

		const tool = localAccessor.get(IInstantiationService).createInstance(ReplaceStringTool);
		expect(tool).toBeDefined();

		const document = localAccessor.get(IWorkspaceService).textDocuments.find(doc => doc.uri.toString() === settingsUri.toString());
		assertType(document);

		const workingCopyDocument = new WorkingCopyOriginalDocument(document.getText());
		expect(document.getText().includes(input.oldString)).toBe(true);

		let seenEdits = 0;

		const stream = new ChatResponseStreamImpl((part) => {
			if (part instanceof ChatResponseTextEditPart) {
				const offsetEdits = workingCopyDocument.transformer.toOffsetEdit(part.edits);

				if (!workingCopyDocument.isNoop(offsetEdits)) {
					seenEdits++;
					workingCopyDocument.applyOffsetEdits(offsetEdits);
				}
			}
		}, () => { }, () => { }, undefined, undefined, () => Promise.resolve(undefined));

		const input2 = await tool.resolveInput(input, {
			history: [],
			stream,
			query: 'fix deprecated settings keys',
			chatVariables: new ChatVariablesCollection([]),
			allowedEditUris: new ResourceSet([inlineDocumentUri]),
		});

		const result = await tool.invoke({ input: input2, toolInvocationToken: undefined }, CancellationToken.None);

		expect(result.hasError).toBe(true);
		expect(seenEdits).toBe(0);
		expect(workingCopyDocument.text).toBe(document.getText());
	});
});

class CountingReplaceStringTool extends ReplaceStringTool {
	generateCount = 0;

	protected override doGenerateEdit(uri: URI, oldString: string, newString: string, options: LanguageModelToolInvocationOptions<IReplaceStringToolParams> | LanguageModelToolInvocationPrepareOptions<IReplaceStringToolParams>) {
		this.generateCount++;
		return super.doGenerateEdit(uri, oldString, newString, options);
	}
}

suite('ReplaceString Tool - prepared edits', () => {

	// A family that skips edit healing, so a missing match is reported without an endpoint request.
	const model = { id: 'test-model', family: 'test-family', vendor: 'test', name: 'Test Model' };
	const uri = URI.file('/workspace/reuse.ts');
	const input: IReplaceStringToolParams = { explanation: 'add an argument', filePath: uri.fsPath, oldString: 'foo()', newString: 'foo(bar)' };

	let docData: IExtHostDocumentData;
	let tool: CountingReplaceStringTool;

	beforeEach(() => {
		docData = createTextDocumentData(uri, 'const a = foo();\n', 'ts');
		const services = createExtensionUnitTestingServices();
		services.define(IWorkspaceService, new SyncDescriptor(TestWorkspaceService, [[URI.file('/workspace')], [docData.document]]));
		services.set(IEndpointProvider, { getChatEndpoint: async () => ({ model: model.id }) } as unknown as IEndpointProvider);
		tool = services.createTestingAccessor().get(IInstantiationService).createInstance(CountingReplaceStringTool);
	});

	/** Starts one tool call and returns the text edits it streams. */
	async function resolve(turnEditedDocuments?: ResourceMap<NotebookDocumentSnapshot | TextDocumentSnapshot>): Promise<TextEdit[]> {
		const edits: TextEdit[] = [];
		const stream = new ChatResponseStreamImpl((part) => {
			if (part instanceof ChatResponseTextEditPart) {
				edits.push(...part.edits);
			}
		}, () => { }, () => { }, undefined, undefined, () => Promise.resolve(undefined));
		await tool.resolveInput(input, {
			history: [],
			stream,
			query: 'add an argument',
			chatVariables: new ChatVariablesCollection([]),
			request: { model } as any,
			turnEditedDocuments,
		});
		return edits;
	}

	async function invokeAndApply(chatRequestId: string, edits: TextEdit[]) {
		const result = await tool.invoke({ input, toolInvocationToken: undefined, chatRequestId }, CancellationToken.None);
		applyEdits(docData, edits, new Range(0, 0, 0, 0), new Range(0, 0, 0, 0));
		return result;
	}

	it('does not replay edits when the same input is called again', async () => {
		await invokeAndApply('request-1', await resolve());
		expect(docData.document.getText()).toBe('const a = foo(bar);\n');

		const secondEdits = await resolve();
		const second = await invokeAndApply('request-1', secondEdits);

		expect(second.hasError).toBe(true);
		expect(secondEdits).toHaveLength(0);
		expect(docData.document.getText()).toBe('const a = foo(bar);\n');
	});

	it('computes again after a rejected confirmation left edits for the same input', async () => {
		await resolve();
		await tool.prepareInvocation({ input, chatRequestId: 'request-1', forceConfirmationReason: 'test' }, CancellationToken.None);
		// The user rejects, so invoke does not run; then the file changes.
		setDocText(docData, '// header\nconst a = foo();\n');

		const edits = await resolve();
		await tool.prepareInvocation({ input, chatRequestId: 'request-1' }, CancellationToken.None);
		const result = await invokeAndApply('request-1', edits);

		expect(result.hasError).toBe(false);
		expect(tool.generateCount).toBe(2);
		expect(docData.document.getText()).toBe('// header\nconst a = foo(bar);\n');
	});

	it('computes again when the live document changed although the turn snapshot did not', async () => {
		const turnEditedDocuments = new ResourceMap<NotebookDocumentSnapshot | TextDocumentSnapshot>();
		turnEditedDocuments.set(uri, TextDocumentSnapshot.create(docData.document));
		const edits = await resolve(turnEditedDocuments);
		await tool.prepareInvocation({ input, chatRequestId: 'request-1', forceConfirmationReason: 'test' }, CancellationToken.None);
		setDocText(docData, '// header\nconst a = foo();\n');

		const result = await invokeAndApply('request-1', edits);

		expect(result.hasError).toBe(false);
		expect(tool.generateCount).toBe(2);
		expect(docData.document.getText()).toBe('// header\nconst a = foo(bar);\n');
	});

	it('reuses the edits prepared for the confirmation while the document is unchanged', async () => {
		const edits = await resolve();
		await tool.prepareInvocation({ input, chatRequestId: 'request-1', forceConfirmationReason: 'test' }, CancellationToken.None);
		const result = await invokeAndApply('request-1', edits);

		expect(result.hasError).toBe(false);
		expect(tool.generateCount).toBe(1);
		expect(docData.document.getText()).toBe('const a = foo(bar);\n');
	});
});
