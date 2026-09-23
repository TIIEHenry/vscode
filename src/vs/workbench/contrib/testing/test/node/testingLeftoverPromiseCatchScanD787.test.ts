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
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const QUICKINPUT_REL = 'src/vs/platform/quickinput/common/quickInput.ts';
const VIEWS_REL = 'src/vs/workbench/services/views/common/viewsService.ts';
const SERVICE_REL = 'src/vs/workbench/contrib/testing/common/testService.ts';
const CHAT_REL = 'src/vs/workbench/contrib/testing/common/testingChatAgentTool.ts';
const ITEM_REL = 'src/vs/workbench/contrib/testing/common/testItemCollection.ts';
const CONTENT_PROVIDER_REL = 'src/vs/workbench/contrib/testing/common/testingContentProvider.ts';
const COVERAGE_VIEW_REL = 'src/vs/workbench/contrib/testing/browser/testCoverageView.ts';
const COVERAGE_DECORATIONS_REL = 'src/vs/workbench/contrib/testing/browser/codeCoverageDecorations.ts';
const EXPLORER_REL = 'src/vs/workbench/contrib/testing/browser/testingExplorerView.ts';
const DECORATIONS_REL = 'src/vs/workbench/contrib/testing/browser/testingDecorations.ts';
const FILTER_REL = 'src/vs/workbench/contrib/testing/browser/testingExplorerFilter.ts';
const OUTPUT_REL = 'src/vs/workbench/contrib/testing/browser/testResultsView/testResultsOutput.ts';
const PROGRESS_REL = 'src/vs/workbench/contrib/testing/browser/testingProgressUiService.ts';
const FOLLOWUP_REL = 'src/vs/workbench/contrib/testing/browser/testResultsView/testResultsViewContent.ts';
const PEEK_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const ACTIONS_REL = 'src/vs/workbench/contrib/testing/browser/testExplorerActions.ts';
const SCM_VIEW_REL = 'src/vs/workbench/contrib/scm/browser/scmViewService.ts';
const FILES_EXPLORER_REL = 'src/vs/workbench/contrib/files/browser/explorerService.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async ') || signature.includes('PromiseLike'));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

function countWrapped(source: string, call: string): number {
	return (source.match(new RegExp(`${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${doubleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length;
}

const runTestsThenCall = `			}, token).then(() => {
				if (!store.isDisposed) {
					store.add(disposableTimeout(() => onDidTimeout.fire(), 5_000));
				}
			})`;
const filterExecuteCall = 'commandService.executeCommand(TestCommandId.CoverageFilterToTest)';
const revealExecuteCall = `					commandService.executeCommand('vscode.revealTest', e.element.test.item.extId, {
						openToSide: e.sideBySide,
						preserveFocus: true,
					})`;
const explorerRunTestsCall = `			this.testService.runTests({
				group: TestRunProfileBitset.Run,
				tests: toRun.map(t => t.test),
			})`;
const msgQueueCall = `			msgThrottler.queue(() => {
				this.applyResults();
				return timeout(100);
			})`;
const runResolvedCall = `				this.testService.runResolvedTests({
					group: profile.group,
					targets: [{
						profileId: profile.profileId,
						controllerId: profile.controllerId,
						testIds: [test.item.extId]
					}]
				})`;
const updateTriggerCall = `		this._register(input.onInputDidChange(() => updateDelayer.trigger(() => {
			input.addToHistory();
			this.state.setText(input.getValue());
		})`;
const xtermTriggerCall = `		this.xtermLayoutDelayer.trigger(() => {
			const scaled = getXtermScaledDimensions(dom.getWindow(this.container), xterm.getFont(), width, height);
			if (scaled) {
				xterm.resize(scaled.cols, scaled.rows);
			}
		})`;
const openExplorerCall = 'this.viewsService.openView(Testing.ExplorerViewId, false)';
const openResultsCall = 'this.viewsService.openView(Testing.ResultsViewId, false)';
const resolveThenCall = `			r.catch(applyError).then(() => {
				barrier.open();
				this.updateExpandability(internal);
			})`;
const followupPickThenCall = `			}))).then(picked => {
				if (picked?.length) {
					followups[picked[0].index].execute().catch(onUnexpectedError).catch(onUnexpectedError);
				}
			})`;
const followupExecutePickedCall = 'followups[picked[0].index].execute()';
const followupExecuteFuCall = 'fu.execute()';

const d787Calls: Array<[string, string, number]> = [
	[CHAT_REL, runTestsThenCall, 1],
	[COVERAGE_VIEW_REL, filterExecuteCall, 1],
	[EXPLORER_REL, revealExecuteCall, 1],
	[EXPLORER_REL, explorerRunTestsCall, 1],
	[DECORATIONS_REL, msgQueueCall, 1],
	[DECORATIONS_REL, runResolvedCall, 1],
	[FILTER_REL, updateTriggerCall, 1],
	[OUTPUT_REL, xtermTriggerCall, 1],
	[PROGRESS_REL, openExplorerCall, 1],
	[PROGRESS_REL, openResultsCall, 1],
	[ITEM_REL, resolveThenCall, 1],
	[FOLLOWUP_REL, followupPickThenCall, 1],
	[FOLLOWUP_REL, followupExecutePickedCall, 1],
	[FOLLOWUP_REL, followupExecuteFuCall, 1],
];

const overflowForbidden = [
	'/scm/',
	'/files/',
	'/authentication/',
	'/remote/',
	'/workspace/',
	'/telemetry/',
	'/localization/',
	'/github/',
	'/tasks/',
	'/sources/',
	'/chat/',
	'/conversation/',
	'Pty',
];

suite('testing leftover Promise fire-and-forget catch scan (D787)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers fourteen leftover Promise double-chain sites in testing leftover remaining', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d787Calls) {
			assert.ok(rel.startsWith('src/vs/workbench/contrib/testing/'), `site left testing leftover remaining: ${rel}`);
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countWrapped(source, call);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 14);
		assert.ok(sites >= 4);
	});

	test('testing leftover remaining had at least four legal sites so this knife did not overflow into scm/files/authentication/remote/workspace/telemetry/localization/github/tasks/sources/chat/conversation/terminal Pty', () => {
		assert.ok(d787Calls.every(([rel]) => rel.startsWith('src/vs/workbench/contrib/testing/')));
		assert.ok(d787Calls.reduce((n, [, , count]) => n + count, 0) >= 4);
		for (const [rel] of d787Calls) {
			for (const forbidden of overflowForbidden) {
				assert.ok(!rel.includes(forbidden), `overflowed into ${forbidden}: ${rel}`);
			}
		}
		const scm = fs.readFileSync(resolveSource(SCM_VIEW_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_EXPLORER_REL), 'utf8');
		assert.ok(scm.includes(`this.configurationService.updateValue('scm.repositories.selectionMode', selectionMode)${doubleCatch}`));
		assert.ok(files.includes(`void this.onConfigurationUpdated(e)${doubleCatch}`));
	});

	test('leftover runTests then / executeCommand / queue / trigger / openView / followup execute are Promise double-chain', () => {
		const chat = fs.readFileSync(resolveSource(CHAT_REL), 'utf8');
		const coverage = fs.readFileSync(resolveSource(COVERAGE_VIEW_REL), 'utf8');
		const explorer = fs.readFileSync(resolveSource(EXPLORER_REL), 'utf8');
		const decorations = fs.readFileSync(resolveSource(DECORATIONS_REL), 'utf8');
		const filter = fs.readFileSync(resolveSource(FILTER_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const followup = fs.readFileSync(resolveSource(FOLLOWUP_REL), 'utf8');
		const item = fs.readFileSync(resolveSource(ITEM_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		const quickInput = fs.readFileSync(resolveSource(QUICKINPUT_REL), 'utf8');
		assertPromiseSignature(service, 'runTests(req: AmbiguousRunTestsRequest, token?: CancellationToken): Promise<ITestResult>;');
		assertPromiseSignature(service, 'runResolvedTests(req: ResolvedTestRunRequest, token?: CancellationToken): Promise<ITestResult>;');
		assertPromiseSignature(service, 'execute(): Promise<void>;');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assertPromiseSignature(asyncSource, 'queue<T>(promiseFactory: ICancellableTask<Promise<T>>): Promise<T> {');
		assertPromiseSignature(asyncSource, 'trigger(task: ITask<T | Promise<T>>, delay = this.defaultDelay): Promise<T> {');
		assertPromiseSignature(views, 'openView<T extends IView>(id: string, focus?: boolean): Promise<T | null>;');
		assertPromiseSignature(quickInput, 'pick<T extends IQuickPickItem>(picks: Promise<QuickPickInput<T>[]> | QuickPickInput<T>[], options?: Omit<IPickOptions<T>, \'canPickMany\'>, token?: CancellationToken): Promise<T | undefined>;');
		assert.ok(chat.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(coverage.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(explorer.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(decorations.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(filter.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(output.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(progress.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(followup.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(item.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(chat, runTestsThenCall);
		assertWrapped(coverage, filterExecuteCall);
		assertWrapped(explorer, revealExecuteCall);
		assertWrapped(explorer, explorerRunTestsCall);
		assertWrapped(decorations, msgQueueCall);
		assertWrapped(decorations, runResolvedCall);
		assertWrapped(filter, updateTriggerCall);
		assertWrapped(output, xtermTriggerCall);
		assertWrapped(progress, openExplorerCall);
		assertWrapped(progress, openResultsCall);
		assertWrapped(item, resolveThenCall);
		assertWrapped(followup, followupPickThenCall);
		assertWrapped(followup, followupExecutePickedCall);
		assertWrapped(followup, followupExecuteFuCall);
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Connect / Watch / Resolve / Pty / D145 stay skipped', () => {
		const coverage = fs.readFileSync(resolveSource(COVERAGE_VIEW_REL), 'utf8');
		const decorations = fs.readFileSync(resolveSource(DECORATIONS_REL), 'utf8');
		const coverageDecorations = fs.readFileSync(resolveSource(COVERAGE_DECORATIONS_REL), 'utf8');
		const peek = fs.readFileSync(resolveSource(PEEK_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const item = fs.readFileSync(resolveSource(ITEM_REL), 'utf8');
		const content = fs.readFileSync(resolveSource(CONTENT_PROVIDER_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assert.ok(coverage.includes('IOpenerService'));
		assert.ok(!coverage.includes(`openerService.open${doubleCatch}`));
		assert.ok(coverage.includes('editorService.openEditor({'));
		assert.ok(!coverage.includes(`editorService.openEditor({${doubleCatch}`));
		assert.ok(coverage.includes('override run(accessor: ServicesAccessor): void {'));
		assert.ok(coverage.includes(`		}).then(selected => {
			if (coverageService.selected.get() !== coverage) {
				return;
			}
			coverageService.filterToTest.set(selected ? selected.testId : previousSelection, undefined);
		});`));
		assert.ok(!coverage.includes(`		}).then(selected => {
			if (coverageService.selected.get() !== coverage) {
				return;
			}
			coverageService.filterToTest.set(selected ? selected.testId : previousSelection, undefined);
		})${doubleCatch}`));
		assert.ok(coverageDecorations.includes('coverage.detailsForTest(entry.testId, cts.token).then('));
		assert.ok(coverageDecorations.includes('() => { /* ignored */ }'));
		assert.ok(!coverageDecorations.includes(`coverage.detailsForTest(entry.testId, cts.token).then(${doubleCatch}`));
		assert.ok(peek.includes('this.editorService.openEditor({ resource: current.outputUri, options });'));
		assert.ok(!peek.includes(`this.editorService.openEditor({ resource: current.outputUri, options })${doubleCatch}`));
		assert.ok(peek.includes('.catch(err => {'));
		assert.ok(actions.includes('accessor.get(ICommandService).executeCommand(\'vscode.revealTest\', element.test.item.extId, preserveFocus);'));
		assert.ok(!actions.includes(`accessor.get(ICommandService).executeCommand('vscode.revealTest', element.test.item.extId, preserveFocus)${doubleCatch}`));
		assert.ok(decorations.includes('() => this.testService.runTests({ group: bitset, tests: [test] })));'));
		assert.ok(!decorations.includes(`() => this.testService.runTests({ group: bitset, tests: [test] })${doubleCatch}`));
		assert.ok(service.includes('prom = prom.then(() => waitForTestToBeIdle(testService, test));'));
		assert.ok(!service.includes(`prom = prom.then(() => waitForTestToBeIdle(testService, test))${doubleCatch}`));
		assert.ok(item.includes('? r.wait().then(() => this.expandChildren(internal, levels - 1))'));
		assert.ok(!item.includes(`r.wait().then(() => this.expandChildren(internal, levels - 1))${doubleCatch}`));
		assert.ok(content.includes(`task.output.endPromise.then(() => {`));
		assert.ok(content.includes(`${doubleCatch}`));
		assert.ok(coverage.includes(`el.value!.details().then(details => this.updateWithDetails(el, details))${doubleCatch}`));
		for (const source of [coverage, decorations, coverageDecorations, peek, actions, item]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/\bConnect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/\bWatch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/\bResolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/\bPty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
