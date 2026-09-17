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
const MOUSE_NAV_REL = 'src/vs/sessions/contrib/sessions/browser/sessionsMouseNavigation.ts';

function sessionsMouseNavigationSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), MOUSE_NAV_REL),
		path.join(thisDir, '../../browser/sessionsMouseNavigation.ts'),
		path.join(thisDir, '../../../../../../../', MOUSE_NAV_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionsMouseNavigation.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SessionsMouseNavigation leftover fire-and-forget catch scan (D607)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('openPreviousSession / openNextSession voids double-catch onUnexpectedError (D607)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(sessionsMouseNavigationSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const previous = 'void this.sessionsService.openPreviousSession()';
		const next = 'void this.sessionsService.openNextSession()';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private handleMouseNavigation(event: MouseEvent, isMouseDown: boolean): void'));
		assert.strictEqual((source.match(/void this\.sessionsService\.openPreviousSession\(\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.sessionsService\.openNextSession\(\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${previous}${doubleCatch};`));
		assert.ok(source.includes(`${next}${doubleCatch};`));
		assert.ok(!source.includes(`${previous};`));
		assert.ok(!source.includes(`${next};`));
		assert.ok(!source.includes(`${previous}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${next}.catch(onUnexpectedError);`));
	});
});
