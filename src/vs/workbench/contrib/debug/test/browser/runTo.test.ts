/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { Emitter } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { DebugService } from '../../browser/debugService.js';
import { IBreakpoint, IDebugSession, IThread, State } from '../../common/debug.js';

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

/** Cold start: the first global Stopped does not delete. Delete without continue only when that stop is the target line. */
function coldStartStopAction(input: { stoppedAtTarget: boolean; hasThread: boolean }): 'continue' | 'remove-without-continue' | 'return' {
	if (!input.hasThread) {
		return 'return';
	}
	if (input.stoppedAtTarget) {
		return 'remove-without-continue';
	}
	return 'continue';
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
		assert.ok(!runToBlock.includes('removeTempBreakPoint(state)'));
		assert.ok(runToBlock.includes('getTopStackFrame'));
		assert.ok(runToBlock.includes('startLineNumber === lineNumber'));
	});

	test('cold start keeps the temp breakpoint until the stop is the target line', () => {
		assert.strictEqual(coldStartStopAction({ stoppedAtTarget: false, hasThread: true }), 'continue');
		assert.strictEqual(coldStartStopAction({ stoppedAtTarget: true, hasThread: true }), 'remove-without-continue');
		assert.strictEqual(coldStartStopAction({ stoppedAtTarget: true, hasThread: false }), 'return');
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

type RunToHarness = {
	service: DebugService;
	removed: string[];
	added: number;
	existingBreakpoints: IBreakpoint[];
	session: IDebugSession;
	thread: IThread;
	fireState(state: State): void;
};

function createRunToHarness(options: { state: State; existingBreakpoints?: IBreakpoint[]; threads?: IThread[]; focusedThread?: IThread }): RunToHarness {
	const removed: string[] = [];
	let added = 0;
	const stateEmitter = new Emitter<State>();
	const existingBreakpoints = options.existingBreakpoints ?? [];
	const thread = {
		stopped: true,
		getTopStackFrame: () => ({ range: { startLineNumber: 4 }, source: { uri: URI.file('/tmp/target.ts') } }),
		continue: async () => { },
		session: undefined as unknown as IDebugSession,
	} as unknown as IThread;
	const session = {
		state: options.state,
		onDidChangeState: stateEmitter.event,
		getAllThreads: () => options.threads ?? [thread],
	} as unknown as IDebugSession;
	(thread as unknown as { session: IDebugSession }).session = session;

	const service = Object.create(DebugService.prototype) as DebugService;
	const serviceInternals = service as unknown as {
		viewModel: unknown;
		model: unknown;
		uriIdentityService: unknown;
	};
	serviceInternals.viewModel = {
		focusedSession: session,
		focusedThread: options.focusedThread,
	};
	serviceInternals.model = {
		getBreakpoints: () => existingBreakpoints,
	};
	serviceInternals.uriIdentityService = {
		extUri: {
			isEqual: (a: URI, b: URI) => a.toString() === b.toString(),
		},
	};
	(service as unknown as { addAndValidateBreakpoints: () => Promise<{ breakpoint: IBreakpoint; thread: IThread }> }).addAndValidateBreakpoints = async () => {
		added++;
		return { breakpoint: { getId: () => 'temp-bp' } as IBreakpoint, thread };
	};
	(service as unknown as { removeBreakpoints: (id: string) => void }).removeBreakpoints = (id: string) => {
		removed.push(id);
	};

	return {
		service,
		removed,
		get added() { return added; },
		existingBreakpoints,
		session,
		thread,
		fireState: (state: State) => {
			(session as unknown as { state: State }).state = state;
			stateEmitter.fire(state);
		},
	};
}

suite('Debug - runTo running session cleanup', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('running session keeps the temp breakpoint until the target line stops', async () => {
		const harness = createRunToHarness({ state: State.Running });
		await harness.service.runTo(URI.file('/tmp/target.ts'), 4);

		assert.strictEqual(harness.added, 1);
		assert.deepStrictEqual(harness.removed, []);

		harness.fireState(State.Stopped);
		assert.deepStrictEqual(harness.removed, ['temp-bp']);

		harness.fireState(State.Inactive);
		assert.deepStrictEqual(harness.removed, ['temp-bp']);
	});

	test('running session removes the temp breakpoint when it becomes inactive', async () => {
		const harness = createRunToHarness({ state: State.Running });
		await harness.service.runTo(URI.file('/tmp/target.ts'), 4);

		harness.fireState(State.Inactive);
		assert.deepStrictEqual(harness.removed, ['temp-bp']);
	});

	test('stopped session without a continuable thread removes the temp breakpoint before returning', async () => {
		const harness = createRunToHarness({ state: State.Stopped, threads: [] });
		await harness.service.runTo(URI.file('/tmp/target.ts'), 4);

		assert.strictEqual(harness.added, 1);
		assert.deepStrictEqual(harness.removed, ['temp-bp']);
	});

	test('an existing breakpoint on the line is not added or removed', async () => {
		const existing = { getId: () => 'user-bp' } as IBreakpoint;
		const harness = createRunToHarness({ state: State.Running, existingBreakpoints: [existing] });
		await harness.service.runTo(URI.file('/tmp/target.ts'), 4);

		assert.strictEqual(harness.added, 0);
		assert.deepStrictEqual(harness.removed, []);

		harness.fireState(State.Stopped);
		assert.deepStrictEqual(harness.removed, []);
	});
});
