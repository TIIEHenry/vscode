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
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const MCP_RUNTIME_REL = 'src/vs/workbench/contrib/conversation/browser/engineMcpRuntimePanel.ts';
const CLIPBOARD_REL = 'src/vs/workbench/contrib/conversation/browser/engineClipboardSection.ts';
const AGENTS_REL = 'src/vs/workbench/contrib/conversation/browser/engineAgentsSection.ts';
const D710_RELS = [
	'src/vs/workbench/contrib/conversation/browser/engineToolsSection.ts',
	'src/vs/workbench/contrib/conversation/browser/engineSkillsSection.ts',
	'src/vs/workbench/contrib/conversation/browser/engineTriggersSection.ts',
	'src/vs/workbench/contrib/conversation/browser/engineMcpSection.ts',
	'src/vs/workbench/contrib/conversation/browser/enginePreferencesPane.ts',
	'src/vs/workbench/contrib/conversation/browser/engineOverviewSection.ts',
] as const;
const D716_RELS = [
	'src/vs/workbench/contrib/conversation/browser/enginePluginsSection.ts',
	'src/vs/workbench/contrib/conversation/browser/engineContextVariableSection.ts',
	'src/vs/workbench/contrib/conversation/browser/engineProviderModelSection.ts',
	'src/vs/workbench/contrib/conversation/browser/engineHooksSection.ts',
	'src/vs/workbench/contrib/conversation/browser/engineRulesSection.ts',
] as const;

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
const leftoverCall = 'void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID)';
const leftoverBare = new RegExp(`${leftoverCall.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\.catch)`, 'g');
const leftoverDouble = new RegExp(`${leftoverCall.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${doubleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');

function assertLeftoverExecuteCommandDoubleChain(source: string, count: number): void {
	assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
	assert.strictEqual((source.match(/void this\.commandService\.executeCommand\(OPEN_CONNECTION_PREFERENCES_COMMAND_ID\)/g) ?? []).length, count);
	assert.strictEqual((source.match(leftoverDouble) ?? []).length, count);
	assert.strictEqual((source.match(leftoverBare) ?? []).length, 0);
	assert.ok(!source.includes(`${leftoverCall};`));
	assert.ok(!source.includes(`${leftoverCall},`));
	assert.ok(!source.includes(`${leftoverCall})`));
	assert.ok(!source.includes(`${leftoverCall}.catch(onUnexpectedError);`));
	assert.ok(!source.includes(`${leftoverCall}.catch(onUnexpectedError),`));
}

function countDouble(rel: string): number {
	return (fs.readFileSync(resolveSource(rel), 'utf8').match(leftoverDouble) ?? []).length;
}

suite('Conversation leftover remaining Promise fire-and-forget catch scan (D721)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers five leftover Promise double-chain sites; D701 / D710 / D716 stay skipped', () => {
		assert.strictEqual(countDouble(MCP_RUNTIME_REL) + countDouble(CLIPBOARD_REL), 5);
		assert.strictEqual(countDouble(AGENTS_REL), 3);
		let d710 = 0;
		for (const rel of D710_RELS) {
			d710 += countDouble(rel);
		}
		assert.strictEqual(d710, 8);
		let d716 = 0;
		for (const rel of D716_RELS) {
			d716 += countDouble(rel);
		}
		assert.strictEqual(d716, 8);
	});

	test('engineMcpRuntime leftover executeCommand singles are double-chain', () => {
		assertLeftoverExecuteCommandDoubleChain(fs.readFileSync(resolveSource(MCP_RUNTIME_REL), 'utf8'), 3);
	});

	test('engineClipboard leftover executeCommand singles are double-chain', () => {
		assertLeftoverExecuteCommandDoubleChain(fs.readFileSync(resolveSource(CLIPBOARD_REL), 'utf8'), 2);
	});
});
