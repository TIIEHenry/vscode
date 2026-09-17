/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const HOVER_REL = 'src/vs/editor/contrib/hover/browser/hoverActions.ts';
const MARKER_REL = 'src/vs/editor/contrib/hover/browser/markerHoverParticipant.ts';
const ACCESS_REL = 'src/vs/editor/contrib/inlineCompletions/browser/inlineCompletionsAccessibleView.ts';
const MODEL_REL = 'src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts';
const INDENT_REL = 'src/vs/editor/contrib/indentation/browser/indentation.ts';
const STICKY_REL = 'src/vs/editor/contrib/stickyScroll/browser/stickyScrollController.ts';
const SECTION_REL = 'src/vs/editor/contrib/sectionHeaders/browser/sectionHeaders.ts';
const UNICODE_REL = 'src/vs/editor/contrib/unicodeHighlighter/browser/unicodeHighlighter.ts';
const GOTO_REL = 'src/vs/editor/contrib/gotoSymbol/browser/link/goToDefinitionAtPosition.ts';
const GOTOSYM_REL = 'src/vs/editor/contrib/gotoSymbol/browser/goToSymbol.ts';
const WORKER_REL = 'src/vs/editor/common/services/editorWorker.ts';
const ACCOUNT_REL = 'src/vs/platform/defaultAccount/common/defaultAccount.ts';
const QUICK_REL = 'src/vs/platform/quickinput/common/quickInput.ts';
const LINKS_REL = 'src/vs/editor/contrib/links/browser/links.ts';
const FORMAT_REL = 'src/vs/editor/contrib/format/browser/formatActions.ts';
const WORD_REL = 'src/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.ts';
const FOLD_REL = 'src/vs/editor/contrib/folding/browser/folding.ts';

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

suite('editor/contrib leftover Promise fire-and-forget catch scan (D703)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const files = [HOVER_REL, ACCESS_REL, MODEL_REL, INDENT_REL, STICKY_REL, SECTION_REL, UNICODE_REL];
		let sites = 0;
		for (const rel of files) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		}
		assert.strictEqual(sites, 8);
	});

	test('hover leftover startFindDefinitionFromCursor then is Promise double-chain; opener stays skipped', () => {
		const source = fs.readFileSync(resolveSource(HOVER_REL), 'utf8');
		const goto = fs.readFileSync(resolveSource(GOTO_REL), 'utf8');
		const marker = fs.readFileSync(resolveSource(MARKER_REL), 'utf8');
		assertPromiseSignature(goto, 'async startFindDefinitionFromCursor(position: Position) {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `promise.then(() => {
			controller.showContentHover(range, HoverStartMode.Immediate, HoverStartSource.Keyboard, true);
		})`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}.catch(onUnexpectedError);`));
		assert.ok(marker.includes('this._openerService.open(resource, {'));
		assert.ok(marker.includes('}).catch(onUnexpectedError);'));
		assert.ok(!marker.includes('}).catch(onUnexpectedError).catch(onUnexpectedError);'));
	});

	test('inlineCompletions leftover next / previous / getDefaultAccount thens are Promise double-chain; two-arg then stays skipped', () => {
		const access = fs.readFileSync(resolveSource(ACCESS_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		assertPromiseSignature(model, 'public async next(): Promise<void> { await this._deltaSelectedInlineCompletionIndex(1); }');
		assertPromiseSignature(model, 'public async previous(): Promise<void> { await this._deltaSelectedInlineCompletionIndex(-1); }');
		assertPromiseSignature(account, 'getDefaultAccount(): Promise<IDefaultAccount | null>;');
		assert.ok(access.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(model.includes("import { BugIndicatingError, onUnexpectedError, onUnexpectedExternalError } from '../../../../../base/common/errors.js';"));
		assert.ok(access.includes(`this._model.next().then((() => this._onDidChangeContent.fire()))${doubleCatch};`));
		assert.ok(access.includes(`this._model.previous().then((() => this._onDidChangeContent.fire()))${doubleCatch};`));
		assert.ok(!access.includes('this._model.next().then((() => this._onDidChangeContent.fire()));'));
		assert.ok(!access.includes('this._model.previous().then((() => this._onDidChangeContent.fire()));'));
		assert.ok(model.includes(`defaultAccountService.getDefaultAccount().then(createDisposableCb(account => this.sku.set(skuFromAccount(account), undefined), this._store))${doubleCatch};`));
		assert.ok(!model.includes('defaultAccountService.getDefaultAccount().then(createDisposableCb(account => this.sku.set(skuFromAccount(account), undefined), this._store));'));
		assert.ok(model.includes('.then(undefined, onUnexpectedExternalError);'));
		assert.ok(!model.includes('.then(undefined, onUnexpectedExternalError).catch(onUnexpectedError)'));
	});

	test('indentation leftover pick then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(INDENT_REL), 'utf8');
		const quick = fs.readFileSync(resolveSource(QUICK_REL), 'utf8');
		assertPromiseSignature(quick, 'pick<T extends IQuickPickItem>(picks: Promise<QuickPickInput<T>[]> | QuickPickInput<T>[], options?: Omit<IPickOptions<T>, \'canPickMany\'>, token?: CancellationToken): Promise<T | undefined>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `quickInputService.pick(picks, { placeHolder: nls.localize({ key: 'selectTabWidth', comment: ['Tab corresponds to the tab key'] }, "Select Tab Size for Current File"), activeItem: picks[autoFocusIndex] }).then(pick => {`;
		assert.ok(source.includes(thenCall));
		assert.ok(source.includes(`			})${doubleCatch};`));
		assert.ok(!source.includes(`			});
		}, 50/* quick input is sensitive to being opened so soon after another */);`));
	});

	test('stickyScroll leftover getDefinitionsAtPosition then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(STICKY_REL), 'utf8');
		const goto = fs.readFileSync(resolveSource(GOTOSYM_REL), 'utf8');
		assertPromiseSignature(goto, 'export function getDefinitionsAtPosition(registry: LanguageFeatureRegistry<DefinitionProvider>, model: ITextModel, position: Position, recursive: boolean, token: CancellationToken): Promise<LocationLink[]> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `getDefinitionsAtPosition(this._languageFeaturesService.definitionProvider, this._editor.getModel(), new Position(range.startLineNumber, range.startColumn + 1), false, cancellationToken.token).then((candidateDefinitions => {`;
		assert.ok(source.includes(thenCall));
		assert.ok(source.includes(`			}))${doubleCatch};`));
		assert.ok(!source.includes(`			}));
		}));`));
	});

	test('sectionHeaders leftover findSectionHeaders then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(SECTION_REL), 'utf8');
		const worker = fs.readFileSync(resolveSource(WORKER_REL), 'utf8');
		assertPromiseSignature(worker, 'findSectionHeaders(uri: URI, options: FindSectionHeaderOptions): Promise<SectionHeader[]>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `this.editorWorkerService.findSectionHeaders(model.uri, this.options)
			.then((sectionHeaders) => {
				if (model.isDisposed() || model.getVersionId() !== modelVersionId) {
					// model changed in the meantime
					return;
				}
				this.updateDecorations(sectionHeaders);
			})`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}.catch(onUnexpectedError);`));
	});

	test('unicodeHighlighter leftover computedUnicodeHighlights then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(UNICODE_REL), 'utf8');
		const worker = fs.readFileSync(resolveSource(WORKER_REL), 'utf8');
		assertPromiseSignature(worker, 'computedUnicodeHighlights(uri: URI, options: UnicodeHighlighterOptions, range?: IRange): Promise<IUnicodeHighlightsResult>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `this._editorWorkerService
			.computedUnicodeHighlights(this._model.uri, this._options)
			.then((info) => {`;
		assert.ok(source.includes(thenCall));
		assert.ok(source.includes(`			})${doubleCatch};`));
		assert.ok(!source.includes(`				this._decorations.set(decorations);
			});
	}`));
	});

	test('opener / D145 / two-arg then / Resolve / already-double / grpc Wire / Connect / Watch / Pty stay skipped', () => {
		const marker = fs.readFileSync(resolveSource(MARKER_REL), 'utf8');
		const links = fs.readFileSync(resolveSource(LINKS_REL), 'utf8');
		const format = fs.readFileSync(resolveSource(FORMAT_REL), 'utf8');
		const word = fs.readFileSync(resolveSource(WORD_REL), 'utf8');
		const fold = fs.readFileSync(resolveSource(FOLD_REL), 'utf8');
		const goto = fs.readFileSync(resolveSource(GOTO_REL), 'utf8');
		const hover = fs.readFileSync(resolveSource(HOVER_REL), 'utf8');
		const access = fs.readFileSync(resolveSource(ACCESS_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const indent = fs.readFileSync(resolveSource(INDENT_REL), 'utf8');
		const sticky = fs.readFileSync(resolveSource(STICKY_REL), 'utf8');
		const section = fs.readFileSync(resolveSource(SECTION_REL), 'utf8');
		const unicode = fs.readFileSync(resolveSource(UNICODE_REL), 'utf8');
		assert.ok(marker.includes('}).catch(onUnexpectedError);'));
		assert.ok(!marker.includes('}).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(marker.includes('}, onUnexpectedError);'));
		assert.ok(links.includes('link.resolve(CancellationToken.None).then(uri => {'));
		assert.ok(!links.includes(doubleCatch));
		assert.ok(word.includes('.then(undefined, onUnexpectedExternalError);'));
		assert.ok(fold.includes('}).then(undefined, onUnexpectedError);'));
		assert.ok(!fold.includes('}).then(undefined, onUnexpectedError).catch(onUnexpectedError)'));
		for (const source of [hover, access, model, indent, sticky, section, unicode, marker, links, format, word, fold, goto]) {
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
