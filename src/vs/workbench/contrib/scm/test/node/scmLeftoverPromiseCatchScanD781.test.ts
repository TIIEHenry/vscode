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
const TREE_REL = 'src/vs/base/browser/ui/tree/asyncDataTree.ts';
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const CONFIG_REL = 'src/vs/platform/configuration/common/configuration.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const QUICKDIFF_REL = 'src/vs/workbench/contrib/scm/browser/quickDiffModel.ts';
const HELP_REL = 'src/vs/workbench/contrib/scm/browser/scmAccessibilityHelp.ts';
const VIEW_SERVICE_REL = 'src/vs/workbench/contrib/scm/browser/scmViewService.ts';
const INPUT_REL = 'src/vs/workbench/contrib/scm/browser/scmInput.ts';
const VIEW_PANE_REL = 'src/vs/workbench/contrib/scm/browser/scmViewPane.ts';
const REPOS_REL = 'src/vs/workbench/contrib/scm/browser/scmRepositoriesViewPane.ts';
const HISTORY_REL = 'src/vs/workbench/contrib/scm/browser/scmHistoryViewPane.ts';
const UTIL_REL = 'src/vs/workbench/contrib/scm/browser/util.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/scm/browser/scm.contribution.ts';
const CHAT_REL = 'src/vs/workbench/contrib/scm/browser/scmHistoryChatContext.ts';
const FILES_EXPLORER_REL = 'src/vs/workbench/contrib/files/browser/explorerService.ts';
const FILES_VIEW_REL = 'src/vs/workbench/contrib/files/browser/views/explorerView.ts';

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
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

function countWrapped(source: string, call: string): number {
	return (source.match(new RegExp(`${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${doubleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length;
}

const diffDelayerCall = `this.setChanges(result.allChanges, result.changes, result.mapChanges, result.versionId);
			})
			`;
const executeScmCall = 'this._commandService.executeCommand(\'workbench.scm\')';
const executeReposCall = 'this._commandService.executeCommand(\'workbench.scm.repositories\')';
const executeHistoryCall = 'this._commandService.executeCommand(\'workbench.scm.history\')';
const executeViewCall = 'this._commandService.executeCommand(\'workbench.view.scm\')';
const selectionModeCall = 'this.configurationService.updateValue(\'scm.repositories.selectionMode\', selectionMode)';
const wordBasedCall = 'this.configurationService.updateValue(\'editor.wordBasedSuggestions\', \'off\', { resource: textModel.uri }, ConfigurationTarget.MEMORY)';
const triggerValidationCall = 'validationDelayer.trigger(validate)';
const visibilityQueueCall = `					this.updateRepositoryCollapseAllContextKeys();
				})`;
const revealQueueCall = `								this.tree.setSelection([resource]);
								this.tree.setFocus([resource]);
								return;
							}
						}
					}
				}))`;
const updateChildrenQueueCall = `					this.updateScmProviderContextKeys();
					this.updateRepositoryCollapseAllContextKeys();
				}))`;
const expandRepoCall = 'this.tree.expand(repository)';
const focusPrevInputCall = 'this.treeOperationSequencer.queue(() => this.focusInput(-1))';
const focusNextInputCall = 'this.treeOperationSequencer.queue(() => this.focusInput(1))';
const focusPrevGroupCall = 'this.treeOperationSequencer.queue(() => this.focusResourceGroup(-1))';
const focusNextGroupCall = 'this.treeOperationSequencer.queue(() => this.focusResourceGroup(1))';
const focusQueueCall = `					this.tree.domFocus();
					resolve();
				}
			});
		})`;
const reposVisibilityCall = `					if (viewState === undefined && explorerEnabledConfig && didFinishLoadingRepositories && this.scmViewService.repositories.length === 1) {
						await this.treeOperationSequencer.queue(() =>
							this.tree.expand(this.scmViewService.repositories[0]));
					}
				}));
			})`;
const updateSelectionCall = 'this.treeOperationSequencer.queue(() => this.updateTreeSelection())';

const d781Calls: Array<[string, string, number]> = [
	[QUICKDIFF_REL, diffDelayerCall, 1],
	[HELP_REL, executeScmCall, 1],
	[HELP_REL, executeReposCall, 1],
	[HELP_REL, executeHistoryCall, 1],
	[HELP_REL, executeViewCall, 1],
	[VIEW_SERVICE_REL, selectionModeCall, 1],
	[INPUT_REL, wordBasedCall, 1],
	[INPUT_REL, triggerValidationCall, 1],
	[VIEW_PANE_REL, visibilityQueueCall, 1],
	[VIEW_PANE_REL, revealQueueCall, 1],
	[VIEW_PANE_REL, updateChildrenQueueCall, 1],
	[VIEW_PANE_REL, expandRepoCall, 1],
	[VIEW_PANE_REL, focusPrevInputCall, 1],
	[VIEW_PANE_REL, focusNextInputCall, 1],
	[VIEW_PANE_REL, focusPrevGroupCall, 1],
	[VIEW_PANE_REL, focusNextGroupCall, 1],
	[VIEW_PANE_REL, focusQueueCall, 1],
	[REPOS_REL, reposVisibilityCall, 1],
	[REPOS_REL, updateSelectionCall, 1],
];

suite('scm leftover Promise fire-and-forget catch scan (D781)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers nineteen leftover Promise double-chain sites in scm leftover remaining', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d781Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countWrapped(source, call);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 19);
		assert.ok(sites >= 4);
	});

	test('scm leftover remaining did not overflow into files leftover remaining', () => {
		const explorer = fs.readFileSync(resolveSource(FILES_EXPLORER_REL), 'utf8');
		const filesView = fs.readFileSync(resolveSource(FILES_VIEW_REL), 'utf8');
		assert.ok(explorer.includes(`void this.onConfigurationUpdated(e)${doubleCatch}`));
		assert.ok(explorer.includes(`void this.view?.setTreeInput()?${doubleCatch}`));
		assert.ok(explorer.includes(`void this.refresh(false)${doubleCatch}`));
		assert.ok(filesView.includes(`void this.refresh(true)${doubleCatch}`));
		assert.ok(filesView.includes(`void this.commandService.executeCommand(NEW_FILE_COMMAND_ID)${doubleCatch}`));
		assert.strictEqual((explorer.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 3);
		assert.strictEqual((filesView.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 3);
	});

	test('leftover _diffDelayer.trigger single-catch / accessibility executeCommand / updateValue / validation trigger are Promise double-chain', () => {
		const quickDiff = fs.readFileSync(resolveSource(QUICKDIFF_REL), 'utf8');
		const help = fs.readFileSync(resolveSource(HELP_REL), 'utf8');
		const viewService = fs.readFileSync(resolveSource(VIEW_SERVICE_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(INPUT_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		assertPromiseSignature(asyncSource, 'trigger(task: ITask<T | Promise<T>>, delay = this.defaultDelay): Promise<T> {');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assertPromiseSignature(config, 'updateValue(key: string, value: unknown): Promise<void>;');
		assert.ok(quickDiff.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(help.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(viewService.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(input.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(quickDiff, diffDelayerCall);
		assert.ok(!quickDiff.includes('.catch(err => onUnexpectedError(err));'));
		assertWrapped(help, executeScmCall);
		assertWrapped(help, executeReposCall);
		assertWrapped(help, executeHistoryCall);
		assertWrapped(help, executeViewCall);
		assertWrapped(viewService, selectionModeCall);
		assertWrapped(input, wordBasedCall);
		assertWrapped(input, triggerValidationCall);
	});

	test('leftover viewPane / repositories queue and expand fire-and-forgets are Promise double-chain', () => {
		const viewPane = fs.readFileSync(resolveSource(VIEW_PANE_REL), 'utf8');
		const repos = fs.readFileSync(resolveSource(REPOS_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		assertPromiseSignature(asyncSource, 'queue<T>(promiseTask: ITask<Promise<T>>): Promise<T> {');
		assertPromiseSignature(asyncSource, 'queue<T>(promiseFactory: ICancellableTask<Promise<T>>): Promise<T> {');
		assertPromiseSignature(tree, 'async expand(element: T, recursive: boolean = false): Promise<boolean> {');
		assert.ok(viewPane.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(repos.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(viewPane, visibilityQueueCall);
		assertWrapped(viewPane, revealQueueCall);
		assertWrapped(viewPane, updateChildrenQueueCall);
		assertWrapped(viewPane, expandRepoCall);
		assertWrapped(viewPane, focusPrevInputCall);
		assertWrapped(viewPane, focusNextInputCall);
		assertWrapped(viewPane, focusPrevGroupCall);
		assertWrapped(viewPane, focusNextGroupCall);
		assertWrapped(viewPane, focusQueueCall);
		assertWrapped(repos, reposVisibilityCall);
		assertWrapped(repos, updateSelectionCall);
		assert.ok(repos.includes('await this.treeOperationSequencer.queue(() => this.updateTreeSelection());'));
		assert.ok(!repos.includes(`await this.treeOperationSequencer.queue(() => this.updateTreeSelection())${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Connect / Watch / Resolve / Pty / D145 stay skipped', () => {
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const util = fs.readFileSync(resolveSource(UTIL_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const chat = fs.readFileSync(resolveSource(CHAT_REL), 'utf8');
		const quickDiff = fs.readFileSync(resolveSource(QUICKDIFF_REL), 'utf8');
		const viewPane = fs.readFileSync(resolveSource(VIEW_PANE_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assert.ok(viewPane.includes('IOpenerService'));
		assert.ok(!viewPane.includes(`openerService.open${doubleCatch}`));
		assert.ok(!viewPane.includes(`this.openerService.open(`));
		assert.ok(viewPane.includes('await e.element.open(!!e.editorOptions.preserveFocus);'));
		assert.ok(!viewPane.includes(`e.element.open(!!e.editorOptions.preserveFocus)${doubleCatch}`));

		assert.ok(history.includes('async runInView(_: ServicesAccessor, view: SCMHistoryViewPane): Promise<void> {'));
		assert.ok(history.includes('\t\tview.refresh();'));
		assert.ok(!history.includes(`view.refresh()${doubleCatch}`));
		assert.ok(history.includes('commandService.executeCommand(\'_workbench.openMultiDiffEditor\', { title, multiDiffSourceUri });'));
		assert.ok(!history.includes(`commandService.executeCommand('_workbench.openMultiDiffEditor', { title, multiDiffSourceUri })${doubleCatch}`));
		assert.ok(history.includes('commandService.executeCommand(actionId, ...args, historyItemRef.id);'));
		assert.ok(!history.includes(`commandService.executeCommand(actionId, ...args, historyItemRef.id)${doubleCatch}`));
		assert.ok(history.includes('void this.refresh()'));
		assert.strictEqual((history.match(/void this\.refresh\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 3);

		assert.ok(util.includes('return this.commandService.executeCommand(this.command.id, ...(this.command.arguments || []));'));
		assert.ok(!util.includes(`return this.commandService.executeCommand(this.command.id, ...(this.command.arguments || []))${doubleCatch}`));
		assert.ok(contrib.includes('return commandService.executeCommand(id, ...(args || []));'));
		assert.ok(!contrib.includes(`return commandService.executeCommand(id, ...(args || []))${doubleCatch}`));
		assert.ok(chat.includes('return this._delayer.trigger(() => {'));
		assert.ok(!chat.includes(`return this._delayer.trigger(() => {${doubleCatch}`));
		assert.ok(quickDiff.includes('this._quickDiffsPromise = this.getOriginalResource().then(async (quickDiffs) => {'));
		assert.ok(!quickDiff.includes(`this._quickDiffsPromise = this.getOriginalResource().then(async (quickDiffs) => {${doubleCatch}`));
		assert.ok(!quickDiff.includes('.then(undefined,'));
		assert.ok(!history.includes('.then(undefined,'));

		for (const source of [history, util, contrib, chat, quickDiff, viewPane]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
