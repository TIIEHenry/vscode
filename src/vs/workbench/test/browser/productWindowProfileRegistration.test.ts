/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { getSingletonServiceDescriptors } from '../../../platform/instantiation/common/extensions.js';
import { IProductWindowProfile } from '../../services/productShell/common/productWindowProfile.js';
import { ProductWindowProfile } from '../../contrib/preferences/browser/productWindowProfile.js';
import '../../contrib/preferences/browser/productWindowProfile.contribution.js';

suite('Product window profile registration', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('the contribution registers ProductWindowProfile as the IProductWindowProfile singleton', () => {
		const registered = getSingletonServiceDescriptors().filter(([id]) => id === IProductWindowProfile);
		assert.strictEqual(registered.length, 1);
		assert.strictEqual(registered[0][1].ctor, ProductWindowProfile);
	});
});
