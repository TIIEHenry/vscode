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
const TOOLS_REL = 'src/vs/workbench/contrib/conversation/browser/engineToolsSection.ts';
const SKILLS_REL = 'src/vs/workbench/contrib/conversation/browser/engineSkillsSection.ts';
const TRIGGERS_REL = 'src/vs/workbench/contrib/conversation/browser/engineTriggersSection.ts';
const MCP_REL = 'src/vs/workbench/contrib/conversation/browser/engineMcpSection.ts';
const PREFERENCES_REL = 'src/vs/workbench/contrib/conversation/browser/enginePreferencesPane.ts';
const OVERVIEW_REL = 'src/vs/workbench/contrib/conversation/browser/engineOverviewSection.ts';
const AGENTS_REL = 'src/vs/workbench/contrib/conversation/browser/engineAgentsSection.ts';

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

function assertLeftoverExecuteCommandDoubleChain(source: string, count: number): void {
	assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
	assert.strictEqual((source.match(/void this\.commandService\.executeCommand\(OPEN_CONNECTION_PREFERENCES_COMMAND_ID\)/g) ?? []).length, count);
	assert.ok(source.includes(`${leftoverCall}${doubleCatch}`));
	assert.ok(!source.includes(`${leftoverCall};`));
	assert.ok(!source.includes(`${leftoverCall},`));
	assert.ok(!source.includes(`${leftoverCall})`));
	assert.ok(!source.includes(`${leftoverCall}.catch(onUnexpectedError);`));
	assert.ok(!source.includes(`${leftoverCall}.catch(onUnexpectedError),`));
}

suite('Conversation leftover remaining Promise fire-and-forget catch scan (D710)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight leftover Promise double-chain sites; D701 engineAgents executeCommand stays skipped', () => {
		const files = [TOOLS_REL, SKILLS_REL, TRIGGERS_REL, MCP_REL, PREFERENCES_REL, OVERVIEW_REL];
		let sites = 0;
		for (const rel of files) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += (source.match(new RegExp(`${leftoverCall.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${doubleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length;
		}
		assert.strictEqual(sites, 8);
		const agents = fs.readFileSync(resolveSource(AGENTS_REL), 'utf8');
		assert.strictEqual((agents.match(/void this\.commandService\.executeCommand\(OPEN_CONNECTION_PREFERENCES_COMMAND_ID\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 3);
	});

	test('engineTools / skills leftover executeCommand singles are double-chain', () => {
		assertLeftoverExecuteCommandDoubleChain(fs.readFileSync(resolveSource(TOOLS_REL), 'utf8'), 1);
		assertLeftoverExecuteCommandDoubleChain(fs.readFileSync(resolveSource(SKILLS_REL), 'utf8'), 1);
	});

	test('engineTriggers leftover executeCommand singles are double-chain', () => {
		assertLeftoverExecuteCommandDoubleChain(fs.readFileSync(resolveSource(TRIGGERS_REL), 'utf8'), 2);
	});

	test('engineMcp leftover executeCommand singles are double-chain', () => {
		assertLeftoverExecuteCommandDoubleChain(fs.readFileSync(resolveSource(MCP_REL), 'utf8'), 1);
	});

	test('enginePreferences leftover executeCommand single is double-chain', () => {
		assertLeftoverExecuteCommandDoubleChain(fs.readFileSync(resolveSource(PREFERENCES_REL), 'utf8'), 1);
	});

	test('engineOverview leftover executeCommand singles are double-chain', () => {
		assertLeftoverExecuteCommandDoubleChain(fs.readFileSync(resolveSource(OVERVIEW_REL), 'utf8'), 2);
	});
});
