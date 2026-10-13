/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { WalkThroughInput } from '../../browser/walkThroughInput.js';
import { walkThroughContentRegistry } from '../../common/walkThroughContentProvider.js';

suite('WalkThroughInput resolve', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('reads moduleToContent again after the first rejection and caches a resolved model', async () => {
		const moduleId = 'testWelcomeWalkthroughResolveRetry';
		let reads = 0;
		walkThroughContentRegistry.registerProvider(moduleId, () => {
			reads++;
			if (reads === 1) {
				throw new Error('walkthrough read failed');
			}
			return '<p>ok</p>';
		});

		const instantiationService = new InstantiationService();
		const input = disposables.add(new WalkThroughInput({
			typeId: 'test.walkThroughInput',
			name: 'test',
			resource: URI.from({
				scheme: 'walkThrough',
				path: '/walkThrough.html',
				query: JSON.stringify({ moduleId }),
			}),
			telemetryFrom: 'test',
		}, instantiationService, {} as ITextModelService));

		await assert.rejects(input.resolve(), /walkthrough read failed/);
		assert.strictEqual(reads, 1);

		const model = await input.resolve();
		assert.strictEqual(reads, 2);
		assert.strictEqual(model.main, '<p>ok</p>');

		const again = await input.resolve();
		assert.strictEqual(again, model);
		assert.strictEqual(reads, 2);
		model.dispose();
		instantiationService.dispose();
	});
});
