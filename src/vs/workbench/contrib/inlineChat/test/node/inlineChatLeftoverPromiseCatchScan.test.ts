/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const CONTROLLER_REL = 'src/vs/workbench/contrib/inlineChat/browser/inlineChatController.ts';
const SESSION_REL = 'src/vs/workbench/contrib/inlineChat/browser/inlineChatSessionServiceImpl.ts';
const REVIEW_REL = 'src/vs/workbench/contrib/inlineChat/browser/inlineChatEditReviewSession.ts';
const NOTEBOOK_REL = 'src/vs/workbench/contrib/inlineChat/browser/inlineChatNotebook.ts';
const ACTIONS_REL = 'src/vs/workbench/contrib/inlineChat/browser/inlineChatActions.ts';
const AGENTS_REL = 'src/vs/workbench/contrib/conversation/browser/engineAgentsSection.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function assertDoubleChain(source: string, call: string, count: number): void {
	assert.strictEqual((source.match(new RegExp(call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, count);
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('InlineChat leftover Promise fire-and-forget catch scan (D701)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('openEditor SIDE_GROUP leftover is double-chain', () => {
		const source = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		assert.ok(source.includes("import { CancellationError, isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleChain(source, 'this.#editorService.openEditor({ resource: entry.modifiedURI }, SIDE_GROUP)', 1);
		assertDoubleChain(source, 'void controller.run({ message, autoSend: true })', 1);
	});

	test('sessionService leftover cancel / reject voids are double-chain', () => {
		const source = fs.readFileSync(resolveSource(SESSION_REL), 'utf8');
		assert.ok(source.includes("import { CancellationError, isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleChain(source, "void this.#chatService.cancelCurrentRequestForSession(chatModel.sessionResource, 'inlineChatSession')", 1);
		assertDoubleChain(source, 'void editingSession.reject()', 1);
		assertDoubleChain(source, "void this.#chatService.cancelCurrentRequestForSession(chatModel.sessionResource, 'inlineChatBeginTurnFailed')", 1);
	});

	test('editReview leftover processExternalEdits / resetReadonlyLocks voids are double-chain; await stays skipped', () => {
		const source = fs.readFileSync(resolveSource(REVIEW_REL), 'utf8');
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _processExternalEdits(response: IChatResponseModel): Promise<void> {'));
		assert.ok(source.includes('private async _resetReadonlyLocks(): Promise<void> {'));
		assertDoubleChain(source, 'void this._processExternalEdits(response)', 2);
		assertDoubleChain(source, 'void this._resetReadonlyLocks()', 1);
		assert.ok(source.includes('await this._processExternalEdits(response);'));
		assert.ok(source.includes('await this._resetReadonlyLocks();'));
		assert.ok(!source.includes('await this._processExternalEdits(response).catch'));
		assert.ok(!source.includes('await this._resetReadonlyLocks().catch'));
	});

	test('notebook acceptSession leftover is double-chain; Action2.run stays skipped', () => {
		const notebook = fs.readFileSync(resolveSource(NOTEBOOK_REL), 'utf8');
		const controller = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		assert.ok(notebook.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(controller.includes('async acceptSession() {'));
		assertDoubleChain(notebook, 'void InlineChatController.get(editor)?.acceptSession()', 1);
		assert.ok(actions.includes('ctrl.run({ autoSend: true, attachDiagnostics: true });'));
		assert.ok(!actions.includes('ctrl.run({ autoSend: true, attachDiagnostics: true }).catch'));
	});

	test('engineAgentsSection leftover executeCommand singles are double-chain', () => {
		const source = fs.readFileSync(resolveSource(AGENTS_REL), 'utf8');
		const call = 'void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\(OPEN_CONNECTION_PREFERENCES_COMMAND_ID\)/g) ?? []).length, 3);
		assert.ok(source.includes(`${call}${doubleCatch}`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError),`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError)\n`));
		assert.ok(!source.includes(`${call};`));
	});
});
