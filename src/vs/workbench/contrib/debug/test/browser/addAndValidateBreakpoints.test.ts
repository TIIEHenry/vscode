/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { URI } from '../../../../../base/common/uri.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

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

const enum Score {
	Focused,
	Verified,
	VerifiedAndPausedInFile,
	VerifiedAndFocused,
}

interface MockThread {
	id: number;
	stopped: boolean;
	topUri?: URI;
}

interface MockSession {
	sessionId: string;
	threads: MockThread[];
}

/** Mirrors addAndValidateBreakpoints thread selection (r08-2). */
function pickThreadForValidatedBreakpoint(input: {
	targetUri: URI;
	focusedThread: MockThread | undefined;
	sessionsInVerifyOrder: MockSession[];
	isEqual: (a: URI, b: URI) => boolean;
}): { thread: MockThread | undefined; score: Score } {
	let bestThread = input.focusedThread;
	let bestScore = Score.Focused;

	for (const session of input.sessionsInVerifyOrder) {
		const threads = session.threads.filter(t => t.stopped);

		if (bestScore < Score.VerifiedAndFocused) {
			if (input.focusedThread && threads.includes(input.focusedThread)) {
				bestThread = input.focusedThread;
				bestScore = Score.VerifiedAndFocused;
			}
		}

		if (bestScore < Score.VerifiedAndPausedInFile) {
			const pausedInThisFile = threads.find(t => {
				return t.topUri && input.isEqual(t.topUri, input.targetUri);
			});
			if (pausedInThisFile) {
				bestThread = pausedInThisFile;
				bestScore = Score.VerifiedAndPausedInFile;
			}
		}

		if (bestScore < Score.Verified && threads.length > 0) {
			bestThread = threads[0];
			bestScore = Score.Verified;
		}
	}

	return { thread: bestThread, score: bestScore };
}

suite('Debug - addAndValidateBreakpoints thread scoring', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const targetUri = URI.file('/project/foo.ts');
	const otherUri = URI.file('/project/bar.ts');
	const isEqual = (a: URI, b: URI) => a.toString() === b.toString();

	test('addAndValidateBreakpoints Verified branch assigns Score.Verified when threads pause elsewhere', () => {
		const source = fs.readFileSync(debugServiceSourcePath(), 'utf8');
		const block = source.slice(source.indexOf('private async addAndValidateBreakpoints'), source.indexOf('return { thread: bestThread, breakpoint }'));
		assert.ok(block.includes('if (bestScore < Score.Verified && threads.length > 0)'));
		assert.ok(block.includes('bestScore = Score.Verified;'));
		assert.ok(!block.match(/if \(bestScore < Score\.Verified\)[\s\S]*?bestScore = Score\.VerifiedAndPausedInFile/));
	});

	test('later session paused in target file wins after earlier session paused elsewhere', () => {
		const threadWrongFile: MockThread = { id: 1, stopped: true, topUri: otherUri };
		const threadInFile: MockThread = { id: 2, stopped: true, topUri: targetUri };
		const result = pickThreadForValidatedBreakpoint({
			targetUri,
			focusedThread: undefined,
			sessionsInVerifyOrder: [
				{ sessionId: 'a', threads: [threadWrongFile] },
				{ sessionId: 'b', threads: [threadInFile] },
			],
			isEqual,
		});
		assert.strictEqual(result.thread, threadInFile);
		assert.strictEqual(result.score, Score.VerifiedAndPausedInFile);
	});

	test('empty paused list in first session keeps Focused until a later session pauses in file', () => {
		const threadInFile: MockThread = { id: 3, stopped: true, topUri: targetUri };
		const focused: MockThread = { id: 99, stopped: false, topUri: otherUri };
		const result = pickThreadForValidatedBreakpoint({
			targetUri,
			focusedThread: focused,
			sessionsInVerifyOrder: [
				{ sessionId: 'empty', threads: [] },
				{ sessionId: 'hit', threads: [threadInFile] },
			],
			isEqual,
		});
		assert.strictEqual(result.thread, threadInFile);
		assert.strictEqual(result.score, Score.VerifiedAndPausedInFile);
	});

	test('VerifiedAndFocused is not downgraded by a later verified session with only unrelated pauses', () => {
		const focused: MockThread = { id: 1, stopped: true, topUri: targetUri };
		const otherPaused: MockThread = { id: 2, stopped: true, topUri: otherUri };
		const result = pickThreadForValidatedBreakpoint({
			targetUri,
			focusedThread: focused,
			sessionsInVerifyOrder: [
				{ sessionId: 'focused', threads: [focused] },
				{ sessionId: 'other', threads: [otherPaused] },
			],
			isEqual,
		});
		assert.strictEqual(result.thread, focused);
		assert.strictEqual(result.score, Score.VerifiedAndFocused);
	});
});
