/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { PostOutcome as RendererPostOutcome } from '../../common/conversationViewFrame.js';
import type { PostOutcome as CorePostOutcome } from '../../node/sessionCore/messages.js';

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type RejectReason<T> = T extends { readonly accepted: false; readonly reason: infer R } ? R : never;

// `correlation` differs on purpose (branded ref vs `{ id }`); only the reject reasons must stay in sync.
const reasonsMatch: Equals<RejectReason<RendererPostOutcome>, RejectReason<CorePostOutcome>> = true;
const reasonsNonEmpty: Equals<RejectReason<CorePostOutcome>, never> = false;

suite('UniverseAgent PostOutcome mirror', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('renderer PostOutcome reject reasons equal the session-core union', () => {
		assert.deepStrictEqual({ reasonsMatch, reasonsNonEmpty }, { reasonsMatch: true, reasonsNonEmpty: false });
	});
});
