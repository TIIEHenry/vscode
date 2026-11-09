/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as vscode from 'vscode';
import 'mocha';
import * as interfaces from '../interfaces';
import MergeDecorator from '../mergeDecorator';

interface PendingScan {
	readonly document: vscode.TextDocument;
	readonly resolve: (conflicts: interfaces.IDocumentMergeConflict[]) => void;
}

/** Records every scan and leaves it pending until the test resolves it. */
class ControlledTrackerService implements interfaces.IDocumentMergeConflictTrackerService {
	private readonly scans: PendingScan[] = [];

	createTracker(_origin: string): interfaces.IDocumentMergeConflictTracker {
		return {
			getConflicts: document => new Promise<interfaces.IDocumentMergeConflict[]>(resolve => {
				this.scans.push({ document, resolve });
			}),
			isPending: () => false,
			forget: () => { },
		};
	}

	forget(_document: vscode.TextDocument): void { }

	scansOf(document: vscode.TextDocument): PendingScan[] {
		return this.scans.filter(scan => scan.document === document);
	}
}

function startDecorating(decorator: MergeDecorator, editor: vscode.TextEditor): Promise<void> {
	return decorator['applyDecorations'](editor);
}

async function changeDocument(editor: vscode.TextEditor): Promise<void> {
	const version = editor.document.version;
	assert.ok(await editor.edit(edit => edit.insert(new vscode.Position(0, 0), 'x')));
	assert.ok(editor.document.version > version, 'the edit must reach the document before the pending scan finishes');
}

function settle(): Promise<void> {
	return new Promise<void>(resolve => setImmediate(() => resolve()));
}

async function waitUntil(condition: () => boolean, description: string): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt++) {
		if (condition()) {
			return;
		}
		await new Promise<void>(resolve => setTimeout(() => resolve(), 50));
	}
	assert.fail(`Timed out waiting until ${description}`);
}

suite('MergeDecorator replays a skipped refresh', () => {
	const config: interfaces.IExtensionConfiguration = { enableCodeLens: false, enableDecorations: true, enableEditorOverview: true };
	let service: ControlledTrackerService;
	let decorator: MergeDecorator;
	let editor: vscode.TextEditor;

	setup(async () => {
		service = new ControlledTrackerService();
		const context: Pick<vscode.ExtensionContext, 'subscriptions'> = { subscriptions: [] };
		decorator = new MergeDecorator(context as vscode.ExtensionContext, service);
		decorator['config'] = config;
		decorator['registerDecorationTypes'](config);
		const document = await vscode.workspace.openTextDocument({ content: '<<<<<<< HEAD\ncurrent\n=======\nincoming\n>>>>>>> branch\n' });
		editor = await vscode.window.showTextDocument(document);
	});

	teardown(async () => {
		decorator.dispose();
		if (vscode.window.visibleTextEditors.includes(editor)) {
			await vscode.window.showTextDocument(editor.document, editor.viewColumn);
			await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
		}
	});

	test('a call skipped while the document changed is replayed once', async () => {
		const first = startDecorating(decorator, editor);
		await changeDocument(editor);
		await startDecorating(decorator, editor);
		service.scansOf(editor.document)[0].resolve([]);
		await first;
		assert.strictEqual(service.scansOf(editor.document).length, 2);
		service.scansOf(editor.document)[1].resolve([]);
		await settle();
		assert.strictEqual(service.scansOf(editor.document).length, 2);
	});

	test('a scan that finished after the document changed is replayed once', async () => {
		const first = startDecorating(decorator, editor);
		await changeDocument(editor);
		service.scansOf(editor.document)[0].resolve([]);
		await first;
		assert.strictEqual(service.scansOf(editor.document).length, 2);
		service.scansOf(editor.document)[1].resolve([]);
		await settle();
		assert.strictEqual(service.scansOf(editor.document).length, 2);
	});

	test('a call skipped while a scan was pending is replayed once', async () => {
		const first = startDecorating(decorator, editor);
		await startDecorating(decorator, editor);
		service.scansOf(editor.document)[0].resolve([]);
		await first;
		assert.strictEqual(service.scansOf(editor.document).length, 2);
		service.scansOf(editor.document)[1].resolve([]);
		await settle();
		assert.strictEqual(service.scansOf(editor.document).length, 2);
	});

	test('a scan without a skipped call or a document change is not replayed', async () => {
		const first = startDecorating(decorator, editor);
		service.scansOf(editor.document)[0].resolve([]);
		await first;
		await settle();
		assert.strictEqual(service.scansOf(editor.document).length, 1);
	});

	test('an editor hidden during the scan is not replayed', async () => {
		const document = editor.document;
		const first = startDecorating(decorator, editor);
		await startDecorating(decorator, editor);
		await vscode.window.showTextDocument(document, editor.viewColumn);
		await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
		await waitUntil(() => !vscode.window.visibleTextEditors.includes(editor), 'the editor is hidden');
		service.scansOf(document)[0].resolve([]);
		await first;
		await settle();
		assert.strictEqual(service.scansOf(document).length, 1);
	});

	test('a decorator disposed during the scan does not replay', async () => {
		const first = startDecorating(decorator, editor);
		await startDecorating(decorator, editor);
		decorator.dispose();
		service.scansOf(editor.document)[0].resolve([]);
		await first;
		await settle();
		assert.strictEqual(service.scansOf(editor.document).length, 1);
	});
});
