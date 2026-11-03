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
const SOURCE_REL = 'src/vs/sessions/contrib/sessions/browser/sessionsWindowNotifier.ts';

function sessionsWindowNotifierSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/sessionsWindowNotifier.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionsWindowNotifier.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

suite('SessionsWindowNotifier leftover fire-and-forget catch scan (D636)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_notify(session, newValue) void single-catch onUnexpectedError (D636)', () => {
		const source = fs.readFileSync(sessionsWindowNotifierSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this._notify(session, newValue)';
		const singleCall = `${call}${singleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _notify(session: ISession, status: SessionStatus): Promise<void> {'));
		assert.strictEqual((source.match(/void this\._notify\(session, newValue\)/g) ?? []).length, 1);
		assert.ok(source.includes(singleCall));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}${doubleCatch};`));
		assert.strictEqual(countDoubleChains(source), 0);
	});
});

suite('SessionsWindowNotifier leftover fire-and-forget catch scan (D640)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_notify(session, SessionStatus.Completed) scheduler void single-catch onUnexpectedError (D640)', () => {
		const source = fs.readFileSync(sessionsWindowNotifierSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this._notify(session, SessionStatus.Completed)';
		const singleCall = `${call}${singleCatch},`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _notify(session: ISession, status: SessionStatus): Promise<void> {'));
		assert.strictEqual((source.match(/void this\._notify\(session, SessionStatus\.Completed\)/g) ?? []).length, 1);
		assert.ok(source.includes(singleCall));
		assert.ok(!source.includes(`${call},`));
		assert.ok(!source.includes(`${call}${doubleCatch},`));
		assert.strictEqual(countDoubleChains(source), 0);
	});
});
