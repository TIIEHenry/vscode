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

function readRepoFile(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return fs.readFileSync(found, 'utf8');
}

function sliceBetween(source: string, startNeedle: string, endNeedle: string): string {
	const start = source.indexOf(startNeedle);
	assert.ok(start >= 0, startNeedle);
	const end = source.indexOf(endNeedle, start + startNeedle.length);
	assert.ok(end > start, endNeedle);
	return source.slice(start, end);
}

suite('Sessions focusPart', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('SESSIONS_PART focus delegates to focusSession when a view exists', () => {
		const source = readRepoFile('src/vs/sessions/browser/workbench.ts');
		const focusPart = sliceBetween(
			source,
			'focusPart(part: Parts, targetWindow: Window = mainWindow): void {',
			'\tfocus(): void {'
		);
		const sessionsCase = sliceBetween(focusPart, 'case Parts.SESSIONS_PART:', 'case Parts.CUSTOM_VIEW_GRID_PART:');

		assert.ok(!sessionsCase.includes('TODO'), 'SESSIONS_PART focus must not stay on the container-only TODO');
		assert.ok(sessionsCase.includes('this.sessionsService.activeSession.get()'));
		assert.ok(sessionsCase.includes('this.sessionsPartService.getSessionView(activeSession.sessionId)'));
		assert.ok(sessionsCase.includes('this.sessionsPartService.focusSession(activeSession)'));
		assert.ok(!sessionsCase.includes('focusSession(activeSession.sessionId)'), 'SessionsPart.focusSession takes a session id; the workbench must go through sessionsPartService');
		assert.ok(!sessionsCase.includes('focusSession(undefined)'), 'an absent session must not focus the placeholder slot');
		assert.ok(sessionsCase.includes('this.getPart(Parts.SESSIONS_PART).getContainer()?.focus()'));
		assert.ok(sessionsCase.indexOf('focusSession(activeSession)') < sessionsCase.indexOf('getContainer()?.focus()'));

		const titlebar = sliceBetween(source, 'private createMobileTitlebar(): void {', 'private toggleMobileSidebarDrawer(): void {');
		assert.ok(titlebar.includes('this.sessionsPartService.focusSession(this.sessionsService.activeSession.get())'));
		assert.ok(!titlebar.includes('getContainer()?.focus()'));

		const applyCustom = sliceBetween(
			source,
			'private _applyCustomViewGridVisibility(descriptor: ICustomViewDescriptor | undefined): void {',
			'private _restoreCustomViewCoveredPartWidths(): void {'
		);
		const hideFocus = applyCustom.slice(applyCustom.lastIndexOf('this.layout();'));
		assert.ok(hideFocus.includes('this.focusPart(Parts.SESSIONS_PART)'), 'hiding the custom view must reuse focusPart');
		assert.ok(!hideFocus.includes('focusSession'), 'hiding the custom view must not call focusSession directly');
		assert.ok(!hideFocus.includes('activeSession.get()'));
		assert.ok(!applyCustom.includes('focusSession(undefined)'));
	});
});
