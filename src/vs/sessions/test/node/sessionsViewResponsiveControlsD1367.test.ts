/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_VIEW_REL = 'src/vs/sessions/contrib/sessions/browser/views/sessionsView.ts';

function readSessionsViewSource(): string {
	const candidates = [
		path.join(process.cwd(), SESSIONS_VIEW_REL),
		path.join(thisDir, '../../contrib/sessions/browser/views/sessionsView.ts'),
		path.join(thisDir, '../../../../', SESSIONS_VIEW_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${SESSIONS_VIEW_REL} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return fs.readFileSync(found, 'utf8');
}

suite('SessionsView responsive controls (D1367)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('rebuilds desktop and phone controls when the phone-layout context changes', () => {
		const source = readSessionsViewSource();
		assert.ok(source.includes('this.scopedContextKeyService.onDidChangeContext'), 'SessionsView must subscribe to layout context changes');
		assert.ok(source.includes('e.affectsSome(new Set([IsPhoneLayoutContext.key]))'), 'only phone-layout changes should rebuild controls');
		assert.ok((source.match(/this\.updateResponsiveControls\(\);/g) ?? []).length >= 2, 'initial creation and runtime transitions must share one rebuild path');
		assert.ok(source.includes('this.responsiveControls.clear();'), 'the previous control set must be disposed before switching layouts');
		assert.ok(source.includes('new MobileSessionFilterChips(this.filterChipsContainer, this.sessionsControl)'), 'phone transitions must create filter chips');
		assert.ok(source.includes('scopedInstantiationService.createInstance(MenuWorkbenchToolBar'), 'desktop transitions must recreate the header toolbar');
		assert.ok(source.includes('this.filterChipsContainer = DOM.append(sessionsContent, $(\'.mobile-session-filter-chips-slot\'))'), 'the phone slot must exist for a later runtime transition');
	});
});
