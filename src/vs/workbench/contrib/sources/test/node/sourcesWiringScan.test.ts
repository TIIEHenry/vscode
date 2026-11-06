/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getSingletonServiceDescriptors } from '../../../../../platform/instantiation/common/extensions.js';
import { ISourcesChangesModel, isSourcesFileDiffOpenSkipped, SourcesChangesReadState } from '../../common/sourcesChangesModel.js';
import { SourcesChangesModel } from '../../common/sourcesChangesReadModel.js';

suite('Sources - common wiring', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Changes and Review share one delayed read model singleton', () => {
		const registered = getSingletonServiceDescriptors().filter(([id]) => id === ISourcesChangesModel);
		assert.strictEqual(registered.length, 1);
		const [, descriptor] = registered[0];
		assert.deepStrictEqual({ ctor: descriptor.ctor, delayed: descriptor.supportsDelayedInstantiation }, { ctor: SourcesChangesModel, delayed: true });
	});

	test('FileDiff open is skipped only for list-fail and pairing-hold leftover rows', () => {
		const states: [SourcesChangesReadState, boolean][] = [
			[{ kind: 'scm' }, false],
			[{ kind: 'engine-live', sessionId: 's' }, false],
			[{ kind: 'engine-leftover', sessionId: 's', reason: 'no-hook' }, false],
			[{ kind: 'engine-leftover', sessionId: 's', reason: 'read-failed' }, true],
			[{ kind: 'engine-leftover', sessionId: 's', reason: 'pairing-hold' }, true],
		];
		assert.deepStrictEqual(states.map(([state]) => isSourcesFileDiffOpenSkipped(state)), states.map(([, skipped]) => skipped));
	});
});
