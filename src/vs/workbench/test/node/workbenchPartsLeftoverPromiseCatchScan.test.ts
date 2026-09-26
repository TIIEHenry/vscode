/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const GLOBAL_BAR_REL = 'src/vs/workbench/browser/parts/globalCompositeBar.ts';
const VIEW_PANE_REL = 'src/vs/workbench/browser/parts/views/viewPaneContainer.ts';
const PANE_BAR_REL = 'src/vs/workbench/browser/parts/paneCompositeBar.ts';
const LAYOUT_REL = 'src/vs/workbench/browser/layout.ts';
const MENUBAR_REL = 'src/vs/workbench/browser/parts/titlebar/menubarControl.ts';
const TREE_VIEW_REL = 'src/vs/workbench/browser/parts/views/treeView.ts';
const EDITOR_STATUS_REL = 'src/vs/workbench/browser/parts/editor/editorStatus.ts';
const PANE_PART_REL = 'src/vs/workbench/browser/parts/paneCompositePart.ts';
const COMPOSITE_BAR_REL = 'src/vs/workbench/browser/parts/compositeBar.ts';
const BREADCRUMBS_REL = 'src/vs/workbench/browser/parts/editor/breadcrumbsModel.ts';
const WINDOW_REL = 'src/vs/workbench/electron-browser/window.ts';
const BROWSER_WINDOW_REL = 'src/vs/workbench/browser/window.ts';
const CONTRIBUTIONS_REL = 'src/vs/workbench/common/contributions.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const AUX_WINDOW_REL = 'src/vs/workbench/services/auxiliaryWindow/browser/auxiliaryWindowService.ts';
const WORKSPACES_REL = 'src/vs/platform/workspaces/common/workspaces.ts';
const ASYNC_TREE_REL = 'src/vs/base/browser/ui/tree/asyncDataTree.ts';
const LANG_DETECT_REL = 'src/vs/workbench/services/languageDetection/common/languageDetectionWorkerService.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const TOASTS_REL = 'src/vs/workbench/browser/parts/notifications/notificationsToasts.ts';
const EDITOR_PARTS_REL = 'src/vs/workbench/browser/parts/editor/editorParts.ts';
const CONTEXTKEYS_REL = 'src/vs/workbench/browser/contextkeys.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../', rel),
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

function assertDoubleThen(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch};`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('workbench parts leftover Promise fire-and-forget catch scan (D706)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const globalBar = fs.readFileSync(resolveSource(GLOBAL_BAR_REL), 'utf8');
		const viewPane = fs.readFileSync(resolveSource(VIEW_PANE_REL), 'utf8');
		const paneBar = fs.readFileSync(resolveSource(PANE_BAR_REL), 'utf8');
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const menubar = fs.readFileSync(resolveSource(MENUBAR_REL), 'utf8');
		const treeView = fs.readFileSync(resolveSource(TREE_VIEW_REL), 'utf8');
		const editorStatus = fs.readFileSync(resolveSource(EDITOR_STATUS_REL), 'utf8');
		const calls = [
			[globalBar, `this.extensionService.whenInstalledExtensionsRegistered().then(() => {
			if (!this._store.isDisposed) {
				this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, AccountsActivityActionViewItem.ACCOUNTS_VISIBILITY_PREFERENCE_KEY, this._store)(() => this.toggleAccountsActivity()));
			}
		})`],
			[viewPane, `this.extensionService.whenInstalledExtensionsRegistered().then(() => {
			this.areExtensionsReady = true;
			if (this.panes.length) {
				this.updateTitleArea();
				this.updateViewHeaders();
			}
			this._register(this.configurationService.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_LOCATION)) {
					this.updateViewHeaders();
				}
			}));
		})`],
			[paneBar, `this.extensionService.whenInstalledExtensionsRegistered().then(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.onDidRegisterExtensions();
			this._register(this.compositeBar.onDidChange(() => {
				this.updateCompositeBarItemsFromStorage(true);
				this.saveCachedViewContainers();
			}));
			this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, this.options.pinnedViewContainersKey, this._store)(() => this.updateCompositeBarItemsFromStorage(false)));
		})`],
			[layout, 'window.whenStylesHaveLoaded.then(() => this.containerStylesLoaded.delete(windowId))'],
			[menubar, `this.workspacesService.getRecentlyOpened().then(recentlyOpened => {
				if (generation !== this._recentlyOpenedGeneration || this._store.isDisposed) {
					return;
				}
				this.recentlyOpened = recentlyOpened;
				this.updateMenubar();
			})`],
			[menubar, `this.workspacesService.getRecentlyOpened().then((recentlyOpened) => {
			this.recentlyOpened = recentlyOpened;
		})`],
			[treeView, 'this.tree.setInput(this.root).then(() => this.updateContentAreas())'],
			[editorStatus, `languageDetectionService.detectLanguage(resource).then(detectedLanguageId => {
							const chosenLanguageId = languageService.getLanguageIdByLanguageName(pick.label) || 'unknown';
							if (detectedLanguageId === currentLanguageId && currentLanguageId !== chosenLanguageId) {
								// If they didn't choose the detected language (which should also be the active language if automatic detection is enabled)
								// then the automatic language detection was likely wrong and the user is correcting it. In this case, we want telemetry.
								// Keep track of what model was preferred and length of input to help track down potential differences between the result quality across models and content size.
								const modelPreference = configurationService.getValue<boolean>('workbench.editor.preferHistoryBasedLanguageDetection') ? 'history' : 'classic';
								telemetryService.publicLog2<IAutomaticLanguageDetectionLikelyWrongData, AutomaticLanguageDetectionLikelyWrongClassification>(AutomaticLanguageDetectionLikelyWrongId, {
									currentLanguageId: currentLanguageName ?? 'unknown',
									nextLanguageId: pick.label,
									lineCount: textModel?.getLineCount() ?? -1,
									modelPreference,
								});
							}
						})`],
		] as const;
		assert.strictEqual(calls.length, 8);
		for (const [source, call] of calls) {
			assertDoubleThen(source, call);
		}
	});

	test('parts leftover whenInstalledExtensionsRegistered thens are Promise double-chain', () => {
		const globalBar = fs.readFileSync(resolveSource(GLOBAL_BAR_REL), 'utf8');
		const viewPane = fs.readFileSync(resolveSource(VIEW_PANE_REL), 'utf8');
		const paneBar = fs.readFileSync(resolveSource(PANE_BAR_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assert.ok(globalBar.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(viewPane.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(paneBar.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(globalBar, `this.extensionService.whenInstalledExtensionsRegistered().then(() => {
			if (!this._store.isDisposed) {
				this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, AccountsActivityActionViewItem.ACCOUNTS_VISIBILITY_PREFERENCE_KEY, this._store)(() => this.toggleAccountsActivity()));
			}
		})`);
		assertDoubleThen(viewPane, `this.extensionService.whenInstalledExtensionsRegistered().then(() => {
			this.areExtensionsReady = true;
			if (this.panes.length) {
				this.updateTitleArea();
				this.updateViewHeaders();
			}
			this._register(this.configurationService.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration(LayoutSettings.ACTIVITY_BAR_LOCATION)) {
					this.updateViewHeaders();
				}
			}));
		})`);
		assertDoubleThen(paneBar, `this.extensionService.whenInstalledExtensionsRegistered().then(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.onDidRegisterExtensions();
			this._register(this.compositeBar.onDidChange(() => {
				this.updateCompositeBarItemsFromStorage(true);
				this.saveCachedViewContainers();
			}));
			this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, this.options.pinnedViewContainersKey, this._store)(() => this.updateCompositeBarItemsFromStorage(false)));
		})`);
	});

	test('layout leftover whenStylesHaveLoaded then is Promise double-chain; D697 whenRestored stays', () => {
		const source = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const aux = fs.readFileSync(resolveSource(AUX_WINDOW_REL), 'utf8');
		assertPromiseSignature(aux, 'readonly whenStylesHaveLoaded: Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../base/common/errors.js';"));
		assertDoubleThen(source, 'window.whenStylesHaveLoaded.then(() => this.containerStylesLoaded.delete(windowId))');
		assertDoubleThen(source, 'this.editorGroupService.whenRestored.then(() => this.centerMainEditorLayout(this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED), skipLayout))');
	});

	test('menubar leftover getRecentlyOpened thens are Promise double-chain; D714 alwaysUnderlineAccessKeys stays chained', () => {
		const source = fs.readFileSync(resolveSource(MENUBAR_REL), 'utf8');
		const workspaces = fs.readFileSync(resolveSource(WORKSPACES_REL), 'utf8');
		assertPromiseSignature(workspaces, 'getRecentlyOpened(): Promise<IRecentlyOpened>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, `this.workspacesService.getRecentlyOpened().then(recentlyOpened => {
				if (generation !== this._recentlyOpenedGeneration || this._store.isDisposed) {
					return;
				}
				this.recentlyOpened = recentlyOpened;
				this.updateMenubar();
			})`);
		assertDoubleThen(source, `this.workspacesService.getRecentlyOpened().then((recentlyOpened) => {
			this.recentlyOpened = recentlyOpened;
		})`);
		assertDoubleThen(source, `this.accessibilityService.alwaysUnderlineAccessKeys().then(val => {
				this.alwaysOnMnemonics = val;
				this.menubar?.update(this.getMenuBarOptions());
			})`);
	});

	test('treeView leftover setInput then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(TREE_VIEW_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(ASYNC_TREE_REL), 'utf8');
		assertPromiseSignature(tree, 'async setInput(input: TInput, viewState?: IAsyncDataTreeViewState): Promise<void> {');
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.tree.setInput(this.root).then(() => this.updateContentAreas())');
	});

	test('editorStatus leftover detectLanguage then is Promise double-chain; await detectLanguage stays skipped', () => {
		const source = fs.readFileSync(resolveSource(EDITOR_STATUS_REL), 'utf8');
		const lang = fs.readFileSync(resolveSource(LANG_DETECT_REL), 'utf8');
		assertPromiseSignature(lang, 'detectLanguage(resource: URI, supportedLangs?: string[]): Promise<string | undefined>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, `languageDetectionService.detectLanguage(resource).then(detectedLanguageId => {
							const chosenLanguageId = languageService.getLanguageIdByLanguageName(pick.label) || 'unknown';
							if (detectedLanguageId === currentLanguageId && currentLanguageId !== chosenLanguageId) {
								// If they didn't choose the detected language (which should also be the active language if automatic detection is enabled)
								// then the automatic language detection was likely wrong and the user is correcting it. In this case, we want telemetry.
								// Keep track of what model was preferred and length of input to help track down potential differences between the result quality across models and content size.
								const modelPreference = configurationService.getValue<boolean>('workbench.editor.preferHistoryBasedLanguageDetection') ? 'history' : 'classic';
								telemetryService.publicLog2<IAutomaticLanguageDetectionLikelyWrongData, AutomaticLanguageDetectionLikelyWrongClassification>(AutomaticLanguageDetectionLikelyWrongId, {
									currentLanguageId: currentLanguageName ?? 'unknown',
									nextLanguageId: pick.label,
									lineCount: textModel?.getLineCount() ?? -1,
									modelPreference,
								});
							}
						})`);
		assert.ok(source.includes('detectedLanguage = await languageDetectionService.detectLanguage(resource);'));
		assert.ok(!source.includes('await languageDetectionService.detectLanguage(resource).catch'));
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / D697 chrome / contributions instantiate-by-phase stay skipped', () => {
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		const breadcrumbs = fs.readFileSync(resolveSource(BREADCRUMBS_REL), 'utf8');
		const nativeWindow = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const browserWindow = fs.readFileSync(resolveSource(BROWSER_WINDOW_REL), 'utf8');
		const contributions = fs.readFileSync(resolveSource(CONTRIBUTIONS_REL), 'utf8');
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const toasts = fs.readFileSync(resolveSource(TOASTS_REL), 'utf8');
		const editorParts = fs.readFileSync(resolveSource(EDITOR_PARTS_REL), 'utf8');
		const contextkeys = fs.readFileSync(resolveSource(CONTEXTKEYS_REL), 'utf8');
		const paneBar = fs.readFileSync(resolveSource(PANE_BAR_REL), 'utf8');

		assert.ok(nativeWindow.includes('this.handleWarnings().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(!nativeWindow.includes('this.handleWarnings();'));
		assert.ok(nativeWindow.includes('this.setupOpenHandlers();'));
		assert.ok(nativeWindow.includes('this.openerService.open('));
		assert.ok(!/this\.openerService\.open\([^)]*\)\.catch\(onUnexpectedError\)/.test(nativeWindow));

		assert.ok(browserWindow.includes('this.setupOpenHandlers();'));
		assert.ok(browserWindow.includes(')).then(async () => {'));
		assert.ok(!browserWindow.includes('onUnexpectedError'));

		assertDoubleThen(panePart, 'this.openPaneComposite(currentContainer.id, true)');
		assertDoubleThen(panePart, `this.openPaneComposite(newContainer.id, true).then(composite => {
									composite?.openView(viewToMove.id, true);
								})`);
		assertDoubleThen(compositeBar, 'this.openComposite(currentContainer.id, true)');
		assertDoubleThen(compositeBar, `this.openComposite(newContainer.id, true).then(composite => {
					composite?.openView(viewToMove.id, true);
				})`);
		assertDoubleThen(paneBar, `case 'focus':
						this.paneCompositePart.openPaneComposite(this.compositeBarActionItem.id, focus)`);

		assert.ok(breadcrumbs.includes('}).catch(err => {'));
		assert.ok(breadcrumbs.includes('onUnexpectedError(err);'));
		assert.ok(!breadcrumbs.includes(`${doubleCatch}`));

		assert.ok(contributions.includes('lifecycleService.when(phase).then(() => this.doInstantiateByPhase(instantiationService, logService, environmentService, phase));'));
		assert.ok(!contributions.includes('lifecycleService.when(phase).then(() => this.doInstantiateByPhase(instantiationService, logService, environmentService, phase)).catch'));

		assert.ok(editorParts.includes('void editorPart.activeGroup.openEditor(defaultInput).catch(onUnexpectedError).catch(onUnexpectedError);'));

		assert.ok(toasts.includes(`this.lifecycleService.when(LifecyclePhase.Restored).then(() => {

			// Show toast for initial notifications if any
			this.model.notifications.forEach(notification => this.addToast(notification));

			// Update toasts on notification changes
			this._register(this.model.onDidChangeNotification(e => this.onDidChangeNotification(e)));
		})${doubleCatch};`));
		assert.ok(editorParts.includes(`this.whenReady.then(() => this.registerGroupsContextKeyListeners())${doubleCatch};`));
		assert.ok(contextkeys.includes(`this.editorGroupService.whenReady.then(() => {
			this.updateEditorAreaContextKeys();
			this.updateActiveEditorGroupContextKeys();
			this.updateVisiblePanesContextKeys();
		})${doubleCatch};`));

		for (const source of [layout, panePart, compositeBar, nativeWindow, browserWindow]) {
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
