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
const SOURCE_REL = 'src/vs/sessions/contrib/providers/agentHost/browser/localAgentHostSessionsProvider.ts';

function localAgentHostSessionsProviderSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/localAgentHostSessionsProvider.ts'),
		path.join(thisDir, '../../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `localAgentHostSessionsProvider.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('LocalAgentHostSessionsProvider leftover fire-and-forget catch scan (D617)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('createNewSession _resolveDevContainerAvailability void double-catch onUnexpectedError (D617)', () => {
		// Method body already try/catches; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(localAgentHostSessionsProviderSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this._resolveDevContainerAvailability(session.sessionId, workspaceUri)';
		const doubleCall = `${call}${doubleCatch};`;
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\._resolveDevContainerAvailability\(session\.sessionId, workspaceUri\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/this\._resolveDevContainerAvailability\(/g) ?? []).length, 1);
		assert.ok(source.includes(doubleCall));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
		assert.ok(source.includes('private async _resolveDevContainerAvailability(sessionId: string, workspaceUri: URI): Promise<void>'));
		assert.ok(source.includes('\t\t} catch (error) {\n\t\t\tthis._logService.warn(`[${this.id}] Failed to resolve Dev Container availability for ${workspaceUri.toString()}`, error);\n\t\t}'));
	});
});
