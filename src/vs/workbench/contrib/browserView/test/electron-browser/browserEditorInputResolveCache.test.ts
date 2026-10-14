/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { BrowserEditorInput } from '../../common/browserEditorInput.js';
import { IBrowserViewModel, IBrowserViewWorkbenchService } from '../../common/browserView.js';

suite('BrowserEditorInput resolve cache', () => {
	const disposables = new DisposableStore();
	let instantiationService: ReturnType<typeof workbenchInstantiationService>;

	setup(() => {
		instantiationService = workbenchInstantiationService(undefined, disposables);
		instantiationService.stub(IBrowserViewWorkbenchService, {
			isSharingAvailable: false,
		} as Partial<IBrowserViewWorkbenchService> as IBrowserViewWorkbenchService);
	});

	teardown(() => disposables.clear());

	ensureNoDisposablesAreLeakedInTestSuite();

	function createModel(id: string): IBrowserViewModel {
		return {
			id,
			dispose() { },
		} as Partial<IBrowserViewModel> as IBrowserViewModel;
	}

	function createInput(resolveModel: () => Promise<IBrowserViewModel>): BrowserEditorInput {
		return disposables.add(instantiationService.createInstance(BrowserEditorInput, { id: 'resolve-cache' }, resolveModel));
	}

	test('concurrent resolve calls _resolveModel once', async () => {
		let calls = 0;
		let release: ((model: IBrowserViewModel) => void) | undefined;
		const pending = new Promise<IBrowserViewModel>(resolve => { release = resolve; });
		const input = createInput(() => {
			calls++;
			return pending;
		});

		const first = input.resolve();
		const second = input.resolve();
		assert.strictEqual(calls, 1);

		const model = createModel('page');
		release!(model);
		const [resolvedFirst, resolvedSecond] = await Promise.all([first, second]);
		assert.strictEqual(calls, 1);
		assert.strictEqual(resolvedFirst, model);
		assert.strictEqual(resolvedSecond, model);
	});

	test('resolve calls _resolveModel again after the first rejection', async () => {
		const error = new Error('first open failed');
		let calls = 0;
		const model = createModel('page');
		const input = createInput(() => {
			calls++;
			if (calls === 1) {
				return Promise.reject(error);
			}
			return Promise.resolve(model);
		});

		const first = input.resolve();
		const second = input.resolve();
		assert.strictEqual(calls, 1);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(calls, 1);

		assert.strictEqual(await input.resolve(), model);
		assert.strictEqual(calls, 2);
	});

	test('resolve does not call _resolveModel again after the first success', async () => {
		let calls = 0;
		const model = createModel('page');
		const input = createInput(() => {
			calls++;
			return Promise.resolve(model);
		});

		const first = input.resolve();
		const second = input.resolve();
		assert.strictEqual(calls, 1);
		assert.strictEqual(await first, model);
		assert.strictEqual(await second, model);
		assert.strictEqual(await input.resolve(), model);
		assert.strictEqual(calls, 1);
	});
});
