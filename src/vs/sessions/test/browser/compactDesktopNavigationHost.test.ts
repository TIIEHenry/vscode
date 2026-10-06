/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { NullLogService } from '../../../platform/log/common/log.js';
import { InMemoryStorageService } from '../../../platform/storage/common/storage.js';
import { CompactDesktopNavigationHost } from '../../browser/parts/compactDesktop/compactDesktopNavigationHost.js';
import { CustomViewService, ICustomViewService } from '../../services/customView/browser/customViewService.js';

suite('CompactDesktopNavigationHost', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('removes its chrome from the parent when disposed', () => {
		const parent = document.createElement('div');
		const instantiationService = disposables.add(new TestInstantiationService());
		instantiationService.stub(
			ICustomViewService,
			disposables.add(new CustomViewService(new NullLogService(), disposables.add(new InMemoryStorageService()))),
		);

		const host = disposables.add(instantiationService.createInstance(CompactDesktopNavigationHost, parent));
		assert.strictEqual(parent.querySelectorAll('.compact-desktop-nav-host').length, 1);

		host.dispose();

		assert.strictEqual(parent.querySelectorAll('.compact-desktop-nav-host').length, 0);
	});
});
