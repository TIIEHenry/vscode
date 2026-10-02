/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { autorun, constObservable, IObservable, ISettableObservable, observableValue, transaction } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { AgentSessionApprovalKind, AgentSessionApprovalModel, agentSessionApprovalId, IAgentSessionApprovalInfo } from '../../../../../workbench/contrib/chat/browser/agentSessions/agentSessionApprovalModel.js';
import { ISession } from '../../../../services/sessions/common/session.js';
import { IActiveSession } from '../../../../services/sessions/common/sessionsManagement.js';
import { ISessionsService } from '../../../../services/sessions/browser/sessionsService.js';
import { BlockedSessionReason, BlockedSessions, IBlockedSession } from '../../../blockedSessions/browser/blockedSessions.js';
import { BlockedSessionsCIFixModel } from '../../browser/blockedSessionsCIFixModel.js';
import { BlockedSessionsIndicatorModel, RequiresInputKind } from '../../browser/blockedSessionsIndicatorModel.js';

suite('BlockedSessionsIndicatorModel', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createModel(options?: { quality?: string }): {
		model: BlockedSessionsIndicatorModel;
		blockedModel: TestBlockedSessions;
		approvalModel: TestApprovalModel;
		ciFixModel: TestCIFixModel;
		sessionsService: TestSessionsService;
	} {
		const blockedModel = new TestBlockedSessions();
		const approvalModel = new TestApprovalModel();
		const ciFixModel = new TestCIFixModel();
		const sessionsService = new TestSessionsService();
		const productService = { quality: options?.quality ?? 'insider' } as unknown as IProductService;
		const instantiationService = new class extends mock<IInstantiationService>() { }();
		const model = store.add(new BlockedSessionsIndicatorModel(
			approvalModel as unknown as AgentSessionApprovalModel,
			blockedModel as unknown as BlockedSessions,
			ciFixModel as unknown as BlockedSessionsCIFixModel,
			sessionsService as unknown as ISessionsService,
			instantiationService,
			productService,
			new NullLogService(),
		));
		// Keep the derived live so it recomputes on visibility/dismissal changes.
		store.add(autorun(reader => { model.blockedSessions.read(reader); }));
		return { model, blockedModel, approvalModel, ciFixModel, sessionsService };
	}

	function blockedIds(model: BlockedSessionsIndicatorModel): string[] {
		return model.blockedSessions.get().map(entry => entry.session.sessionId);
	}

	test('excludes visible sessions from the blocked set', () => {
		const { model, blockedModel, sessionsService } = createModel();
		const s1 = new TestSession('s1');
		const s2 = new TestSession('s2');
		blockedModel.setBlocked([needsInput(s1), needsInput(s2)]);
		sessionsService.setVisible([s1]);
		assert.deepStrictEqual(blockedIds(model), ['s2']);
	});

	test('excludes sessions whose CI fix is being submitted', () => {
		const { model, blockedModel, ciFixModel } = createModel();
		const s1 = new TestSession('s1');
		const s2 = new TestSession('s2');
		blockedModel.setBlocked([failingCI(s1), failingCI(s2)]);
		assert.deepStrictEqual(blockedIds(model), ['s1', 's2']);
		ciFixModel.setHidden(['s1']);
		assert.deepStrictEqual(blockedIds(model), ['s2']);
	});

	test('blinks when a new, not-yet-visible session becomes blocked', () => {
		const { model, blockedModel } = createModel();
		blockedModel.setBlocked([needsInput(new TestSession('s1'))]);
		assert.strictEqual(model.consumePendingBlink(), true);
	});

	test('does not blink when a new block is already visible', () => {
		const { model, blockedModel, sessionsService } = createModel();
		const s1 = new TestSession('s1');
		sessionsService.setVisible([s1]);
		blockedModel.setBlocked([needsInput(s1)]);
		assert.strictEqual(model.consumePendingBlink(), false);
	});

	test('acknowledges a blocked session when it becomes visible', () => {
		const { model, blockedModel, sessionsService } = createModel();
		const s1 = new TestSession('s1');
		blockedModel.setBlocked([needsInput(s1)]);
		assert.strictEqual(model.consumePendingBlink(), true);

		sessionsService.setVisible([s1]);
		assert.deepStrictEqual({ blocked: blockedIds(model), blink: model.consumePendingBlink() }, { blocked: [], blink: false });

		sessionsService.setVisible([]);
		assert.deepStrictEqual({ blocked: blockedIds(model), blink: model.consumePendingBlink() }, { blocked: [], blink: false });
	});

	test('does not blink again when an announced needs-input session gains its approval', () => {
		const { model, blockedModel, approvalModel } = createModel();
		const s1 = new TestSession('s1');
		blockedModel.setBlocked([needsInput(s1)]);
		assert.strictEqual(model.consumePendingBlink(), true);

		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Terminal, new Date(1000), 'tool-call-1'));

		assert.deepStrictEqual({
			blocked: blockedIds(model),
			kind: model.requiresInputKind.get(),
			blink: model.consumePendingBlink(),
		}, {
			blocked: ['s1'],
			kind: RequiresInputKind.TerminalApproval,
			blink: false,
		});
	});

	test('keeps a seen needs-input session acknowledged when its approval arrives', () => {
		const { model, blockedModel, approvalModel, sessionsService } = createModel();
		const s1 = new TestSession('s1');
		blockedModel.setBlocked([needsInput(s1)]);
		sessionsService.setVisible([s1]);
		sessionsService.setVisible([]);
		assert.deepStrictEqual(blockedIds(model), []);

		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Terminal, new Date(1000), 'tool-call-1'));

		assert.deepStrictEqual({
			blocked: blockedIds(model),
			blink: model.consumePendingBlink(),
		}, { blocked: [], blink: false });
	});

	test('plays a queued needs-input blink once when the approval arrives before it plays', () => {
		const { model, blockedModel, approvalModel } = createModel();
		const s1 = new TestSession('s1');
		blockedModel.setBlocked([needsInput(s1)]);
		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Question, new Date(1000), 'q-1'));

		assert.deepStrictEqual({
			blocked: blockedIds(model),
			kind: model.requiresInputKind.get(),
			blink: model.consumePendingBlink(),
			again: model.consumePendingBlink(),
		}, {
			blocked: ['s1'],
			kind: RequiresInputKind.Question,
			blink: true,
			again: false,
		});
	});

	test('a distinct later approval still resurfaces after the first approval was the same input', () => {
		const { model, blockedModel, approvalModel, sessionsService } = createModel();
		const s1 = new TestSession('s1');
		blockedModel.setBlocked([needsInput(s1)]);
		sessionsService.setVisible([s1]);
		sessionsService.setVisible([]);
		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Terminal, new Date(1000), 'tool-call-1'));
		assert.deepStrictEqual(blockedIds(model), []);

		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Terminal, new Date(2000), 'tool-call-2'));

		assert.deepStrictEqual({
			blocked: blockedIds(model),
			blink: model.consumePendingBlink(),
		}, { blocked: ['s1'], blink: true });
	});

	test('ignoring needs-input still hides the session after its approval loads', () => {
		const { model, blockedModel, approvalModel } = createModel();
		const s1 = new TestSession('s1');
		blockedModel.setBlocked([needsInput(s1)]);
		model.ignoreSession(s1 as unknown as ISession);
		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Terminal, new Date(1000), 'tool-call-1'));

		assert.deepStrictEqual({
			blocked: blockedIds(model),
			blink: model.consumePendingBlink(),
		}, { blocked: [], blink: false });

		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Question, new Date(2000), 'q-2'));
		assert.deepStrictEqual(blockedIds(model), ['s1']);
	});

	test('keeps an approval acknowledged when its chat model reloads', () => {
		const { model, blockedModel, approvalModel, sessionsService } = createModel();
		const s1 = new TestSession('s1');
		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Terminal, new Date(1000), 'tool-call-1'));
		blockedModel.setBlocked([needsInput(s1)]);
		sessionsService.setVisible([s1]);
		sessionsService.setVisible([]);

		approvalModel.setApproval(s1.resource, undefined);
		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Terminal, new Date(2000), 'tool-call-1'));
		const afterReload = blockedIds(model);
		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Terminal, new Date(3000), 'tool-call-2'));

		assert.deepStrictEqual({ afterReload, afterNewApproval: blockedIds(model) }, { afterReload: [], afterNewApproval: ['s1'] });
	});

	test('does not blink when an announced approval reloads as the same request', () => {
		// The approval model clears the pending approval while its chat model
		// reloads, then restores the same id. The pill is already showing that
		// request, so the gap must not flash again.
		const { model, blockedModel, approvalModel } = createModel();
		const s1 = new TestSession('s1');
		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Terminal, new Date(1000), 'tool-call-1'));
		blockedModel.setBlocked([needsInput(s1)]);
		assert.strictEqual(model.consumePendingBlink(), true);

		approvalModel.setApproval(s1.resource, undefined);
		const duringReload = { blocked: blockedIds(model), blink: model.consumePendingBlink() };
		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Terminal, new Date(2000), 'tool-call-1'));

		assert.deepStrictEqual({
			duringReload,
			afterReload: {
				blocked: blockedIds(model),
				kind: model.requiresInputKind.get(),
				blink: model.consumePendingBlink(),
			},
		}, {
			duringReload: { blocked: ['s1'], blink: false },
			afterReload: { blocked: ['s1'], kind: RequiresInputKind.TerminalApproval, blink: false },
		});
	});

	test('ignoring an approval reload does not ignore the next approval', () => {
		// Ignore records whatever occurrence is current. During the reload gap
		// that has to stay the approval that just dropped out, or the next one
		// is treated as detail of a generic NeedsInput and swallowed.
		const { model, blockedModel, approvalModel } = createModel();
		const same = new TestSession('same');
		const next = new TestSession('next');
		approvalModel.setApproval(same.resource, approval(AgentSessionApprovalKind.Terminal, new Date(1000), 'tool-call-1'));
		approvalModel.setApproval(next.resource, approval(AgentSessionApprovalKind.Terminal, new Date(1000), 'tool-call-1'));
		blockedModel.setBlocked([needsInput(same), needsInput(next)]);
		model.consumePendingBlink();

		approvalModel.setApproval(same.resource, undefined);
		approvalModel.setApproval(next.resource, undefined);
		model.ignoreSession(same as unknown as ISession);
		model.ignoreSession(next as unknown as ISession);
		approvalModel.setApproval(same.resource, approval(AgentSessionApprovalKind.Terminal, new Date(2000), 'tool-call-1'));
		const sameApproval = { blocked: blockedIds(model), blink: model.consumePendingBlink() };

		approvalModel.setApproval(next.resource, approval(AgentSessionApprovalKind.Question, new Date(3000), 'tool-call-2'));

		assert.deepStrictEqual({
			sameApproval,
			nextApproval: { blocked: blockedIds(model), blink: model.consumePendingBlink() },
		}, {
			sameApproval: { blocked: [], blink: false },
			nextApproval: { blocked: ['next'], blink: true },
		});
	});

	test('blinks again when an additional, not-yet-visible session becomes blocked', () => {
		const { model, blockedModel } = createModel();
		const s1 = new TestSession('s1');
		const s2 = new TestSession('s2');
		blockedModel.setBlocked([needsInput(s1)]);
		assert.strictEqual(model.consumePendingBlink(), true);
		blockedModel.setBlocked([needsInput(s1), needsInput(s2)]);
		assert.strictEqual(model.consumePendingBlink(), true);
	});

	test('does not blink when a queued block becomes visible before the blink plays', () => {
		// Simulates a blink queued while the pill is suppressed (e.g. the transient
		// "Approved N sessions" state): if the session becomes visible before the pill
		// shows, the queued blink must not fire on the later render.
		const { model, blockedModel, sessionsService } = createModel();
		const s1 = new TestSession('s1');
		blockedModel.setBlocked([needsInput(s1)]);
		// Blink is queued but NOT consumed yet (pill suppressed); the session then
		// becomes visible before the pill renders.
		sessionsService.setVisible([s1]);
		assert.strictEqual(model.consumePendingBlink(), false);
	});

	test('does not blink when a queued block becomes visible then remains acknowledged', () => {
		const { model, blockedModel, sessionsService } = createModel();
		const s1 = new TestSession('s1');
		blockedModel.setBlocked([needsInput(s1)]);
		sessionsService.setVisible([s1]);
		sessionsService.setVisible([]);
		assert.deepStrictEqual({ blocked: blockedIds(model), blink: model.consumePendingBlink() }, { blocked: [], blink: false });
	});

	test('does not blink when a queued block unblocks before the blink plays', () => {
		const { model, blockedModel } = createModel();
		const s1 = new TestSession('s1');
		blockedModel.setBlocked([needsInput(s1)]);
		// The session stops being blocked before the queued blink is consumed.
		blockedModel.setBlocked([]);
		assert.strictEqual(model.consumePendingBlink(), false);
	});

	test('consumePendingBlink clears the pending blink', () => {
		const { model, blockedModel } = createModel();
		blockedModel.setBlocked([needsInput(new TestSession('s1'))]);
		assert.deepStrictEqual([model.consumePendingBlink(), model.consumePendingBlink()], [true, false]);
	});

	test('reports a homogeneous requires-input kind', () => {
		const { model, blockedModel, approvalModel } = createModel();
		const s1 = new TestSession('s1');
		const s2 = new TestSession('s2');
		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Terminal));
		approvalModel.setApproval(s2.resource, approval(AgentSessionApprovalKind.Terminal));
		blockedModel.setBlocked([needsInput(s1), needsInput(s2)]);
		assert.strictEqual(model.requiresInputKind.get(), RequiresInputKind.TerminalApproval);
	});

	test('reports no kind for a mix of reasons', () => {
		const { model, blockedModel, approvalModel } = createModel();
		const s1 = new TestSession('s1');
		const s2 = new TestSession('s2');
		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Terminal));
		approvalModel.setApproval(s2.resource, approval(AgentSessionApprovalKind.Question));
		blockedModel.setBlocked([needsInput(s1), needsInput(s2)]);
		assert.strictEqual(model.requiresInputKind.get(), undefined);
	});

	test('classifies failing-CI reason', () => {
		const { model, blockedModel } = createModel();
		const ci = new TestSession('ci');
		blockedModel.setBlocked([failingCI(ci)]);
		assert.strictEqual(model.requiresInputKind.get(), RequiresInputKind.FailingCI);
	});

	test('builds the requires-input label per kind and count', () => {
		const { model } = createModel();
		assert.deepStrictEqual({
			terminalOne: model.getRequiresInputLabel(1, RequiresInputKind.TerminalApproval),
			terminalMany: model.getRequiresInputLabel(3, RequiresInputKind.TerminalApproval),
			questionOne: model.getRequiresInputLabel(1, RequiresInputKind.Question),
			failingCIMany: model.getRequiresInputLabel(2, RequiresInputKind.FailingCI),
			genericOne: model.getRequiresInputLabel(1, undefined),
			genericMany: model.getRequiresInputLabel(4, undefined),
		}, {
			terminalOne: '1 session requires terminal approval',
			terminalMany: '3 sessions require terminal approval',
			questionOne: '1 session has a question',
			failingCIMany: '2 sessions are failing CI',
			genericOne: '1 session requires input',
			genericMany: '4 sessions require input',
		});
	});

	test('dismissing an approval hides the session until a distinct approval appears', () => {
		const { model, blockedModel, approvalModel } = createModel();
		const s1 = new TestSession('s1');
		const first = approval(AgentSessionApprovalKind.Terminal, new Date(1000));
		approvalModel.setApproval(s1.resource, first);
		blockedModel.setBlocked([needsInput(s1)]);
		assert.deepStrictEqual(blockedIds(model), ['s1']);

		// The user allows the pending approval — the session drops out immediately.
		model.dismissApproval({ session: s1 as unknown as ISession, approvalId: agentSessionApprovalId(first) });
		assert.deepStrictEqual(blockedIds(model), []);

		// A new, distinct approval re-surfaces the session.
		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Terminal, new Date(2000)));
		assert.deepStrictEqual(blockedIds(model), ['s1']);
	});

	test('ignores the current input-needed occurrence until the session blocks again', () => {
		const { model, blockedModel } = createModel();
		const s1 = new TestSession('s1');
		blockedModel.setBlocked([needsInput(s1)]);
		model.ignoreSession(s1 as unknown as ISession);
		assert.deepStrictEqual(blockedIds(model), []);

		blockedModel.setBlocked([]);
		blockedModel.setBlocked([needsInput(s1)]);
		assert.deepStrictEqual(blockedIds(model), ['s1']);
	});

	test('ignores only the current CI failure occurrence', () => {
		const { model, blockedModel } = createModel();
		const s1 = new TestSession('s1');
		blockedModel.setBlocked([failingCI(s1, 'sha1')]);
		model.ignoreSession(s1 as unknown as ISession);
		assert.deepStrictEqual(blockedIds(model), []);

		blockedModel.setBlocked([failingCI(s1, 'sha2')]);
		assert.deepStrictEqual(blockedIds(model), ['s1']);
	});

	test('keeps an ignored CI failure ignored when the session drops out of the blocked set', () => {
		// The raw blocked set drops a session whenever its pull request / CI data is
		// momentarily unavailable (e.g. while those models reload). Nothing changed
		// about the failure, so the acknowledgement must survive that gap.
		const { model, blockedModel } = createModel();
		const s1 = new TestSession('s1');
		blockedModel.setBlocked([failingCI(s1, 'sha1')]);
		model.ignoreSession(s1 as unknown as ISession);

		blockedModel.setBlocked([]);
		blockedModel.setBlocked([failingCI(s1, 'sha1')]);

		assert.deepStrictEqual(blockedIds(model), []);
	});

	test('plays a not-yet-consumed CI blink once when the same failure returns from a data gap', () => {
		// The first blink has not played yet. The reload must not eat it, and the
		// return must not queue a second copy.
		const { model, blockedModel } = createModel();
		const ci = new TestSession('ci');
		blockedModel.setBlocked([failingCI(ci, 'sha1')]);
		blockedModel.setBlocked([]);
		blockedModel.setBlocked([failingCI(ci, 'sha1')]);

		assert.deepStrictEqual([model.consumePendingBlink(), model.consumePendingBlink()], [true, false]);
	});

	test('does not blink again when the same CI failure returns after a data gap', () => {
		// The pill is already showing this commit. A pull-request or CI reload drops
		// the session out of the raw set and then reports the same commit again.
		// That return is not a new failure, so it must not play another attention blink.
		// A later commit still does.
		const { model, blockedModel } = createModel();
		const ci = new TestSession('ci');
		blockedModel.setBlocked([failingCI(ci, 'sha1')]);
		assert.strictEqual(model.consumePendingBlink(), true);

		blockedModel.setBlocked([]);
		blockedModel.setBlocked([failingCI(ci, 'sha1')]);
		const sameCommit = { blocked: blockedIds(model), blink: model.consumePendingBlink() };

		blockedModel.setBlocked([failingCI(ci, 'sha2')]);
		const newCommit = { blocked: blockedIds(model), blink: model.consumePendingBlink() };

		assert.deepStrictEqual({ sameCommit, newCommit }, {
			sameCommit: { blocked: ['ci'], blink: false },
			newCommit: { blocked: ['ci'], blink: true },
		});
	});

	test('does not blink the same CI failure when needs-input gives the blocked set back', () => {
		// NeedsInput replaces the single block reason, so the CI occurrence leaves
		// the raw set without a data gap. The input request blinks. The same commit
		// afterwards does not. A new commit does.
		const { model, blockedModel } = createModel();
		const s1 = new TestSession('s1');
		blockedModel.setBlocked([failingCI(s1, 'sha1')]);
		assert.strictEqual(model.consumePendingBlink(), true);

		blockedModel.setBlocked([needsInput(s1)]);
		const inputBlink = model.consumePendingBlink();
		blockedModel.setBlocked([failingCI(s1, 'sha1')]);
		const sameCommit = { blocked: blockedIds(model), blink: model.consumePendingBlink() };
		blockedModel.setBlocked([failingCI(s1, 'sha2')]);

		assert.deepStrictEqual({
			inputBlink,
			sameCommit,
			newCommit: { blocked: blockedIds(model), blink: model.consumePendingBlink() },
		}, {
			inputBlink: true,
			sameCommit: { blocked: ['s1'], blink: false },
			newCommit: { blocked: ['s1'], blink: true },
		});
	});

	test('blinks when needs-input returns after the session was not blocked', () => {
		// Unlike a CI commit, a needs-input stretch has no identity once it ends.
		// The next one is a new request and blinks.
		const { model, blockedModel } = createModel();
		const s1 = new TestSession('s1');
		blockedModel.setBlocked([needsInput(s1)]);
		assert.strictEqual(model.consumePendingBlink(), true);
		blockedModel.setBlocked([]);
		blockedModel.setBlocked([needsInput(s1)]);
		assert.strictEqual(model.consumePendingBlink(), true);
	});

	test('keeps an ignored CI failure ignored when input needed interrupts the same commit', () => {
		// NeedsInput replaces the single blocked reason, so the CI occurrence leaves
		// the raw set without the session becoming unblocked. The same commit must
		// stay dismissed; the input request itself still surfaces.
		const { model, blockedModel, approvalModel } = createModel();
		const s1 = new TestSession('s1');
		blockedModel.setBlocked([failingCI(s1, 'sha1')]);
		model.ignoreSession(s1 as unknown as ISession);
		model.consumePendingBlink();

		blockedModel.setBlocked([needsInput(s1)]);
		const duringInput = blockedIds(model);
		const inputBlink = model.consumePendingBlink();

		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Question, new Date(1000), 'q-1'));
		approvalModel.setApproval(s1.resource, approval(AgentSessionApprovalKind.Question, new Date(2000), 'q-2'));
		const laterApproval = blockedIds(model);

		blockedModel.setBlocked([failingCI(s1, 'sha1')]);
		const sameCommit = { blocked: blockedIds(model), blink: model.consumePendingBlink() };
		blockedModel.setBlocked([failingCI(s1, 'sha2')]);

		assert.deepStrictEqual({
			duringInput,
			inputBlink,
			laterApproval,
			sameCommit,
			newCommit: blockedIds(model),
		}, {
			duringInput: ['s1'],
			inputBlink: true,
			laterApproval: ['s1'],
			sameCommit: { blocked: [], blink: false },
			newCommit: ['s1'],
		});
	});

	test('viewing or ignoring the interrupting input keeps the same CI failure dismissed', () => {
		const { model, blockedModel, sessionsService } = createModel();
		const viewed = new TestSession('viewed');
		const ignored = new TestSession('ignored');
		blockedModel.setBlocked([failingCI(viewed, 'sha1'), failingCI(ignored, 'sha1')]);
		model.ignoreAllSessions();

		blockedModel.setBlocked([needsInput(viewed), needsInput(ignored)]);
		sessionsService.setVisible([viewed]);
		sessionsService.setVisible([]);
		model.ignoreSession(ignored as unknown as ISession);
		const inputSettled = blockedIds(model);

		blockedModel.setBlocked([failingCI(viewed, 'sha1'), failingCI(ignored, 'sha1')]);

		assert.deepStrictEqual({ inputSettled, sameCommit: blockedIds(model) }, {
			inputSettled: [],
			sameCommit: [],
		});
	});

	test('ignores all currently surfaced blocked sessions', () => {
		const { model, blockedModel } = createModel();
		const input = new TestSession('input');
		const ci = new TestSession('ci');
		blockedModel.setBlocked([needsInput(input), failingCI(ci, 'sha1')]);
		model.ignoreAllSessions();
		const ignored = blockedIds(model);

		blockedModel.setBlocked([]);
		blockedModel.setBlocked([needsInput(input), failingCI(ci, 'sha2')]);

		assert.deepStrictEqual({ ignored, afterNewOccurrences: blockedIds(model) }, { ignored: [], afterNewOccurrences: ['input', 'ci'] });
	});

	test('reports nothing and never blinks when disabled (stable quality)', () => {
		const { model, blockedModel } = createModel({ quality: 'stable' });
		blockedModel.setBlocked([needsInput(new TestSession('s1'))]);
		assert.deepStrictEqual({ blocked: blockedIds(model), blink: model.consumePendingBlink() }, { blocked: [], blink: false });
	});
});

function needsInput(session: TestSession): IBlockedSession {
	return { session: session as unknown as ISession, reason: BlockedSessionReason.NeedsInput, occurrenceId: BlockedSessionReason.NeedsInput };
}

function failingCI(session: TestSession, headSha: string = 'sha'): IBlockedSession {
	return { session: session as unknown as ISession, reason: BlockedSessionReason.FailingCI, occurrenceId: `${BlockedSessionReason.FailingCI}:${headSha}` };
}

function approval(kind: AgentSessionApprovalKind, since: Date = new Date(), approvalId: string = `${kind}:${since.getTime()}`): IAgentSessionApprovalInfo {
	return { approvalId, kind, label: 'npm run build', languageId: undefined, since, confirm: () => { } };
}

class TestSession {
	readonly resource: URI;
	readonly chats: IObservable<readonly { readonly resource: URI }[]>;

	constructor(readonly sessionId: string) {
		this.resource = URI.parse(`test-session:/${sessionId}`);
		this.chats = constObservable([{ resource: this.resource }]);
	}
}

class TestBlockedSessions {
	readonly blockedSessionsWithReasons = observableValue<readonly IBlockedSession[]>('withReasons', []);
	readonly blockedSessions = observableValue<readonly ISession[]>('blocked', []);

	setBlocked(blocked: readonly IBlockedSession[]): void {
		transaction(tx => {
			this.blockedSessionsWithReasons.set(blocked, tx);
			this.blockedSessions.set(blocked.map(entry => entry.session), tx);
		});
	}
}

class TestApprovalModel {
	private readonly _approvals = new Map<string, ISettableObservable<IAgentSessionApprovalInfo | undefined>>();

	getApproval(resource: URI): IObservable<IAgentSessionApprovalInfo | undefined> {
		return this._obs(resource.toString());
	}

	setApproval(resource: URI, info: IAgentSessionApprovalInfo | undefined): void {
		this._obs(resource.toString()).set(info, undefined);
	}

	private _obs(key: string): ISettableObservable<IAgentSessionApprovalInfo | undefined> {
		let obs = this._approvals.get(key);
		if (!obs) {
			obs = observableValue<IAgentSessionApprovalInfo | undefined>(`approval.${key}`, undefined);
			this._approvals.set(key, obs);
		}
		return obs;
	}
}

class TestCIFixModel {
	readonly hiddenSessions = observableValue<ReadonlySet<string>>('ciFixHidden', new Set());

	setHidden(sessionIds: readonly string[]): void {
		this.hiddenSessions.set(new Set(sessionIds), undefined);
	}
}

class TestSessionsService {
	readonly visibleSessions = observableValue<readonly (IActiveSession | undefined)[]>('visible', []);

	setVisible(sessions: readonly TestSession[]): void {
		this.visibleSessions.set(sessions as unknown as readonly IActiveSession[], undefined);
	}
}
