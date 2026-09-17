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
const SOURCE_REL = 'src/vs/editor/contrib/suggest/browser/suggestModel.ts';

function suggestModelSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/suggestModel.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `suggestModel.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SuggestModel leftover fire-and-forget catch scan (D672)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Promise.all completions then leftover site is then + double-chain; single-chain gone for this site', () => {
		// Promise.all returns Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows (D480).
		const source = fs.readFileSync(suggestModelSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const thenSite = `Promise.all([completions, wordDistance]).then(async ([completions, wordDistance]) => {

			this._requestToken?.dispose();

			if (!this._editor.hasModel()) {
				completions.disposable.dispose();
				return;
			}

			let clipboardText = options?.clipboardText;
			if (!clipboardText && completions.needsClipboard) {
				clipboardText = await this._clipboardService.readText();
			}

			if (this._triggerState === undefined) {
				completions.disposable.dispose();
				return;
			}

			const model = this._editor.getModel();
			// const items = completions.items;

			// if (existing) {
			// 	const cmpFn = getSuggestionComparator(snippetSortOrder);
			// 	items = items.concat(existing.items).sort(cmpFn);
			// }

			const ctx = new LineContext(model, this._editor.getPosition(), options);
			const fuzzySearchOptions = {
				...FuzzyScoreOptions.default,
				firstMatchCanBeWeak: !this._editor.getOption(EditorOption.suggest).matchOnWordStartOnly
			};
			this._completionModel = new CompletionModel(completions.items, this._context!.column, {
				leadingLineContent: ctx.leadingLineContent,
				characterCountDelta: ctx.column - this._context!.column
			},
				wordDistance,
				this._editor.getOption(EditorOption.suggest),
				this._editor.getOption(EditorOption.snippetSuggestions),
				fuzzySearchOptions,
				clipboardText
			);

			// store containers so that they can be disposed later
			this._completionDisposables.add(completions.disposable);

			this._onNewContext(ctx);

			// finally report telemetry about durations
			this._reportDurationsTelemetry(completions.durations);

			// report invalid completions by source
			if (!this._envService.isBuilt || this._envService.isExtensionDevelopment) {
				for (const item of completions.items) {
					if (item.isInvalid) {
						this._logService.warn(\`[suggest] did IGNORE invalid completion item from \${item.provider._debugDisplayName}\`, item.completion);
					}
				}
			}

		})`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/Promise\.all\(\[completions, wordDistance\]\)\.then\(/g) ?? []).length, 1);
		assert.strictEqual((source.match(/\.catch\(/g) ?? []).length, 2);
		assert.ok(source.includes(`${thenSite}${doubleCatch};`));
		assert.ok(!source.includes(`${thenSite};`));
		assert.ok(!source.includes(`${thenSite}.catch(onUnexpectedError);`));
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
	});
});
