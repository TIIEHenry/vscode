/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as vscode from 'vscode';
import 'mocha';
import type * as Proto from '../../tsServer/protocol/protocol';
import { computePostApplyEditUnionRange, EditorChatFollowUp } from '../../languageFeatures/util/copilot';

suite('TypeScript AI quick fix edit scope', () => {
	test('empty newText range is the edit span not the whole document', () => {
		const doc = createDocument('hello world');
		const edits: Proto.CodeEdit[] = [{
			start: { line: 1, offset: 7 },
			end: { line: 1, offset: 12 },
			newText: ''
		}];
		const range = computePostApplyEditUnionRange(doc, edits)!;
		assert.strictEqual(range.start.line, 0);
		assert.strictEqual(range.start.character, 6);
		assert.strictEqual(range.end.line, 0);
		assert.strictEqual(range.end.character, 6);
		assert.notStrictEqual(range.end.character, doc.getText().length);
	});

	test('duplicate newText earlier in document still uses this edit post-apply position', () => {
		const doc = createDocument('foo\nbar foo\n');
		const edits: Proto.CodeEdit[] = [{
			start: { line: 2, offset: 5 },
			end: { line: 2, offset: 5 },
			newText: 'foo'
		}];
		const range = computePostApplyEditUnionRange(doc, edits)!;
		assert.strictEqual(range.start.line, 1);
		assert.strictEqual(range.start.character, 4);
		assert.strictEqual(range.end.line, 1);
		assert.strictEqual(range.end.character, 7);
	});

	test('unique insertion range covers inserted text', () => {
		const doc = createDocument('class C {\n}\n');
		const insertText = '  method() {}\n';
		const edits: Proto.CodeEdit[] = [{
			start: { line: 1, offset: 10 },
			end: { line: 1, offset: 10 },
			newText: insertText
		}];
		const range = computePostApplyEditUnionRange(doc, edits)!;
		const postApplyText = 'class C {  method() {}\n}\n';
		const postDoc = createDocument(postApplyText);
		assert.strictEqual(postDoc.getText(range), insertText);
	});

	test('EditorChatFollowUp does not start chat when postApplyRange is undefined', async () => {
		const executed: string[] = [];
		const originalExecute = vscode.commands.executeCommand;
		vscode.commands.executeCommand = (async (command: string, ..._args: unknown[]) => {
			executed.push(command);
			return undefined;
		}) as typeof vscode.commands.executeCommand;

		Object.defineProperty(vscode.workspace, 'isAgentSessionsWorkspace', {
			configurable: true,
			value: true,
		});

		try {
			const followUp = new EditorChatFollowUp(
				{ toOpenTsFilePath: () => undefined } as never,
				{ logTelemetry: () => { } } as never,
			);
			await followUp.execute({
				message: 'test',
				document: createDocument(''),
				expand: { kind: 'code-action', postApplyRange: undefined },
				action: { type: 'quickfix', quickfix: { fixName: 'x' } as never },
			});
			assert.ok(!executed.includes('vscode.editorChat.start'));
		} finally {
			vscode.commands.executeCommand = originalExecute;
		}
	});
});

function createDocument(text: string): vscode.TextDocument {
	return {
		getText: (range?: vscode.Range) => range ? text.slice(
			offsetAt(text, range.start),
			offsetAt(text, range.end)
		) : text,
		offsetAt: (position: vscode.Position) => offsetAt(text, position),
		positionAt: (offset: number) => positionAt(text, offset),
	} as vscode.TextDocument;
}

function offsetAt(text: string, position: vscode.Position): number {
	const lines = text.split('\n');
	let offset = 0;
	for (let i = 0; i < position.line; i++) {
		offset += lines[i].length + 1;
	}
	return offset + position.character;
}

function positionAt(text: string, offset: number): vscode.Position {
	const clamped = Math.max(0, Math.min(offset, text.length));
	const before = text.substring(0, clamped);
	const line = (before.match(/\n/g) || []).length;
	const lastNewline = before.lastIndexOf('\n');
	const character = lastNewline === -1 ? clamped : clamped - lastNewline - 1;
	return new vscode.Position(line, character);
}
