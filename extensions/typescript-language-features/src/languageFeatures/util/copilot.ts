/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Command } from '../../commands/commandManager';
import { nulToken } from '../../utils/cancellation';
import type * as Proto from '../../tsServer/protocol/protocol';
import * as typeConverters from '../../typeConverters';
import { ITypeScriptServiceClient } from '../../typescriptService';
import { TelemetryReporter } from '../../logging/telemetry';
import { runTypeScriptEditorChatFollowUp } from './editorChatGate';

export class EditorChatFollowUp implements Command {
	public static readonly ID = '_typescript.quickFix.editorChatReplacement2';
	public readonly id = EditorChatFollowUp.ID;

	constructor(
		private readonly client: ITypeScriptServiceClient,
		private readonly telemetryReporter: TelemetryReporter,
	) { }

	async execute({ message, document, expand, action }: EditorChatFollowUp_Args) {
		await runTypeScriptEditorChatFollowUp({
			isAgentSessionsWorkspace: vscode.workspace.isAgentSessionsWorkspace,
			sendTelemetry: () => {
				if (action.type === 'quickfix') {
					/* __GDPR__
						"aiQuickfix.execute" : {
							"owner": "mjbvz",
							"action" : { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" },
							"${include}": [
								"${TypeScriptCommonProperties}"
							]
						}
					*/
					this.telemetryReporter.logTelemetry('aiQuickfix.execute', {
						action: action.quickfix.fixName,
					});
				} else {
					/* __GDPR__
						"aiRefactor.execute" : {
							"owner": "mjbvz",
							"action" : { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" },
							"${include}": [
								"${TypeScriptCommonProperties}"
							]
						}
					*/
					this.telemetryReporter.logTelemetry('aiRefactor.execute', {
						action: action.refactor.name,
					});
				}
			},
			startEditorChat: async () => {
				const baseRange =
					expand.kind === 'navtree-function'
						? await findScopeEndLineFromNavTree(
							this.client,
							document,
							expand.pos.line
						)
						: expand.kind === 'refactor-info'
							? expand.postApplyRange
							: expand.kind === 'code-action'
								? expand.postApplyRange
								: expand.range;
				if (!baseRange) {
					return;
				}
				const initialRange =
					expand.kind === 'navtree-function'
						? baseRange
						: await expandEditRangeEndWithNavTree(this.client, document, baseRange);
				const initialSelection = new vscode.Selection(initialRange.start, initialRange.end);
				await vscode.commands.executeCommand('vscode.editorChat.start', {
					initialRange,
					initialSelection,
					message,
					autoSend: true,
				});
			},
		});
	}
}
export interface EditorChatFollowUp_Args {
	readonly message: string;
	readonly document: vscode.TextDocument;
	readonly expand: Expand;
	readonly action: {
		readonly type: 'refactor';
		readonly refactor: Proto.RefactorActionInfo;
	} | {
		readonly type: 'quickfix';
		readonly quickfix: Proto.CodeFixAction;
	};
}

export class CompositeCommand implements Command {
	public static readonly ID = '_typescript.compositeCommand';
	public readonly id = CompositeCommand.ID;

	public async execute(...commands: vscode.Command[]): Promise<void> {
		for (const command of commands) {
			await vscode.commands.executeCommand(
				command.command,
				...(command.arguments ?? [])
			);
		}
	}
}

export type Expand =
	| { kind: 'none'; readonly range: vscode.Range }
	| { kind: 'navtree-function'; readonly pos: vscode.Position }
	| { kind: 'refactor-info'; readonly postApplyRange: vscode.Range | undefined }
	| { kind: 'code-action'; readonly postApplyRange: vscode.Range | undefined };

/**
 * Union of edit ranges on the document after all {@link edits} are applied,
 * computed from pre-edit positions (does not use {@code indexOf} on text).
 */
export function computePostApplyEditUnionRange(
	document: vscode.TextDocument,
	edits: readonly Proto.CodeEdit[]
): vscode.Range | undefined {
	if (edits.length === 0) {
		return undefined;
	}

	const ordered = [...edits].sort((a, b) => {
		const oa = document.offsetAt(typeConverters.Position.fromLocation(a.start));
		const ob = document.offsetAt(typeConverters.Position.fromLocation(b.start));
		return oa - ob;
	});

	let delta = 0;
	let unionStart: number | undefined;
	let unionEnd: number | undefined;

	for (const edit of ordered) {
		const startOff = document.offsetAt(typeConverters.Position.fromLocation(edit.start));
		const endOff = document.offsetAt(typeConverters.Position.fromLocation(edit.end));
		const oldLen = endOff - startOff;
		const newLen = edit.newText.length;

		const postStart = startOff + delta;
		const postEnd = postStart + newLen;

		if (unionStart === undefined || postStart < unionStart) {
			unionStart = postStart;
		}
		if (unionEnd === undefined || postEnd > unionEnd) {
			unionEnd = postEnd;
		}

		delta += newLen - oldLen;
	}

	const postApplyText = applyTextChangesInDocumentOrder(document.getText(), ordered, document);
	return new vscode.Range(
		positionAtOffset(postApplyText, unionStart!),
		positionAtOffset(postApplyText, unionEnd!)
	);
}

function applyTextChangesInDocumentOrder(
	text: string,
	orderedEdits: readonly Proto.CodeEdit[],
	document: vscode.TextDocument
): string {
	let result = text;
	for (const edit of [...orderedEdits].reverse()) {
		const startOff = document.offsetAt(typeConverters.Position.fromLocation(edit.start));
		const endOff = document.offsetAt(typeConverters.Position.fromLocation(edit.end));
		result = result.slice(0, startOff) + edit.newText + result.slice(endOff);
	}
	return result;
}

function positionAtOffset(text: string, offset: number): vscode.Position {
	const clamped = Math.max(0, Math.min(offset, text.length));
	const before = text.substring(0, clamped);
	const line = (before.match(/\n/g) || []).length;
	const lastNewline = before.lastIndexOf('\n');
	const character = lastNewline === -1 ? clamped : clamped - lastNewline - 1;
	return new vscode.Position(line, character);
}

function findScopeEndLineFromNavTreeWorker(
	startLine: number,
	navigationTree: Proto.NavigationTree[]
): vscode.Range | undefined {
	for (const node of navigationTree) {
		const range = typeConverters.Range.fromTextSpan(node.spans[0]);
		if (startLine === range.start.line) {
			return range;
		} else if (
			startLine > range.start.line &&
			startLine <= range.end.line &&
			node.childItems
		) {
			return findScopeEndLineFromNavTreeWorker(startLine, node.childItems);
		}
	}
	return undefined;
}

async function findScopeEndLineFromNavTree(
	client: ITypeScriptServiceClient,
	document: vscode.TextDocument,
	startLine: number
) {
	const filepath = client.toOpenTsFilePath(document);
	if (!filepath) {
		return;
	}
	const response = await client.execute(
		'navtree',
		{ file: filepath },
		nulToken
	);
	if (response.type !== 'response' || !response.body?.childItems) {
		return;
	}
	return findScopeEndLineFromNavTreeWorker(startLine, response.body.childItems);
}

async function expandEditRangeEndWithNavTree(
	client: ITypeScriptServiceClient,
	document: vscode.TextDocument,
	range: vscode.Range
): Promise<vscode.Range> {
	const expandEnd = await findScopeEndLineFromNavTree(
		client,
		document,
		range.end.line
	);
	return new vscode.Range(range.start, expandEnd?.end ?? range.end);
}
