/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IEncryptionMainService } from '../../../encryption/common/encryptionService.js';
import { SyncDescriptor } from '../../../instantiation/common/descriptors.js';
import { _util } from '../../../instantiation/common/instantiation.js';
import { IApplicationStorageMainService } from '../../../storage/electron-main/storageMainService.js';
import { UniverseAgentConnectionService } from '../../electron-main/universeAgentMainService.js';

suite('UniverseAgentConnectionService electron-main host', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('the main-process descriptor injects only secret storage, with no dialog or window service for pairing', () => {
		const dependencies = _util.getServiceDependencies(new SyncDescriptor(UniverseAgentConnectionService).ctor)
			.slice()
			.sort((a, b) => a.index - b.index)
			.map(dependency => dependency.id);
		assert.deepStrictEqual(dependencies, [IEncryptionMainService, IApplicationStorageMainService]);
	});
});
