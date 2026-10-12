/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TestAccessibilityService } from '../../../../platform/accessibility/test/common/testAccessibilityService.js';
import { DiffEditorOptions } from '../../../browser/widget/diffEditor/diffEditorOptions.js';
import { IDiffProviderFactoryService } from '../../../browser/widget/diffEditor/diffProviderFactoryService.js';
import { DiffEditorViewModel, DiffState } from '../../../browser/widget/diffEditor/diffEditorViewModel.js';
import { Range } from '../../../common/core/range.js';
import { LineRange } from '../../../common/core/ranges/lineRange.js';
import { IDocumentDiff, IDocumentDiffProvider, IDocumentDiffProviderOptions } from '../../../common/diff/documentDiffProvider.js';
import { DetailedLineRangeMapping, RangeMapping } from '../../../common/diff/rangeMapping.js';
import { ITextModel } from '../../../common/model.js';
import { createTextModel } from '../../common/testTextModel.js';

suite('DiffEditorViewModel', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function mapping(startLineNumber: number, endLineNumberExclusive: number): IDocumentDiff {
		return {
			identical: false,
			quitEarly: false,
			moves: [],
			changes: [
				new DetailedLineRangeMapping(
					new LineRange(startLineNumber, endLineNumberExclusive),
					new LineRange(startLineNumber, endLineNumberExclusive),
					[new RangeMapping(
						new Range(startLineNumber, 1, startLineNumber, 5),
						new Range(startLineNumber, 1, startLineNumber, 8),
					)],
				),
			],
		};
	}

	function describeDiff(state: DiffState | undefined): string {
		return (state?.mappings ?? []).map(item => item.lineRangeMapping.toString()).join('|');
	}

	class HangingDiffProvider implements IDocumentDiffProvider {
		private readonly _onDidChange = new Emitter<void>();
		readonly onDidChange = this._onDidChange.event;
		private readonly _pending: Array<(diff: IDocumentDiff) => void> = [];
		callsStarted = 0;

		get pendingCount(): number {
			return this._pending.length;
		}

		constructor(private readonly _first: IDocumentDiff) { }

		computeDiff(_original: ITextModel, _modified: ITextModel, _options: IDocumentDiffProviderOptions, _token: CancellationToken): Promise<IDocumentDiff> {
			this.callsStarted++;
			if (this.callsStarted === 1) {
				return Promise.resolve(this._first);
			}
			return new Promise<IDocumentDiff>(resolve => {
				this._pending.push(resolve);
			});
		}

		fireChange(): void {
			this._onDidChange.fire();
		}

		releaseNext(diff: IDocumentDiff): void {
			const resolve = this._pending.shift();
			assert.ok(resolve, 'no hanging diff computation');
			resolve(diff);
		}

		dispose(): void {
			this._onDidChange.dispose();
		}
	}

	async function flush(): Promise<void> {
		await new Promise<void>(resolve => setTimeout(resolve, 0));
	}

	async function createViewModel(provider: HangingDiffProvider): Promise<{ viewModel: DiffEditorViewModel; modified: ITextModel }> {
		const original = disposables.add(createTextModel('line1\nkeep\nline3'));
		const modified = disposables.add(createTextModel('line1\nchanged\nline3'));
		const options = new DiffEditorOptions({}, new TestAccessibilityService());
		const factory: IDiffProviderFactoryService = {
			_serviceBrand: undefined,
			createDiffProvider: () => provider,
		};
		const viewModel = disposables.add(new DiffEditorViewModel({ original, modified }, options, factory));
		await viewModel.waitForDiff();
		return { viewModel, modified };
	}

	test('does not publish a diff that could not be translated across edits made while computeDiff was suspended', async () => {
		const provider = disposables.add(new HangingDiffProvider(mapping(2, 3)));
		const { viewModel, modified } = await createViewModel(provider);
		const published = viewModel.diff.get();
		const publishedText = describeDiff(published);
		assert.ok(published);
		assert.ok(publishedText.length > 0);
		assert.strictEqual(viewModel.isDiffUpToDate.get(), true);

		provider.fireChange();
		assert.strictEqual(provider.callsStarted, 2);

		modified.applyEdits([{
			range: new Range(2, 1, 3, 1),
			text: '',
		}]);
		assert.strictEqual(modified.getValue(), 'line1\nline3');

		let thrown: unknown;
		try {
			provider.releaseNext(mapping(1, 2));
			await flush();
		} catch (error) {
			thrown = error;
		}

		assert.strictEqual(thrown, undefined);
		assert.strictEqual(viewModel.isDiffUpToDate.get(), false);
		assert.strictEqual(viewModel.diff.get(), published);
		assert.strictEqual(describeDiff(viewModel.diff.get()), publishedText);
	});

	test('a stale diff computation does not replace the published mapping', async () => {
		const provider = disposables.add(new HangingDiffProvider(mapping(2, 3)));
		const { viewModel } = await createViewModel(provider);
		const published = viewModel.diff.get();
		assert.ok(published);

		provider.fireChange();
		provider.fireChange();
		assert.strictEqual(provider.callsStarted, 3);
		assert.strictEqual(provider.pendingCount, 2);

		provider.releaseNext(mapping(1, 2));
		await flush();
		assert.strictEqual(viewModel.isDiffUpToDate.get(), false);
		assert.strictEqual(viewModel.diff.get(), published);

		provider.releaseNext(mapping(3, 4));
		await flush();
		assert.strictEqual(viewModel.isDiffUpToDate.get(), true);
		assert.notStrictEqual(viewModel.diff.get(), published);
		assert.ok(describeDiff(viewModel.diff.get()).includes('3'));
	});
});
