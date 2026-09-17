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
const ADAPTER_REL = 'src/vs/workbench/contrib/debug/browser/debugAdapterManager.ts';
const BREAKPOINT_EDITOR_REL = 'src/vs/workbench/contrib/debug/browser/breakpointEditorContribution.ts';
const DISASSEMBLY_REL = 'src/vs/workbench/contrib/debug/browser/disassemblyView.ts';
const MODEL_REL = 'src/vs/workbench/contrib/debug/common/debugModel.ts';
const VARIABLES_REL = 'src/vs/workbench/contrib/debug/browser/variablesView.ts';
const WATCH_REL = 'src/vs/workbench/contrib/debug/browser/watchExpressionsView.ts';
const CALLSTACK_REL = 'src/vs/workbench/contrib/debug/browser/callStackView.ts';
const HOVER_REL = 'src/vs/workbench/contrib/debug/browser/debugHover.ts';
const REPL_REL = 'src/vs/workbench/contrib/debug/browser/repl.ts';
const COMMANDS_REL = 'src/vs/workbench/contrib/debug/browser/debugCommands.ts';
const SESSION_REL = 'src/vs/workbench/contrib/debug/browser/debugSession.ts';
const A11Y_REL = 'src/vs/workbench/contrib/debug/browser/runAndDebugAccessibilityHelp.ts';
const PICKER_REL = 'src/vs/workbench/contrib/debug/browser/debugSessionPicker.ts';
const QUICK_REL = 'src/vs/workbench/contrib/debug/browser/debugQuickAccess.ts';
const CONSOLE_REL = 'src/vs/workbench/contrib/debug/browser/debugConsoleQuickAccess.ts';
const LINK_REL = 'src/vs/workbench/contrib/debug/browser/linkDetector.ts';
const CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const RAW_REL = 'src/vs/workbench/contrib/debug/browser/rawDebugSession.ts';
const TERMINALS_REL = 'src/vs/workbench/contrib/debug/node/terminals.ts';
const EDITOR_ACTIONS_REL = 'src/vs/workbench/contrib/debug/browser/debugEditorActions.ts';
const BREAKPOINT_WIDGET_REL = 'src/vs/workbench/contrib/debug/browser/breakpointWidget.ts';
const BREAKPOINTS_VIEW_REL = 'src/vs/workbench/contrib/debug/browser/breakpointsView.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/common/lifecycle.ts';
const TREE_REL = 'src/vs/base/browser/ui/tree/asyncDataTree.ts';
const DEBUG_IFACE_REL = 'src/vs/workbench/contrib/debug/common/debug.ts';
const COMMANDS_IFACE_REL = 'src/vs/platform/commands/common/commands.ts';

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

function assertDoubleChain(source: string, call: string, count: number): void {
	assert.strictEqual((source.match(new RegExp(call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, count, `count mismatch: ${call}`);
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`), `single-chain remains: ${call}`);
}

function countDouble(rel: string, call: string): number {
	const source = fs.readFileSync(resolveSource(rel), 'utf8');
	return (source.match(new RegExp(`${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${doubleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

suite('debug leftover Promise fire-and-forget catch scan (D744)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers thirty-eight leftover Promise double-chain sites; D686/D688/D690/D662 stay skipped', () => {
		const whenThen = `this.lifecycleService.when(LifecyclePhase.Eventually)
			.then(() => this.debugExtensionsAvailable.set(this.debuggers.length > 0))`;
		const scrollUp = `this.scrollUp_LoadDisassembledInstructions(DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD).then((loaded) => {
					if (loaded > 0) {
						this._disassembledInstructions!.reveal(prevTop + loaded, 0);
					}
				}).finally(() => { this._loadingLock = false; })`;
		const fetch19 = `thread.fetchCallStack(19).then(() => {
									const stale = thread.getStaleCallStack();
									const current = thread.getCallStack();
									let bottomOfCallStackChanged = stale.length !== current.length;
									for (let i = 1; i < stale.length && !bottomOfCallStackChanged; i++) {
										bottomOfCallStackChanged = !stale[i].equals(current[i]);
									}

									if (bottomOfCallStackChanged) {
										this._onDidChangeCallStack.fire();
									}
								}).finally(() => {
									deferred.complete();
									this.schedulers.delete(thread.getId());
								})`;
		const loadThen = `this.loadDisassembledInstructions(instructionReference, offset, -DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD * 4, DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD * 8).then(() => {`;
		const hoverThen = `this.tree.setInput(expression).finally(() => {
				this.isUpdatingTree = false;
			})`;
		const sites =
			countDouble(ADAPTER_REL, whenThen) +
			countDouble(ADAPTER_REL, "void this.commandService.executeCommand('debug.installAdditionalDebuggers', languageLabel)") +
			countDouble(BREAKPOINT_EDITOR_REL, 'desiredCandidatePositions.then(v => activeCodeEditor.changeDecorations(d => setCandidateDecorations(d, v)))') +
			countDouble(DISASSEMBLY_REL, scrollUp) +
			countDouble(DISASSEMBLY_REL, 'this.scrollDown_LoadDisassembledInstructions(DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD).finally(() => { this._loadingLock = false; })') +
			countDouble(DISASSEMBLY_REL, 'void this.goToInstructionAndOffset(stackFrame.instructionPointerReference, 0)') +
			(fs.readFileSync(resolveSource(DISASSEMBLY_REL), 'utf8').includes(`${loadThen}`) && fs.readFileSync(resolveSource(DISASSEMBLY_REL), 'utf8').includes(`this._loadingLock = false;\n\t\t})${doubleCatch};`) ? 1 : 0) +
			countDouble(MODEL_REL, fetch19) +
			countDouble(VARIABLES_REL, 'void this.tree.setInput(this.debugService.getViewModel().focusedStackFrame ?? null)') +
			countDouble(VARIABLES_REL, 'void this.tree.updateChildren()') +
			countDouble(VARIABLES_REL, 'void tree.updateChildren(parent, false, false)') +
			countDouble(WATCH_REL, 'void this.tree.updateChildren()') +
			countDouble(WATCH_REL, 'void this.tree.setInput(this.debugService)') +
			countDouble(CALLSTACK_REL, 'void this.tree.setInput(this.debugService.getModel())') +
			countDouble(CALLSTACK_REL, 'void this.debugService.focusStackFrame(stackFrame, thread, session, { ...options, ...{ explicit: true } })') +
			countDouble(CALLSTACK_REL, 'void this.tree.updateChildren()') +
			countDouble(HOVER_REL, hoverThen) +
			countDouble(REPL_REL, 'void this.tree.updateChildren(undefined, true, false)') +
			countDouble(COMMANDS_REL, 'void debugService.focusStackFrame(nextVisibleFrame, undefined, undefined, { preserveFocus: false })') +
			countDouble(COMMANDS_REL, 'void debugService.focusStackFrame(thread.getTopStackFrame(), undefined, undefined, { preserveFocus: false })') +
			countDouble(COMMANDS_REL, 'void debugService.startDebugging(pick.launch, pick.config, { noDebug: debugStartOptions?.noDebug, startedByUser: true })') +
			countDouble(SESSION_REL, 'void this.debugService.focusStackFrame(undefined, toFocusThread)') +
			countDouble(SESSION_REL, 'void this.debugService.focusStackFrame(undefined)') +
			countDouble(SESSION_REL, 'void this.debugService.focusStackFrame(undefined, undefined, viewModel.focusedSession, { explicit: false })') +
			countDouble(SESSION_REL, 'void this.debugService.focusStackFrame(undefined, undefined)') +
			countDouble(A11Y_REL, "void this._commandService.executeCommand('workbench.debug.action.focusWatchView')") +
			countDouble(A11Y_REL, "void this._commandService.executeCommand('workbench.debug.action.focusVariablesView')") +
			countDouble(A11Y_REL, "void this._commandService.executeCommand('workbench.debug.action.focusCallStackView')") +
			countDouble(A11Y_REL, "void this._commandService.executeCommand('workbench.debug.action.focusBreakpointsView')") +
			countDouble(A11Y_REL, "void this._commandService.executeCommand('workbench.view.debug')") +
			countDouble(PICKER_REL, 'void commandService.executeCommand(selectAndStartID)') +
			countDouble(PICKER_REL, 'void debugService.focusStackFrame(undefined, undefined, session, { explicit: true })') +
			countDouble(QUICK_REL, 'void this.debugService.startDebugging(pick.launch, pick.config, { startedByUser: true })') +
			countDouble(QUICK_REL, 'void this.commandService.executeCommand(ADD_CONFIGURATION_ID, launch.uri.toString())') +
			countDouble(CONSOLE_REL, 'void this._commandService.executeCommand(SELECT_AND_START_ID)') +
			countDouble(CONSOLE_REL, 'void this._debugService.focusStackFrame(undefined, undefined, session, { explicit: true })');
		assert.strictEqual(sites, 38);
	});

	test('adapter leftover when(Eventually).then / executeCommand are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(ADAPTER_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_IFACE_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'when(phase: LifecyclePhase): Promise<void>;');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const whenThen = `this.lifecycleService.when(LifecyclePhase.Eventually)
			.then(() => this.debugExtensionsAvailable.set(this.debuggers.length > 0))`;
		assert.ok(source.includes(`${whenThen}${doubleCatch};`));
		assertDoubleChain(source, "void this.commandService.executeCommand('debug.installAdditionalDebuggers', languageLabel)", 1);
	});

	test('breakpointEditor leftover desiredCandidatePositions.then is Promise double-chain; runTo stays D662', () => {
		const source = fs.readFileSync(resolveSource(BREAKPOINT_EDITOR_REL), 'utf8');
		assertDoubleChain(source, 'desiredCandidatePositions.then(v => activeCodeEditor.changeDecorations(d => setCandidateDecorations(d, v)))', 1);
		assert.ok(source.includes(`run: () => this.debugService.runTo(uri, lineNumber)${doubleCatch}`));
	});

	test('disassembly leftover scroll/load/goTo are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(DISASSEMBLY_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async scrollUp_LoadDisassembledInstructions(instructionCount: number): Promise<number> {'));
		assert.ok(source.includes('private async scrollDown_LoadDisassembledInstructions(instructionCount: number): Promise<number> {'));
		assert.ok(source.includes('async goToInstructionAndOffset(instructionReference: string, offset: number, focus?: boolean)'));
		assert.ok(source.includes('private async loadDisassembledInstructions(instructionReference: string, offset: number, instructionOffset: number, instructionCount: number): Promise<number> {'));
		assertDoubleChain(source, `this.scrollUp_LoadDisassembledInstructions(DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD).then((loaded) => {
					if (loaded > 0) {
						this._disassembledInstructions!.reveal(prevTop + loaded, 0);
					}
				}).finally(() => { this._loadingLock = false; })`, 1);
		assertDoubleChain(source, 'this.scrollDown_LoadDisassembledInstructions(DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD).finally(() => { this._loadingLock = false; })', 1);
		assertDoubleChain(source, 'void this.goToInstructionAndOffset(stackFrame.instructionPointerReference, 0)', 1);
		assert.ok(source.includes(`this.loadDisassembledInstructions(instructionReference, offset, -DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD * 4, DisassemblyView.NUM_INSTRUCTIONS_TO_LOAD * 8).then(() => {`));
		assert.ok(source.includes(`this._loadingLock = false;\n\t\t})${doubleCatch};`));
		assert.ok(!source.includes(`this._loadingLock = false;\n\t\t});`));
	});

	test('debugModel leftover fetchCallStack(19).then.finally is Promise double-chain; assigned / two-arg stay skipped', () => {
		const source = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleChain(source, `thread.fetchCallStack(19).then(() => {
									const stale = thread.getStaleCallStack();
									const current = thread.getCallStack();
									let bottomOfCallStackChanged = stale.length !== current.length;
									for (let i = 1; i < stale.length && !bottomOfCallStackChanged; i++) {
										bottomOfCallStackChanged = !stale[i].equals(current[i]);
									}

									if (bottomOfCallStackChanged) {
										this._onDidChangeCallStack.fire();
									}
								}).finally(() => {
									deferred.complete();
									this.schedulers.delete(thread.getId());
								})`, 1);
		assert.ok(source.includes('this.scopes = this.thread.session.scopes(this.frameId, this.thread.threadId).then(response => {'));
		assert.ok(!source.includes(`this.scopes = this.thread.session.scopes(this.frameId, this.thread.threadId).then(response => {${doubleCatch}`));
		assert.ok(source.includes('entry.completeDeferred.p.then(c, e);'));
		assert.ok(!source.includes(`entry.completeDeferred.p.then(c, e)${doubleCatch}`));
	});

	test('tree leftover setInput / updateChildren are Promise double-chain', () => {
		const variables = fs.readFileSync(resolveSource(VARIABLES_REL), 'utf8');
		const watch = fs.readFileSync(resolveSource(WATCH_REL), 'utf8');
		const callStack = fs.readFileSync(resolveSource(CALLSTACK_REL), 'utf8');
		const hover = fs.readFileSync(resolveSource(HOVER_REL), 'utf8');
		const repl = fs.readFileSync(resolveSource(REPL_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		assertPromiseSignature(tree, 'async setInput(input: TInput, viewState?: IAsyncDataTreeViewState): Promise<void> {');
		assertPromiseSignature(tree, 'async updateChildren(element: TInput | T = this.root.element, recursive = true, rerender = false, options?: IAsyncDataTreeUpdateChildrenOptions<T>): Promise<void> {');
		assertDoubleChain(variables, 'void this.tree.setInput(this.debugService.getViewModel().focusedStackFrame ?? null)', 1);
		assertDoubleChain(variables, 'void this.tree.updateChildren()', 1);
		assertDoubleChain(variables, 'void tree.updateChildren(parent, false, false)', 1);
		assertDoubleChain(watch, 'void this.tree.updateChildren()', 2);
		assertDoubleChain(watch, 'void this.tree.setInput(this.debugService)', 1);
		assertDoubleChain(callStack, 'void this.tree.setInput(this.debugService.getModel())', 1);
		assertDoubleChain(callStack, 'void this.tree.updateChildren()', 1);
		assertDoubleChain(hover, `this.tree.setInput(expression).finally(() => {
				this.isUpdatingTree = false;
			})`, 1);
		assertDoubleChain(repl, 'void this.tree.updateChildren(undefined, true, false)', 1);
	});

	test('focusStackFrame / startDebugging leftover FOFs are Promise double-chain', () => {
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const session = fs.readFileSync(resolveSource(SESSION_REL), 'utf8');
		const callStack = fs.readFileSync(resolveSource(CALLSTACK_REL), 'utf8');
		const picker = fs.readFileSync(resolveSource(PICKER_REL), 'utf8');
		const quick = fs.readFileSync(resolveSource(QUICK_REL), 'utf8');
		const consoleQa = fs.readFileSync(resolveSource(CONSOLE_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(DEBUG_IFACE_REL), 'utf8');
		assertPromiseSignature(iface, 'focusStackFrame(focusedStackFrame: IStackFrame | undefined, thread?: IThread, session?: IDebugSession, options?: { explicit?: boolean; preserveFocus?: boolean; sideBySide?: boolean; pinned?: boolean }): Promise<void>;');
		assertPromiseSignature(iface, 'startDebugging(launch: ILaunch | undefined, configOrName?: IConfig | string, options?: IDebugSessionOptions, saveBeforeStart?: boolean): Promise<boolean>;');
		assertDoubleChain(commands, 'void debugService.focusStackFrame(nextVisibleFrame, undefined, undefined, { preserveFocus: false })', 2);
		assertDoubleChain(commands, 'void debugService.focusStackFrame(thread.getTopStackFrame(), undefined, undefined, { preserveFocus: false })', 1);
		assertDoubleChain(commands, 'void debugService.startDebugging(pick.launch, pick.config, { noDebug: debugStartOptions?.noDebug, startedByUser: true })', 1);
		assertDoubleChain(session, 'void this.debugService.focusStackFrame(undefined, toFocusThread)', 1);
		assertDoubleChain(session, 'void this.debugService.focusStackFrame(undefined)', 1);
		assertDoubleChain(session, 'void this.debugService.focusStackFrame(undefined, undefined, viewModel.focusedSession, { explicit: false })', 1);
		assertDoubleChain(session, 'void this.debugService.focusStackFrame(undefined, undefined)', 1);
		assertDoubleChain(callStack, 'void this.debugService.focusStackFrame(stackFrame, thread, session, { ...options, ...{ explicit: true } })', 1);
		assertDoubleChain(picker, 'void debugService.focusStackFrame(undefined, undefined, session, { explicit: true })', 1);
		assertDoubleChain(quick, 'void this.debugService.startDebugging(pick.launch, pick.config, { startedByUser: true })', 1);
		assertDoubleChain(consoleQa, 'void this._debugService.focusStackFrame(undefined, undefined, session, { explicit: true })', 1);
	});

	test('leftover executeCommand FOFs are Promise double-chain; Action2.run Promise.all stays skipped', () => {
		const a11y = fs.readFileSync(resolveSource(A11Y_REL), 'utf8');
		const picker = fs.readFileSync(resolveSource(PICKER_REL), 'utf8');
		const quick = fs.readFileSync(resolveSource(QUICK_REL), 'utf8');
		const consoleQa = fs.readFileSync(resolveSource(CONSOLE_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		assertDoubleChain(a11y, "void this._commandService.executeCommand('workbench.debug.action.focusWatchView')", 1);
		assertDoubleChain(a11y, "void this._commandService.executeCommand('workbench.debug.action.focusVariablesView')", 1);
		assertDoubleChain(a11y, "void this._commandService.executeCommand('workbench.debug.action.focusCallStackView')", 1);
		assertDoubleChain(a11y, "void this._commandService.executeCommand('workbench.debug.action.focusBreakpointsView')", 1);
		assertDoubleChain(a11y, "void this._commandService.executeCommand('workbench.view.debug')", 1);
		assertDoubleChain(picker, 'void commandService.executeCommand(selectAndStartID)', 1);
		assertDoubleChain(quick, 'void this.commandService.executeCommand(ADD_CONFIGURATION_ID, launch.uri.toString())', 1);
		assertDoubleChain(consoleQa, 'void this._commandService.executeCommand(SELECT_AND_START_ID)', 1);
		assert.ok(commands.includes('Promise.all(promises).then(() => disposables.dispose());'));
		assert.ok(!commands.includes(`Promise.all(promises).then(() => disposables.dispose())${doubleCatch}`));
	});

	test('opener / D145 / Connect / Watch / Resolve / Pty / two-arg then / assigned then / Action2.run / invented proto / already-double stay skipped', () => {
		const link = fs.readFileSync(resolveSource(LINK_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const raw = fs.readFileSync(resolveSource(RAW_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const terminals = fs.readFileSync(resolveSource(TERMINALS_REL), 'utf8');
		const editorActions = fs.readFileSync(resolveSource(EDITOR_ACTIONS_REL), 'utf8');
		const breakpointWidget = fs.readFileSync(resolveSource(BREAKPOINT_WIDGET_REL), 'utf8');
		const breakpointsView = fs.readFileSync(resolveSource(BREAKPOINTS_VIEW_REL), 'utf8');
		const picker = fs.readFileSync(resolveSource(PICKER_REL), 'utf8');
		const consoleQa = fs.readFileSync(resolveSource(CONSOLE_REL), 'utf8');
		assert.ok(link.includes('this.openerService.open(url, { allowTunneling:'));
		assert.ok(!link.includes(`this.openerService.open(url, { allowTunneling:${doubleCatch}`));
		assert.ok(link.includes('this.editorService.openEditor({ resource: uri, options: { ...options, preserveFocus } })'));
		assert.ok(!link.includes(`this.editorService.openEditor({ resource: uri, options: { ...options, preserveFocus } })${doubleCatch}`));
		assert.ok(editorActions.includes('editorService.openEditor(DisassemblyViewInput.instance, { pinned: true, revealIfOpened: true });'));
		assert.ok(!editorActions.includes(`editorService.openEditor(DisassemblyViewInput.instance, { pinned: true, revealIfOpened: true })${doubleCatch}`));
		assert.ok(config.includes('this.remoteAgentService.getEnvironment().then(environment => {'));
		assert.ok(config.includes('}, () => {'));
		assert.ok(!config.includes(`this.remoteAgentService.getEnvironment().then(environment => {${doubleCatch}`));
		assert.ok(raw.includes('.then(undefined, err => Promise.reject(this.handleErrorResponse(err, showErrors)));'));
		assert.ok(model.includes('topCallStack = thread.fetchCallStack(1).then(() => {'));
		assert.ok(!model.includes(`topCallStack = thread.fetchCallStack(1).then(() => {${doubleCatch}`));
		assert.ok(terminals.includes("return spawnAsPromised('/usr/bin/pgrep'"));
		assert.ok(breakpointWidget.includes('this.textModelService.createModelReference(bp.uri).then(ref => {'));
		assert.ok(breakpointWidget.includes('}).catch(() => {'));
		assert.ok(breakpointsView.includes('this.textModelService.createModelReference(breakpoint.uri).then(reference => {'));
		assert.ok(breakpointsView.includes('}).catch(() => {'));
		assert.ok(picker.includes('viewsService.openView(REPL_VIEW_ID, true);'));
		assert.ok(!picker.includes(`viewsService.openView(REPL_VIEW_ID, true)${doubleCatch}`));
		assert.ok(consoleQa.includes('this._viewsService.openView(REPL_VIEW_ID, true);'));
		assert.ok(!consoleQa.includes(`this._viewsService.openView(REPL_VIEW_ID, true)${doubleCatch}`));
		for (const source of [link, config, raw, model, terminals, editorActions, breakpointWidget, breakpointsView]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
