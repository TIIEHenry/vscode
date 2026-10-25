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
const SOURCE_REL = 'src/vs/sessions/contrib/providers/remoteAgentHost/browser/manageRemoteAgentHosts.ts';

function sourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../../../browser/manageRemoteAgentHosts.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `manageRemoteAgentHosts.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('Manage Remote Agent Hosts leftover fire-and-forget catch scan (D1328)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('remote host options promise catches unexpected errors', () => {
		const source = fs.readFileSync(sourcePath(), 'utf8');
		const call = 'void instantiationService.invokeFunction(a => showRemoteHostOptions(a, selected.provider, { showBackButton: true }))';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void instantiationService\.invokeFunction\(a => showRemoteHostOptions\(a, selected\.provider, \{ showBackButton: true \}\)\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}.then(result => {`));
		assert.ok(source.includes(`}).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${call}.then(result => {\n\t\t\t\t\t\tif (result === 'back') {\n\t\t\t\t\t\t\tshowManagePicker();\n\t\t\t\t\t\t}\n\t\t\t\t\t});`));
		assert.ok(source.includes(doubleCatch));
	});
});
