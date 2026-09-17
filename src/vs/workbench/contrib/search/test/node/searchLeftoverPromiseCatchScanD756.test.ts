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
const SEARCH_VIEW_REL = 'src/vs/workbench/contrib/search/browser/searchView.ts';
const SEARCH_FIND_REL = 'src/vs/workbench/contrib/search/browser/searchActionsFind.ts';
const SEARCH_NAV_REL = 'src/vs/workbench/contrib/search/browser/searchActionsNav.ts';
const SEARCH_BASE_REL = 'src/vs/workbench/contrib/search/browser/searchActionsBase.ts';
const SEARCH_MODEL_REL = 'src/vs/workbench/contrib/search/browser/searchTreeModel/searchModel.ts';
const SEARCH_MESSAGE_REL = 'src/vs/workbench/contrib/search/browser/searchMessage.ts';
const DIALOGS_REL = 'src/vs/platform/dialogs/common/dialogs.ts';
const PANE_REL = 'src/vs/workbench/services/panecomposite/browser/panecomposite.ts';
const VIEWS_REL = 'src/vs/workbench/services/views/common/viewsService.ts';

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
const errorsDoubleCatch = '.catch(errors.onUnexpectedError).catch(errors.onUnexpectedError)';

function countIncludes(source: string, needle: string): number {
	return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

suite('Search leftover remaining Promise fire-and-forget catch scan (D756)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers four leftover Promise double-chain sites', () => {
		const view = fs.readFileSync(resolveSource(SEARCH_VIEW_REL), 'utf8');
		const find = fs.readFileSync(resolveSource(SEARCH_FIND_REL), 'utf8');
		const nav = fs.readFileSync(resolveSource(SEARCH_NAV_REL), 'utf8');
		const base = fs.readFileSync(resolveSource(SEARCH_BASE_REL), 'utf8');
		const confirmWrap = `			} else {
				progressComplete();
			}
		})${errorsDoubleCatch};`;
		const paneWrap = `				explorerService.select(uri, true).then(() => explorerView.focus())${doubleCatch};
			}
		})${doubleCatch};`;
		const navWrap = `	openSearchView(viewsService).then(searchView => {
		searchView?.moveFocusToResults();
	})${doubleCatch};`;
		const baseWrap = `				openedView.searchAndReplaceWidget.focus(undefined, updatedText, updatedText);
			}
		})${doubleCatch};`;
		const sites =
			countIncludes(view, confirmWrap) +
			countIncludes(find, paneWrap) +
			countIncludes(nav, navWrap) +
			countIncludes(base, baseWrap);
		assert.ok(sites >= 4, `expected >=4 leftover sites, got ${sites}`);
		assert.strictEqual(sites, 4);
	});

	test('searchView leftover confirm().then is Promise double-chain; return Promise.all / two-arg :1750 / already-double updateFileStats stay skipped', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_VIEW_REL), 'utf8');
		const dialogs = fs.readFileSync(resolveSource(DIALOGS_REL), 'utf8');
		assertPromiseSignature(dialogs, 'confirm(confirmation: IConfirmation): Promise<IConfirmationResult>;');
		assert.ok(source.includes('import * as errors from \'../../../../base/common/errors.js\';'));
		assert.ok(source.includes(`this.dialogService.confirm(confirmation).then(res => {`));
		assert.ok(source.includes(`		})${errorsDoubleCatch};`));
		assert.ok(!source.includes(`			} else {
				progressComplete();
			}
		});`));
		assert.ok(source.includes('return Promise.all(folderQueriesExistP).then(existResults => {'));
		assert.ok(!source.includes(`return Promise.all(folderQueriesExistP).then(existResults => {${errorsDoubleCatch}`));
		assert.ok(source.includes('\t\t\t.then(() => undefined, () => undefined);'));
		assert.ok(!source.includes(`.then(() => undefined, () => undefined)${errorsDoubleCatch}`));
		assert.ok(source.includes(`this.updateFileStats(changedMatches).then(async () => this.refreshTreeController.queue())${errorsDoubleCatch};`));
		assert.ok(source.includes('asyncResults.then((complete) => {'));
		assert.ok(source.includes('\t\t}, (e) => {'));
		assert.ok(!source.includes(`asyncResults.then((complete) => {
			clearTimeout(slowTimer);
			return this.onSearchComplete(progressComplete, undefined, undefined, complete);
		}, (e) => {
			clearTimeout(slowTimer);
			return this.onSearchError(e, progressComplete, undefined, undefined);
		})${errorsDoubleCatch}`));
		assert.ok(source.includes('this.viewModel.searchResult.replaceAll(progressReporter).then(() => {'));
		assert.ok(source.includes('\t\t\t\t}, (error) => {'));
		assert.ok(!source.includes(`this.viewModel.searchResult.replaceAll(progressReporter).then(() => {
					progressComplete();
					const messageEl = this.clearMessage();
					dom.append(messageEl, afterReplaceAllMessage);
					this.reLayout();
				}, (error) => {
					progressComplete();
					errors.isCancellationError(error);
					this.notificationService.error(error);
				})${errorsDoubleCatch}`));
		assert.ok(source.includes('this.validateQuery(query).then(() => {'));
		assert.ok(source.includes('\t\t}, onQueryValidationError);'));
		assert.ok(!source.includes(`}, onQueryValidationError)${errorsDoubleCatch}`));
		assert.ok(source.includes('aiSearchPromise.then((complete) => {'));
		assert.ok(!source.includes(`aiSearchPromise.then((complete) => {
			this.updateSearchResultCount(this.viewModel.searchResult.query?.userDisabledExcludesAndIgnoreFiles, this.viewModel.searchResult.query?.onlyOpenEditors, false);
			return this.onSearchComplete(() => { }, excludePatternText, includePatternText, complete, false, complete.aiKeywords);
		}, (e) => {
			return this.onSearchError(e, () => { }, excludePatternText, includePatternText, undefined, false);
		})${errorsDoubleCatch}`));
		assert.ok(source.includes('return result.asyncResults.then((complete) => {'));
		assert.ok(!source.includes(`return result.asyncResults.then((complete) => {${errorsDoubleCatch}`));
	});

	test('searchActionsFind leftover openPaneComposite.then is Promise double-chain; already-double explorerService.select stays', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_FIND_REL), 'utf8');
		const pane = fs.readFileSync(resolveSource(PANE_REL), 'utf8');
		assertPromiseSignature(pane, 'openPaneComposite(id: string | undefined, viewContainerLocation: ViewContainerLocation, focus?: boolean): Promise<IPaneComposite | undefined>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes(`paneCompositeService.openPaneComposite(VIEWLET_ID_FILES, ViewContainerLocation.Sidebar, false).then((viewlet) => {`));
		assert.ok(source.includes(`		})${doubleCatch};`));
		assert.ok(!source.includes(`				explorerService.select(uri, true).then(() => explorerView.focus())${doubleCatch};
			}
		});`));
		assert.ok(source.includes(`explorerService.select(uri, true).then(() => explorerView.focus())${doubleCatch};`));
		assert.ok(source.includes('const resolvedResources = fileService.resolveAll(resources.map(resource => ({ resource }))).then(results => {'));
		assert.ok(!source.includes(`const resolvedResources = fileService.resolveAll(resources.map(resource => ({ resource }))).then(results => {${doubleCatch}`));
	});

	test('searchActionsNav leftover openSearchView.then is Promise double-chain; returned openSearchView stays skipped', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_NAV_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		const base = fs.readFileSync(resolveSource(SEARCH_BASE_REL), 'utf8');
		assertPromiseSignature(views, 'openView<T extends IView>(id: string, focus?: boolean): Promise<T | null>;');
		assertPromiseSignature(base, 'export function openSearchView(viewsService: IViewsService, focus?: boolean): Promise<SearchView | undefined> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes(`openSearchView(viewsService).then(searchView => {
		searchView?.moveFocusToResults();
	})${doubleCatch};`));
		assert.ok(!source.includes(`openSearchView(viewsService).then(searchView => {
		searchView?.moveFocusToResults();
	});`));
		assert.ok(source.includes('return openSearchView(accessor.get(IViewsService)).then(searchView => searchView?.selectNextMatch());'));
		assert.ok(!source.includes(`return openSearchView(accessor.get(IViewsService)).then(searchView => searchView?.selectNextMatch())${doubleCatch}`));
		assert.ok(source.includes('return openSearchView(accessor.get(IViewsService)).then(searchView => searchView?.selectPreviousMatch());'));
		assert.ok(!source.includes(`return openSearchView(accessor.get(IViewsService)).then(searchView => searchView?.selectPreviousMatch())${doubleCatch}`));
		assert.ok(source.includes('return openSearchView(accessor.get(IViewsService), false).then(openedView => {'));
		assert.ok(!source.includes(`return openSearchView(accessor.get(IViewsService), false).then(openedView => {${doubleCatch}`));
	});

	test('searchActionsBase leftover openSearchView.then is Promise double-chain; returned openView stays skipped', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_BASE_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes(`openSearchView(viewsService, false).then(openedView => {`));
		assert.ok(source.includes(`		})${doubleCatch};`));
		assert.ok(!source.includes(`				openedView.searchAndReplaceWidget.focus(undefined, updatedText, updatedText);
			}
		});`));
		assert.ok(source.includes('return viewsService.openView(VIEW_ID, focus).then(view => (view as SearchView ?? undefined));'));
		assert.ok(!source.includes(`return viewsService.openView(VIEW_ID, focus).then(view => (view as SearchView ?? undefined))${doubleCatch}`));
	});

	test('searchModel already-double _startStreamDelay stays; assigned asyncResults / two-arg then stay skipped', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_MODEL_REL), 'utf8');
		const delayThen = `this._startStreamDelay.then(() => {
					if (targetQueue.length) {
						this._searchResult.add(targetQueue, searchInstanceID, ai, !ai);
						targetQueue.length = 0;
					}
				})`;
		assert.ok(source.includes(`${delayThen}${errorsDoubleCatch};`));
		assert.ok(source.includes('asyncResults: asyncResults.then('));
		assert.ok(!source.includes(`asyncResults: asyncResults.then(${errorsDoubleCatch}`));
		assert.ok(source.includes('\t\t\t}).then('));
		assert.ok(!source.includes(`}).then(${errorsDoubleCatch}`));
	});

	test('opener / Action2.run / Connect / Watch / Resolve / Pty / D145 stay skipped', () => {
		const view = fs.readFileSync(resolveSource(SEARCH_VIEW_REL), 'utf8');
		const find = fs.readFileSync(resolveSource(SEARCH_FIND_REL), 'utf8');
		const nav = fs.readFileSync(resolveSource(SEARCH_NAV_REL), 'utf8');
		const base = fs.readFileSync(resolveSource(SEARCH_BASE_REL), 'utf8');
		const message = fs.readFileSync(resolveSource(SEARCH_MESSAGE_REL), 'utf8');
		assert.ok(message.includes('openerService.open(parsed);'));
		assert.ok(!message.includes('openerService.open(parsed).catch'));
		assert.ok(nav.includes('override async run(accessor: ServicesAccessor): Promise<any> {\n\t\tfocusSearchListCommand(accessor);\n\t}'));
		assert.ok(!nav.includes(`focusSearchListCommand(accessor)${doubleCatch}`));
		assert.ok(find.includes('override async run(accessor: ServicesAccessor, args: any): Promise<any> {'));
		assert.ok(!find.includes(`override async run(accessor: ServicesAccessor, args: any): Promise<any> {${doubleCatch}`));
		for (const source of [view, find, nav, base, message]) {
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
		}
	});
});
