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
const PLUGINS_REL = 'src/vs/workbench/contrib/conversation/browser/enginePluginsSection.ts';
const CONTEXT_REL = 'src/vs/workbench/contrib/conversation/browser/engineContextVariableSection.ts';
const PROVIDER_REL = 'src/vs/workbench/contrib/conversation/browser/engineProviderModelSection.ts';
const HOOKS_REL = 'src/vs/workbench/contrib/conversation/browser/engineHooksSection.ts';
const RULES_REL = 'src/vs/workbench/contrib/conversation/browser/engineRulesSection.ts';
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
	assert.ok(!source.includes(`${leftoverCall};`));
	assert.ok(!source.includes(`${leftoverCall},`));
	assert.ok(!source.includes(`${leftoverCall})`));
	assert.ok(!source.includes(`${leftoverCall}.catch(onUnexpectedError);`));
	assert.ok(!source.includes(`${leftoverCall}.catch(onUnexpectedError),`));
}

suite('Conversation leftover remaining Promise fire-and-forget catch scan (D716)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight leftover Promise double-chain sites; D701 engineAgents and D710 stay skipped', () => {
		const files = [PLUGINS_REL, CONTEXT_REL, PROVIDER_REL, HOOKS_REL, RULES_REL];
		let sites = 0;
		for (const rel of files) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += (source.match(leftoverDouble) ?? []).length;
		}
		assert.strictEqual(sites, 8);
		const agents = fs.readFileSync(resolveSource(AGENTS_REL), 'utf8');
		assert.strictEqual((agents.match(leftoverDouble) ?? []).length, 3);
		let d710 = 0;
		for (const rel of D710_RELS) {
			d710 += (fs.readFileSync(resolveSource(rel), 'utf8').match(leftoverDouble) ?? []).length;
		}
		assert.strictEqual(d710, 8);
	});

	test('enginePlugins leftover executeCommand singles are double-chain', () => {
		assertLeftoverExecuteCommandDoubleChain(fs.readFileSync(resolveSource(PLUGINS_REL), 'utf8'), 2);
	});

	test('engineContextVariable leftover executeCommand singles are double-chain', () => {
		assertLeftoverExecuteCommandDoubleChain(fs.readFileSync(resolveSource(CONTEXT_REL), 'utf8'), 2);
	});

	test('engineProviderModel leftover executeCommand singles are double-chain', () => {
		assertLeftoverExecuteCommandDoubleChain(fs.readFileSync(resolveSource(PROVIDER_REL), 'utf8'), 2);
	});

	test('engineHooks leftover executeCommand single is double-chain', () => {
		assertLeftoverExecuteCommandDoubleChain(fs.readFileSync(resolveSource(HOOKS_REL), 'utf8'), 1);
	});

	test('engineRules leftover executeCommand single is double-chain', () => {
		assertLeftoverExecuteCommandDoubleChain(fs.readFileSync(resolveSource(RULES_REL), 'utf8'), 1);
	});

	test('mcpRuntime / clipboard OPEN_CONNECTION leftovers remain unchained (not this knife)', () => {
		const runtime = fs.readFileSync(resolveSource(MCP_RUNTIME_REL), 'utf8');
		const clipboard = fs.readFileSync(resolveSource(CLIPBOARD_REL), 'utf8');
		assert.strictEqual((runtime.match(leftoverBare) ?? []).length, 3);
		assert.strictEqual((clipboard.match(leftoverBare) ?? []).length, 2);
		assert.strictEqual((runtime.match(leftoverDouble) ?? []).length, 0);
		assert.strictEqual((clipboard.match(leftoverDouble) ?? []).length, 0);
	});
});
