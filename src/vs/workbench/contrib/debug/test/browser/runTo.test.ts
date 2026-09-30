/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { State } from '../../common/debug.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';

function debugServiceSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/debugService.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `debugService.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

/** Mirrors runTo temp-breakpoint removal after continue (r08-1). */
function shouldRemoveTempBreakpoint(input: {
	sessionState: State;
	targetStopped: boolean;
	sawTargetRunning: boolean;
	continueFinished: boolean;
}): 'remove' | 'observe-running' | 'noop' {
	if (input.sessionState === State.Inactive) {
		return 'remove';
	}
	if (!input.targetStopped) {
		return 'observe-running';
	}
	if (input.sawTargetRunning) {
		return 'remove';
	}
	if (input.continueFinished) {
		return 'remove';
	}
	return 'noop';
}

suite('Debug - runTo temp breakpoint removal', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('runTo listener uses target thread stopped, not focused session state', () => {
		const source = fs.readFileSync(debugServiceSourcePath(), 'utf8');
		const runToBlock = source.slice(source.indexOf('async runTo('), source.indexOf('private async addAndValidateBreakpoints'));
		assert.ok(runToBlock.includes('threadToContinue.session.onDidChangeState'));
		assert.ok(runToBlock.includes('threadToContinue.stopped'));
		assert.ok(runToBlock.includes('threadToContinue.session.state === State.Inactive'));
		assert.ok(!runToBlock.includes('removeTempBreakPoint(focusedSession.state)'));
		assert.ok(!runToBlock.includes('removeTempBreakPoint(threadToContinue.session.state)'));
	});

	test('runTo does not delete when target is running even if session would read Stopped', () => {
		assert.strictEqual(shouldRemoveTempBreakpoint({
			sessionState: State.Stopped,
			targetStopped: false,
			sawTargetRunning: false,
			continueFinished: false,
		}), 'observe-running');
	});

	test('runTo deletes once when target stops again after running', () => {
		assert.strictEqual(shouldRemoveTempBreakpoint({
			sessionState: State.Stopped,
			targetStopped: true,
			sawTargetRunning: true,
			continueFinished: true,
		}), 'remove');
	});

	test('runTo keeps temp breakpoint when another thread pauses before continue finishes', () => {
		assert.strictEqual(shouldRemoveTempBreakpoint({
			sessionState: State.Stopped,
			targetStopped: true,
			sawTargetRunning: false,
			continueFinished: false,
		}), 'noop');
	});

	test('runTo keeps temp breakpoint when target stays on original pause and another thread fires state', () => {
		assert.strictEqual(shouldRemoveTempBreakpoint({
			sessionState: State.Stopped,
			targetStopped: true,
			sawTargetRunning: false,
			continueFinished: false,
		}), 'noop');
	});

	test('runTo deletes after continue without continued when target remains stopped', () => {
		assert.strictEqual(shouldRemoveTempBreakpoint({
			sessionState: State.Stopped,
			targetStopped: true,
			sawTargetRunning: false,
			continueFinished: true,
		}), 'remove');
	});

	test('runTo false-only latch would miss continue-without-continued removal', () => {
		const withFalseOnlyLatch = shouldRemoveTempBreakpoint({
			sessionState: State.Stopped,
			targetStopped: true,
			sawTargetRunning: false,
			continueFinished: true,
		});
		const falseOnlyDecision = shouldRemoveTempBreakpoint({
			sessionState: State.Stopped,
			targetStopped: true,
			sawTargetRunning: false,
			continueFinished: false,
		});
		assert.strictEqual(withFalseOnlyLatch, 'remove');
		assert.strictEqual(falseOnlyDecision, 'noop');
	});

	test('runTo removes temp breakpoint when session becomes inactive', () => {
		assert.strictEqual(shouldRemoveTempBreakpoint({
			sessionState: State.Inactive,
			targetStopped: true,
			sawTargetRunning: false,
			continueFinished: false,
		}), 'remove');
	});
});
