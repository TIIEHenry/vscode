/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { timeout } from '../../../../../base/common/async.js';
import { KeyCode } from '../../../../../base/common/keyCodes.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getWindow } from '../../../../../base/browser/dom.js';
import { ConversationPart, IConversationLensSlots } from '../../../../browser/parts/conversation/conversationPart.js';
import { TestLayoutService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationLens } from '../../browser/conversationLens.js';
import { stubConversationTimelineLinkServices } from './conversationTimelineLinkTestStubs.js';
import { ILayoutService } from '../../../../../platform/layout/browser/layoutService.js';
import { ConversationStubModel } from '../../browser/conversationStubModel.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import { IConversationReviewNavService } from '../../browser/conversationReviewEntry.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { TestClipboardService } from '../../../../../platform/clipboard/test/common/testClipboardService.js';
import { Event } from '../../../../../base/common/event.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { IWebviewService } from '../../../webview/browser/webview.js';
import { flushConversationLensLayout, installConversationLensResizeObserverHarness } from './conversationLensLayoutHarness.js';
import { PRD020_CONVERSATION_TURN_COUNT, createPrd020ScaleSession } from './conversationPrd020ScaleFixture.js';

const LENS_LAYOUT_WIDTH = 640;
const LENS_LAYOUT_HEIGHT = 480;
const SESSION_ID = 'prd020-scale';
const WARMUP_DISCARDED = 2;
const SAMPLE_COUNT = 11;
const POLL_LIMIT_MS = 1000;
/** Same 16 ms frame fallback the timeline scheduler uses when rAF does not fire. */
const POLL_FRAME_MS = 16;
const PASS_LINE_MS = 200;
const TAIL_NOTE_MS = 400;
const BENCH_DEFINITION = '本机无引擎：Dock 提交 → 探针 user 行，含 16 ms 帧合并；pending 或正式 user 行皆可；1,000 对话回合；p50 ≤ 200 ms；5,000 轨迹不进钟。';

/** Set only after the clocks finish, printed from suiteTeardown. */
let benchStdoutBlock: string | undefined;

suite('PRD-020 turn fixture bench', function () {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	installConversationLensResizeObserverHarness();

	teardown(async () => {
		await flushConversationLensLayout();
	});

	// Print after the test's unexpected-output check. console.log during the
	// test body sets that flag and fails the run before the block is useful.
	suiteTeardown(() => {
		emitBenchStdoutBlock();
	});

	test('PRD-020 turn fixture bench', function () {
		if (!process.env.PRD020_BENCH) {
			this.skip();
		}
		this.timeout(60_000);
		return runPrd020TurnFixtureBench(store);
	});
});

interface IMountedBench {
	readonly lens: ConversationLens;
	readonly slots: IConversationLensSlots;
	readonly stubService: ConversationStubService;
	readonly model: ConversationStubModel;
	readonly layoutReadingColumn: () => void;
}

async function runPrd020TurnFixtureBench(store: ReturnType<typeof ensureNoDisposablesAreLeakedInTestSuite>): Promise<void> {
	const mounted = mountBench(store);
	const { lens, slots, stubService, model, layoutReadingColumn } = mounted;
	injectScaleSession(mounted);
	// First screen is outside the clock. Layout is not called again until the next sample's prelude.
	layoutReadingColumn();
	const timelineClientHeight = slots.timeline.clientHeight;
	assert.ok(timelineClientHeight > 0, 'timeline clientHeight must be non-zero before the clock');
	await waitForUserBody(slots.timeline, 'Stub: prd020-t-0999', 5_000);
	assertScaleReady(model, lens);

	for (let i = 1; i <= WARMUP_DISCARDED; i++) {
		await runDockSample(mounted, `prd020-probe-warmup-${i}`);
	}

	const samplesMs: number[] = [];
	for (let i = 1; i <= SAMPLE_COUNT; i++) {
		samplesMs.push(await runDockSample(mounted, `prd020-probe-main-${i}`));
	}

	const appendUserTurnMs = await runDiagnosticSample(mounted);
	const p50 = percentileLinear(samplesMs, 0.5);
	const p95 = percentileLinear(samplesMs, 0.95);
	const pass = p50 <= PASS_LINE_MS;
	const machine = readMachineFacts();
	const results: Record<string, unknown> = {
		definition: BENCH_DEFINITION,
		head: machine.head,
		uname: machine.uname,
		cpuModel: machine.cpuModel,
		logicalCpuCount: machine.logicalCpuCount,
		worktree: machine.worktree,
		command: process.env.PRD020_BENCH_COMMAND
			?? 'PRD020_BENCH=1 scripts/test.sh --grep \'PRD-020 turn fixture bench\'',
		argv: process.argv,
		engineConnected: stubService.isEngineConnected(),
		roster: stubService.constructor.name,
		timelineClientHeight,
		warmupDiscarded: WARMUP_DISCARDED,
		samplesMs,
		p50,
		p95,
		pass,
		diagnostic: { appendUserTurnMs },
	};
	if (p95 > TAIL_NOTE_MS) {
		results.note = '尾延迟偏高';
	}
	publishBenchResults(results);
	assert.strictEqual(stubService.isEngineConnected(), false);
	assert.strictEqual(stubService.constructor.name, 'ConversationStubService');
	assert.strictEqual(samplesMs.length, SAMPLE_COUNT);
	assert.ok(pass, `p50 ${p50} ms exceeds ${PASS_LINE_MS} ms (p95 ${p95} ms)`);
}

/** Dock submit sample. Returns the main-clock duration. Deletes the probe rows outside the clock. */
async function runDockSample(mounted: IMountedBench, probe: string): Promise<number> {
	const { lens, slots, stubService, model } = mounted;
	assertScaleReady(model, lens);
	// Stick to the bottom before T0. Do not layout the reading column until the probe row is observed.
	lens.timelineTree.scrollToEnd();
	const elapsed = await timeDockSubmit(slots, probe);
	await settleAndDeleteProbe(stubService, model, lens, probe);
	assertScaleReady(model, lens);
	return elapsed;
}

async function runDiagnosticSample(mounted: IMountedBench): Promise<number> {
	const { lens, slots, stubService, model } = mounted;
	const probe = 'prd020-probe-diag-1';
	assertScaleReady(model, lens);
	lens.timelineTree.scrollToEnd();
	const t0 = performance.now();
	const turn = stubService.appendUserTurn(SESSION_ID, probe);
	assert.ok(turn, 'diagnostic appendUserTurn returned no turn');
	const turnId = turn.id;
	const t1 = await pollUserRow(slots.timeline, () => findUserRowByTurnId(slots.timeline, turnId), t0, POLL_LIMIT_MS);
	assert.ok(t1 !== undefined, `fixture: diagnostic user row ${turnId} did not appear within ${POLL_LIMIT_MS} ms`);
	assert.strictEqual(stubService.deleteTurn(SESSION_ID, turnId), true);
	assertScaleReady(model, lens);
	return t1 - t0;
}

/**
 * T0 is performance.now() before Enter.
 * Callers must not layout the reading column until this returns.
 */
async function timeDockSubmit(slots: IConversationLensSlots, probe: string): Promise<number> {
	const textarea = dockTextarea(slots);
	const t0 = performance.now();
	textarea.value = probe;
	dispatchDockKeydown(textarea, KeyCode.Enter);
	const t1 = await pollUserRow(slots.timeline, () => findUserRowByBody(slots.timeline, probe), t0, POLL_LIMIT_MS);
	assert.ok(t1 !== undefined, `fixture: probe user row "${probe}" did not appear within ${POLL_LIMIT_MS} ms`);
	return t1 - t0;
}

async function settleAndDeleteProbe(stubService: ConversationStubService, model: ConversationStubModel, lens: ConversationLens, probe: string): Promise<void> {
	const deadline = performance.now() + 2_000;
	while (performance.now() < deadline) {
		const turns = model.getTurns(SESSION_ID);
		const index = turns.findIndex(turn => turn.kind === 'user' && turn.text === probe);
		const pending = lens.sessionViewLease?.snapshot.localPendingSends.length ?? -1;
		if (index >= 0 && pending === 0 && turns.length === PRD020_CONVERSATION_TURN_COUNT + 2) {
			const echo = turns[index + 1];
			assert.ok(echo && echo.kind === 'assistant', 'fixture: probe user was not followed by the stub echo');
			const userId = turns[index]!.id;
			const echoId = echo.id;
			assert.strictEqual(stubService.deleteTurn(SESSION_ID, userId), true);
			assert.strictEqual(stubService.deleteTurn(SESSION_ID, echoId), true);
			return;
		}
		await timeout(20);
	}
	assert.fail(`fixture: probe "${probe}" did not settle to ${PRD020_CONVERSATION_TURN_COUNT} turns`);
}

function assertScaleReady(model: ConversationStubModel, lens: ConversationLens): void {
	assert.strictEqual(model.getTurns(SESSION_ID).length, PRD020_CONVERSATION_TURN_COUNT);
	assert.strictEqual(lens.sessionViewLease?.sessionId, SESSION_ID);
	assert.strictEqual(lens.sessionViewLease?.snapshot.localPendingSends.length ?? -1, 0);
}

function injectScaleSession(mounted: IMountedBench): void {
	const { stubService, model, lens } = mounted;
	const previous = stubService.getActiveSession();
	const scale = createPrd020ScaleSession(PRD020_CONVERSATION_TURN_COUNT);
	// Keep the seed session so replace does not already activate prd020-scale.
	// switchSession has to change the active id, or the lens never rebinds.
	model.replaceSessionCatalog([previous, scale], previous.id);
	assert.notStrictEqual(stubService.getActiveSessionId(), scale.id);
	stubService.switchSession(scale.id);
	const callback = stubService.createTestFrameSourceCallback();
	callback.refresh(scale.id);
	assert.strictEqual(stubService.getActiveSessionId(), SESSION_ID);
	assert.strictEqual(lens.sessionViewLease?.sessionId, SESSION_ID);
	assert.strictEqual(model.getTurns(SESSION_ID).length, PRD020_CONVERSATION_TURN_COUNT);
	assert.strictEqual(stubService.isEngineConnected(), false);
	assert.strictEqual(stubService.constructor.name, 'ConversationStubService');
}

function findUserRowByBody(root: ParentNode, text: string): HTMLElement | undefined {
	for (const node of root.querySelectorAll<HTMLElement>('.conversation-lens-turn[data-kind="user"]')) {
		const body = node.querySelector('.conversation-lens-turn-body');
		if (body && body.textContent === text) {
			return node;
		}
	}
	return undefined;
}

function findUserRowByTurnId(root: ParentNode, turnId: string): HTMLElement | undefined {
	for (const node of root.querySelectorAll<HTMLElement>('.conversation-lens-turn[data-kind="user"]')) {
		if (node.getAttribute('data-turn-id') === turnId) {
			const body = node.querySelector('.conversation-lens-turn-body');
			if (body) {
				return node;
			}
		}
	}
	return undefined;
}

function pollUserRow(root: HTMLElement, match: () => HTMLElement | undefined, t0: number, limitMs: number): Promise<number | undefined> {
	const win = getWindow(root);
	return new Promise(resolve => {
		let settled = false;
		const pending = new Set<{ cancel(): void }>();
		const arm = (millis: number, fn: () => void) => {
			const handle = timeout(millis);
			pending.add(handle);
			void handle.then(() => {
				pending.delete(handle);
				fn();
			}, () => {
				pending.delete(handle);
			});
		};
		const finish = (value: number | undefined) => {
			if (settled) {
				return;
			}
			settled = true;
			for (const handle of pending) {
				handle.cancel();
			}
			pending.clear();
			resolve(value);
		};
		const check = () => {
			if (settled) {
				return;
			}
			const now = performance.now();
			if (match()) {
				finish(now);
				return;
			}
			if (now - t0 >= limitMs) {
				finish(undefined);
			}
		};
		// Hidden Electron windows deliver a few animation frames, then stall.
		// The timeline scheduler paints on the first of rAF and 16 ms, so the
		// poll has to follow both or later samples sit on the 1000 ms cap.
		const onFrame = () => {
			check();
			if (!settled) {
				win.requestAnimationFrame(onFrame);
			}
		};
		const onFrameTimer = () => {
			check();
			if (!settled) {
				arm(POLL_FRAME_MS, onFrameTimer);
			}
		};
		win.requestAnimationFrame(onFrame);
		arm(POLL_FRAME_MS, onFrameTimer);
		arm(limitMs, () => {
			if (!settled) {
				finish(match() ? performance.now() : undefined);
			}
		});
	});
}

async function waitForUserBody(root: HTMLElement, text: string, limitMs: number): Promise<void> {
	const t0 = performance.now();
	const found = await pollUserRow(root, () => findUserRowByBody(root, text), t0, limitMs);
	assert.ok(found !== undefined, `fixture: first screen did not paint "${text}"`);
}

/** NIST linear interpolation. For 11 samples, p50 is the 6th ordered value. */
function percentileLinear(samples: readonly number[], p: number): number {
	const sorted = [...samples].sort((a, b) => a - b);
	assert.ok(sorted.length > 0);
	if (sorted.length === 1) {
		return sorted[0]!;
	}
	const index = p * (sorted.length - 1);
	const lower = Math.floor(index);
	const upper = Math.ceil(index);
	if (lower === upper) {
		return sorted[lower]!;
	}
	const weight = index - lower;
	return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function dockTextarea(slots: IConversationLensSlots): HTMLTextAreaElement {
	const textarea = (slots.dock.querySelector('textarea.conversation-lens-dock-input')
		?? slots.timeline.querySelector('textarea.conversation-lens-dock-input')) as HTMLTextAreaElement | null;
	assert.ok(textarea, 'dock textarea missing');
	return textarea;
}

function dispatchDockKeydown(textarea: HTMLTextAreaElement, keyCode: KeyCode): void {
	const domKeyCodeByVsCode: Partial<Record<KeyCode, number>> = {
		[KeyCode.Enter]: 13,
		[KeyCode.Escape]: 27,
		[KeyCode.UpArrow]: 38,
		[KeyCode.DownArrow]: 40,
		[KeyCode.Space]: 32,
	};
	const domKeyCode = domKeyCodeByVsCode[keyCode];
	assert.ok(domKeyCode !== undefined, `missing DOM keyCode mapping for ${keyCode}`);
	textarea.dispatchEvent(new KeyboardEvent('keydown', { keyCode: domKeyCode, bubbles: true, cancelable: true }));
}

function readMachineFacts(): { head: string; uname: string; cpuModel: string; logicalCpuCount: number; worktree: boolean } {
	const cwd = process.cwd();
	const git = (args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
	const gitDir = path.resolve(cwd, git(['rev-parse', '--git-dir']));
	const commonDir = path.resolve(cwd, git(['rev-parse', '--git-common-dir']));
	const cpu = os.cpus()[0];
	return {
		head: git(['rev-parse', 'HEAD']),
		uname: execFileSync('uname', ['-srm'], { encoding: 'utf8' }).trim(),
		cpuModel: cpu?.model ?? 'unknown',
		logicalCpuCount: os.cpus().length,
		worktree: gitDir !== commonDir,
	};
}

function publishBenchResults(results: Record<string, unknown>): void {
	const json = `${JSON.stringify(results, null, 2)}\n`;
	benchStdoutBlock = `BEGIN_PRD020_BENCH_JSON\n${json}END_PRD020_BENCH_JSON`;
	const dir = process.env.PRD020_EVIDENCE_DIR;
	if (!dir) {
		return;
	}
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, 'results.json'), json);
	const pass = results.pass === true;
	const note = typeof results.note === 'string' ? results.note : '';
	const readme = `---
title: "PRD-020 turn fixture bench run"
type: progress
status: active
phase: N/A
updated: 2026-10-01
summary: "一次本机 bench 跑次；数字来自同目录 results.json，不是手抄。"
---

# PRD-020 turn fixture bench run

- 命令：\`${String(results.command)}\`
- 机器：${String(results.uname)}；${String(results.cpuModel)}；${String(results.logicalCpuCount)} 逻辑核；worktree=${String(results.worktree)}
- HEAD：\`${String(results.head)}\`
- 通过：${pass ? '是' : '否'}
- 结论：主钟 p50=${String(results.p50)} ms，p95=${String(results.p95)} ms，pass=${String(results.pass)}${note ? `，${note}` : ''}。
`;
	fs.writeFileSync(path.join(dir, 'README.md'), readme);
}

function emitBenchStdoutBlock(): void {
	if (!benchStdoutBlock) {
		return;
	}
	const block = benchStdoutBlock;
	try {
		process.stdout.write(`${block}\n`);
	} catch {
		// Electron renderer stdout is not always the terminal the wrapper tees.
		// console.log during the test body trips the unexpected-output hook.
		console.log(block);
	}
}

function mountBench(store: ReturnType<typeof ensureNoDisposablesAreLeakedInTestSuite>): IMountedBench {
	const instantiationService = workbenchInstantiationService(undefined, store);
	const storageService = store.add(new TestStorageService());
	instantiationService.stub(IStorageService, storageService);
	const stubService = store.add(new ConversationStubService());
	instantiationService.stub(IConversationRosterService, stubService);
	stubConversationTimelineLinkServices(instantiationService);
	instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
	instantiationService.stub(IConversationTimelineRevealService, {
		_serviceBrand: undefined,
		registerLens: () => ({ dispose: () => { } }),
		revealItem: () => { },
		getAccessibleTurnContent: () => undefined,
		focusAccessibleTurn: () => { },
		scrollToFirstPendingConfirmation: () => { },
	});
	instantiationService.stub(IConversationReviewNavService, {
		_serviceBrand: undefined,
		onDidChange: Event.None,
		getReviewNavForSession: () => [],
	});
	instantiationService.stub(IClipboardService, new TestClipboardService());
	instantiationService.stub(ICommandService, new class implements ICommandService {
		declare readonly _serviceBrand: undefined;
		onWillExecuteCommand = Event.None;
		onDidExecuteCommand = Event.None;
		executeCommand() { return Promise.resolve(undefined); }
	}());
	instantiationService.stub(IExtensionService, {
		_serviceBrand: undefined,
		getExtension: () => Promise.resolve(undefined),
	} as unknown as IExtensionService);
	instantiationService.stub(IWebviewService, {
		_serviceBrand: undefined,
		activeWebview: undefined,
		webviews: [],
		onDidChangeActiveWebview: Event.None,
		createWebviewOverlay: () => { throw new Error('not used'); },
		createWebviewElement: () => ({
			mountTo(parent: HTMLElement) {
				const el = document.createElement('div');
				el.setAttribute('data-mermaid-host', 'stub');
				parent.appendChild(el);
			},
			setHtml() { },
			postMessage: () => Promise.resolve(true),
			onDidWheel: Event.None,
			onFatalError: Event.None,
			intrinsicContentSize: observableValue('intrinsicContentSize', undefined),
			dispose() { },
		}),
	} as unknown as IWebviewService);
	instantiationService.stub(IExplorerService, {
		_serviceBrand: undefined,
		select: async () => { },
	} as unknown as IExplorerService);
	instantiationService.stub(ISCMService, {
		_serviceBrand: undefined,
		get repositories() { return []; },
		get repositoryCount() { return 0; },
		onDidAddRepository: Event.None,
		onDidRemoveRepository: Event.None,
		registerSCMProvider: () => { throw new Error('not implemented'); },
		getRepository: () => undefined,
	} as unknown as ISCMService);
	const layoutContainer = document.createElement('div');
	layoutContainer.classList.add('monaco-workbench');
	const parent = document.createElement('div');
	parent.classList.add('part', 'conversation');
	parent.style.width = `${LENS_LAYOUT_WIDTH}px`;
	parent.style.height = `${LENS_LAYOUT_HEIGHT}px`;
	layoutContainer.appendChild(parent);
	document.body.appendChild(layoutContainer);
	store.add(toDisposable(() => layoutContainer.remove()));
	const layoutService = new TestLayoutService();
	layoutService.getContainer = () => layoutContainer;
	instantiationService.stub(ILayoutService, layoutService);
	const part = store.add(instantiationService.createInstance(ConversationPart));
	part.create(parent);
	const partSlots = part.getSlots();
	assert.ok(partSlots);
	const slots: IConversationLensSlots = {
		sessionBar: partSlots.sessionBar,
		timeline: document.createElement('div'),
		dock: document.createElement('div'),
	};
	slots.timeline.classList.add('conversation-timeline', 'part', 'conversation');
	slots.dock.classList.add('conversation-dock');
	parent.appendChild(slots.timeline);
	parent.appendChild(slots.dock);
	part.layout(LENS_LAYOUT_WIDTH, LENS_LAYOUT_HEIGHT, 0, 0);
	const lens = store.add(instantiationService.createInstance(ConversationLens, slots));
	const layoutReadingColumn = () => layoutBenchColumn(lens, slots);
	layoutReadingColumn();
	const contentHost = slots.timeline.querySelector('.conversation-lens-timeline-content') as HTMLElement | null;
	if (contentHost) {
		contentHost.style.display = '';
	}
	layoutReadingColumn();
	const model = stubService.createTestFrameSourceCallback().model;
	return { lens, slots, stubService, model, layoutReadingColumn };
}

function layoutBenchColumn(lens: ConversationLens, slots: IConversationLensSlots): void {
	const readingColumn = slots.timeline.querySelector('.conversation-lens-reading-column') as HTMLElement | null;
	const timelineScroll = slots.timeline.querySelector('.conversation-lens-timeline-scroll') as HTMLElement | null;
	const contentHost = slots.timeline.querySelector('.conversation-lens-timeline-content') as HTMLElement | null;
	const treeContainer = slots.timeline.querySelector('.conversation-timeline-tree') as HTMLElement | null;
	slots.timeline.style.width = `${LENS_LAYOUT_WIDTH}px`;
	slots.timeline.style.height = `${LENS_LAYOUT_HEIGHT}px`;
	slots.timeline.style.minHeight = `${LENS_LAYOUT_HEIGHT}px`;
	if (readingColumn) {
		readingColumn.style.width = `${LENS_LAYOUT_WIDTH}px`;
		readingColumn.style.height = `${LENS_LAYOUT_HEIGHT}px`;
	}
	if (timelineScroll) {
		timelineScroll.style.height = `${LENS_LAYOUT_HEIGHT - 120}px`;
		timelineScroll.style.minHeight = `${LENS_LAYOUT_HEIGHT - 120}px`;
	}
	if (contentHost) {
		contentHost.style.display = '';
		contentHost.style.minHeight = `${LENS_LAYOUT_HEIGHT - 120}px`;
	}
	if (treeContainer) {
		treeContainer.style.height = `${LENS_LAYOUT_HEIGHT - 120}px`;
	}
	if (slots.sessionBar) {
		slots.sessionBar.style.width = `${LENS_LAYOUT_WIDTH}px`;
		slots.sessionBar.style.minWidth = `${LENS_LAYOUT_WIDTH}px`;
	}
	lens.layout(LENS_LAYOUT_HEIGHT - 120, LENS_LAYOUT_WIDTH);
}
