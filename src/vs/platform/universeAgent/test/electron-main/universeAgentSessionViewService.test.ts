/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { SyncDescriptor } from '../../../instantiation/common/descriptors.js';
import { _util } from '../../../instantiation/common/instantiation.js';
import { ILogService } from '../../../log/common/log.js';
import { IUniverseAgentConnection } from '../../common/universeAgentConnection.js';
import { IUniverseAgentHostConnection } from '../../common/universeAgentHostConnection.js';
import { UniverseAgentSessionViewService } from '../../electron-main/universeAgentSessionViewMainService.js';

suite('UniverseAgentSessionViewService injection', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('the main-process descriptor injects the window connection, the main-only host connection, and the log', () => {
		const dependencies = _util.getServiceDependencies(new SyncDescriptor(UniverseAgentSessionViewService).ctor)
			.slice()
			.sort((a, b) => a.index - b.index)
			.map(dependency => dependency.id);
		assert.deepStrictEqual(dependencies, [IUniverseAgentConnection, IUniverseAgentHostConnection, ILogService]);
	});
});
