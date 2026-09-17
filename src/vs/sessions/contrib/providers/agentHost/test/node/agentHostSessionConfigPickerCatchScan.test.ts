/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_REL = 'src/vs/sessions/contrib/providers/agentHost/browser/agentHostSessionConfigPicker.ts';

function agentHostSessionConfigPickerSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/agentHostSessionConfigPicker.ts'),
		path.join(thisDir, '../../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `agentHostSessionConfigPicker.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AgentHostSessionConfigPicker leftover fire-and-forget catch scan (D620)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_showPicker onSelect IIFE void double-catch onUnexpectedError (D620)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(agentHostSessionConfigPickerSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('protected async _showPicker(provider: IAgentHostSessionsProvider, sessionId: string, property: string, schema: SessionConfigPropertySchema, trigger: HTMLElement): Promise<void>'));
		assert.strictEqual((source.match(/void \(async \(\) => \{/g) ?? []).length, 1);
		assert.strictEqual((source.match(/\)\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(source.includes(`})()${doubleCatch};`));
		assert.ok(!source.includes('})().catch(onUnexpectedError);'));
		assert.ok(source.includes('provider.setSessionConfigValue(sessionId, property, nextValue).catch(() => { /* best-effort */ });'));
		assert.ok(source.includes('provider.setSessionConfigValue(sessionId, SessionConfigKey.Isolation, nextValue).catch(() => { /* best-effort */ });'));
	});
});
