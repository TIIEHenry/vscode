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
const TABBED_REL = 'src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts';
const CHAT_ENTRY_REL = 'src/vs/workbench/contrib/terminal/browser/terminalTabsChatEntry.ts';
const PTY_REL = 'src/vs/workbench/contrib/terminal/browser/agentHostPty.ts';

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
	assert.ok(source.includes(`${call}${doubleCatch};`));
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('Terminal leftover Promise fire-and-forget catch scan (D685)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('tabbed view _handleContainerDrop leftover void is double-chain', () => {
		const source = fs.readFileSync(resolveSource(TABBED_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _handleContainerDrop(event: DragEvent): Promise<void> {'));
		assertDoubleChain(source, 'void this._handleContainerDrop(event)', 1);
	});

	test('tabs chat entry executeCommand leftover void is double-chain', () => {
		const source = fs.readFileSync(resolveSource(CHAT_ENTRY_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleChain(source, "void this._commandService.executeCommand('workbench.action.terminal.chat.viewHiddenChatTerminals')", 1);
	});

	test('agentHostPty leftover stays skipped', () => {
		const source = fs.readFileSync(resolveSource(PTY_REL), 'utf8');
		assert.ok(source.includes('void this._connection.disposeTerminal(this._terminalUri).catch(err => this._logHostDisposalError(err));'));
		assert.ok(!source.includes('void this._connection.disposeTerminal(this._terminalUri).catch(onUnexpectedError)'));
	});
});
