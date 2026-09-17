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
const RESOLVER_REL = 'src/vs/editor/common/services/resolverService.ts';
const FILES_REL = 'src/vs/platform/files/common/files.ts';
const BREAKPOINTS_VIEW_REL = 'src/vs/workbench/contrib/debug/browser/breakpointsView.ts';
const BREAKPOINT_WIDGET_REL = 'src/vs/workbench/contrib/debug/browser/breakpointWidget.ts';
const CALL_STACK_REL = 'src/vs/workbench/contrib/debug/browser/callStackWidget.ts';
const ADAPTER_REL = 'src/vs/workbench/contrib/debug/browser/debugAdapterManager.ts';
const CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const ACTION_VIEW_REL = 'src/vs/workbench/contrib/debug/browser/debugActionViewItems.ts';
const LINK_REL = 'src/vs/workbench/contrib/debug/browser/linkDetector.ts';
const COMMANDS_REL = 'src/vs/workbench/contrib/debug/browser/debugCommands.ts';
const MODEL_REL = 'src/vs/workbench/contrib/debug/common/debugModel.ts';
const SESSION_REL = 'src/vs/workbench/contrib/debug/browser/debugSession.ts';
const TASK_RUNNER_REL = 'src/vs/workbench/contrib/debug/browser/debugTaskRunner.ts';
const EDITOR_ACTIONS_REL = 'src/vs/workbench/contrib/debug/browser/debugEditorActions.ts';
const RAW_REL = 'src/vs/workbench/contrib/debug/browser/rawDebugSession.ts';
const TERMINALS_REL = 'src/vs/workbench/contrib/debug/node/terminals.ts';

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

function countDouble(rel: string, call: string, catchText = doubleCatch): number {
	const source = fs.readFileSync(resolveSource(rel), 'utf8');
	return (source.match(new RegExp(`${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${catchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

const breakpointsThen = `this.textModelService.createModelReference(breakpoint.uri).then(reference => {
			if (data.context !== breakpoint) {
				reference.dispose();
				return;
			}
			data.elementDisposables.add(reference);
			const model = reference.object.textEditorModel;
			if (model && breakpoint.lineNumber <= model.getLineCount()) {
				const lineContent = model.getLineContent(breakpoint.lineNumber).trim();
				data.name.textContent = lineContent || localize('emptyLine', "(empty line)");
			} else {
				data.name.textContent = localize('lineNotFound', "(line not found)");
			}
		}).catch(() => {
			if (data.context === breakpoint) {
				data.name.textContent = localize('cannotLoadLine', "(cannot load line)");
			}
		})`;

const breakpointWidgetThen = `this.textModelService.createModelReference(bp.uri).then(ref => {
				try {
					breakpointOptions[i + 1].description = ref.object.textEditorModel.getLineContent(bp.lineNumber).trim();
				} finally {
					ref.dispose();
				}
			}).catch(() => {
				breakpointOptions[i + 1].description = nls.localize('noBpSource', 'Could not load source.');
			})`;

const linkStatThen = `this.fileService.stat(uri).then(stat => {
			if (stat.isDirectory) {
				return;
			}
			this.decorateLink(link, uri, fulltext, hoverBehavior, (preserveFocus: boolean) => this.editorService.openEditor({ resource: uri, options: { ...options, preserveFocus } }));
		}).catch(() => {
			// If the uri can not be resolved we should not spam the console with error, remain quite #86587
		})`;

suite('debug leftover Promise fire-and-forget catch scan (D755)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers three leftover Promise double-chain sites after D744; search overflow stays with slot H', () => {
		const sites =
			countDouble(BREAKPOINTS_VIEW_REL, breakpointsThen) +
			countDouble(BREAKPOINT_WIDGET_REL, breakpointWidgetThen) +
			countDouble(LINK_REL, linkStatThen);
		assert.strictEqual(sites, 3);
	});

	test('breakpointsView leftover createModelReference then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(BREAKPOINTS_VIEW_REL), 'utf8');
		const resolver = fs.readFileSync(resolveSource(RESOLVER_REL), 'utf8');
		assertPromiseSignature(resolver, 'createModelReference(resource: URI): Promise<IReference<IResolvedTextEditorModel>>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleChain(source, breakpointsThen, 1);
	});

	test('breakpointWidget leftover createModelReference then is Promise double-chain; assigned suggestionsPromise stays skipped', () => {
		const source = fs.readFileSync(resolveSource(BREAKPOINT_WIDGET_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleChain(source, breakpointWidgetThen, 1);
		assert.ok(source.includes('suggestionsPromise = provideSuggestionItems(this.languageFeaturesService.completionProvider, underlyingModel, new Position(this.lineNumber, 1), new CompletionOptions(undefined, new Set<CompletionItemKind>().add(CompletionItemKind.Snippet)), _context, token).then(suggestions => {'));
		assert.ok(!source.includes(`suggestionsPromise = provideSuggestionItems(this.languageFeaturesService.completionProvider, underlyingModel, new Position(this.lineNumber, 1), new CompletionOptions(undefined, new Set<CompletionItemKind>().add(CompletionItemKind.Snippet)), _context, token).then(suggestions => {${doubleCatch}`));
	});

	test('linkDetector leftover fileService.stat then is Promise double-chain; opener / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(LINK_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		assertPromiseSignature(files, 'stat(resource: URI): Promise<IFileStatWithPartialMetadata>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleChain(source, linkStatThen, 1);
		assert.ok(source.includes('this.openerService.open(url, { allowTunneling:'));
		assert.ok(!source.includes(`this.openerService.open(url, { allowTunneling:${doubleCatch}`));
		assert.ok(source.includes('this.editorService.openEditor({ resource: uri, options: { ...options, preserveFocus } })'));
		assert.ok(!source.includes(`this.editorService.openEditor({ resource: uri, options: { ...options, preserveFocus } })${doubleCatch}`));
	});

	test('already-double D686/D688/D690/D744 leftovers stay skipped; assigned / two-arg / returned stay skipped', () => {
		const adapter = fs.readFileSync(resolveSource(ADAPTER_REL), 'utf8');
		const callStack = fs.readFileSync(resolveSource(CALL_STACK_REL), 'utf8');
		const actionView = fs.readFileSync(resolveSource(ACTION_VIEW_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const session = fs.readFileSync(resolveSource(SESSION_REL), 'utf8');
		const taskRunner = fs.readFileSync(resolveSource(TASK_RUNNER_REL), 'utf8');
		assert.ok(adapter.includes(`this.tasksService.getKnownTasks().then(tasks => {
			this.taskLabels = tasks.map(task => task._label);
			this.updateDebugAdapterSchema();
		})${doubleCatch};`));
		assert.ok(callStack.includes('this.modelService.createModelReference(uri).then(reference => {'));
		assert.ok(callStack.includes(`})${doubleCatch};`));
		assert.ok(actionView.includes(`configManager.getDynamicProviders().then(providers => {
			if (providers.length !== this.providers.length) {
				this.providers = providers;
				this.updateOptions();
			}
		})${doubleCatch};`));
		assert.ok(commands.includes(`session.stepInTargets(frame.frameId).then(targets => {
			qp.busy = false;
			if (targets?.length) {
				qp.items = targets?.map(target => ({ target, label: target.label }));
			} else {
				qp.placeholder = nls.localize('editor.debug.action.stepIntoTargets.none', "No step targets available");
			}
		})${doubleCatch};`));
		assert.ok(commands.includes('Promise.all(promises).then(() => disposables.dispose());'));
		assert.ok(!commands.includes(`Promise.all(promises).then(() => disposables.dispose())${doubleCatch}`));
		assert.ok(config.includes('this.remoteAgentService.getEnvironment().then(environment => {'));
		assert.ok(config.includes('}, () => {'));
		assert.ok(!config.includes(`this.remoteAgentService.getEnvironment().then(environment => {${doubleCatch}`));
		assert.ok(config.includes('picks.push(provider.provideDebugConfigurations!(launch.workspace?.uri, token).then(configurations => configurations.map(config => ({'));
		assert.ok(!config.includes(`picks.push(provider.provideDebugConfigurations!(launch.workspace?.uri, token).then(configurations => configurations.map(config => ({${doubleCatch}`));
		assert.ok(model.includes('topCallStack = thread.fetchCallStack(1).then(() => {'));
		assert.ok(!model.includes(`topCallStack = thread.fetchCallStack(1).then(() => {${doubleCatch}`));
		assert.ok(model.includes('this.scopes = this.thread.session.scopes(this.frameId, this.thread.threadId).then(response => {'));
		assert.ok(!model.includes(`this.scopes = this.thread.session.scopes(this.frameId, this.thread.threadId).then(response => {${doubleCatch}`));
		assert.ok(model.includes('entry.completeDeferred.p.then(c, e);'));
		assert.ok(!model.includes(`entry.completeDeferred.p.then(c, e)${doubleCatch}`));
		assert.ok(session.includes('affectedThreads = this.fetchThreads().then(() => [event.body.threadId]);'));
		assert.ok(!session.includes(`affectedThreads = this.fetchThreads().then(() => [event.body.threadId])${doubleCatch}`));
		assert.ok(taskRunner.includes('const taskDonePromise: Promise<ITaskSummary | null> = this.taskService.getActiveTasks().then(async (tasks): Promise<ITaskSummary | null> => {'));
		assert.ok(taskRunner.includes('taskDonePromise.then(result => {'));
		assert.ok(!taskRunner.includes(`taskDonePromise.then(result => {${doubleCatch}`));
	});

	test('opener / D145 / Connect / Watch / Resolve / Pty / Action2.run / invented proto stay skipped', () => {
		const link = fs.readFileSync(resolveSource(LINK_REL), 'utf8');
		const editorActions = fs.readFileSync(resolveSource(EDITOR_ACTIONS_REL), 'utf8');
		const raw = fs.readFileSync(resolveSource(RAW_REL), 'utf8');
		const terminals = fs.readFileSync(resolveSource(TERMINALS_REL), 'utf8');
		assert.ok(editorActions.includes('editorService.openEditor(DisassemblyViewInput.instance, { pinned: true, revealIfOpened: true });'));
		assert.ok(!editorActions.includes(`editorService.openEditor(DisassemblyViewInput.instance, { pinned: true, revealIfOpened: true })${doubleCatch}`));
		assert.ok(raw.includes('.then(undefined, err => Promise.reject(this.handleErrorResponse(err, showErrors)));'));
		assert.ok(terminals.includes("return spawnAsPromised('/usr/bin/pgrep'"));
		for (const source of [link, editorActions, raw, terminals]) {
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
