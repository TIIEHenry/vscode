/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { isWeb, OperatingSystem, OS } from '../../../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ILabelService, ResourceLabelFormatter } from '../../../../../platform/label/common/label.js';
import { IRemoteAgentEnvironment } from '../../../../../platform/remote/common/remoteAgentEnvironment.js';
import { IRemoteAgentService } from '../../../../services/remote/common/remoteAgentService.js';
import { LabelContribution } from '../../common/remote.contribution.js';

suite('LabelContribution', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('registers vscode-remote with the local OS and skips vscodeUserData when getEnvironment rejects', async () => {
		const { formatters, calls } = await registerFrom(Promise.reject(new Error('remote environment failed')));

		assert.strictEqual(calls, 1);
		assert.deepStrictEqual(formatters.map(formatter => formatter.scheme), [Schemas.vscodeRemote]);
		assertRemoteFormatting(formatters[0], OS);
	});

	test('registers backslash separators when getEnvironment returns Windows', async () => {
		const environment = { os: OperatingSystem.Windows } as IRemoteAgentEnvironment;
		const { formatters, calls } = await registerFrom(Promise.resolve(environment));

		assert.strictEqual(calls, 1);
		assert.deepStrictEqual(formatters.map(formatter => formatter.scheme), [Schemas.vscodeRemote, Schemas.vscodeUserData]);
		assertRemoteFormatting(formatters[0], OperatingSystem.Windows);
		assertRemoteFormatting(formatters[1], OperatingSystem.Windows);
	});

	test('registers vscode-remote with the local OS and skips vscodeUserData when getEnvironment returns null', async () => {
		const { formatters, calls } = await registerFrom(Promise.resolve(null));

		assert.strictEqual(calls, 1);
		assert.deepStrictEqual(formatters.map(formatter => formatter.scheme), [Schemas.vscodeRemote]);
		assertRemoteFormatting(formatters[0], OS);
	});
});

async function registerFrom(environment: Promise<IRemoteAgentEnvironment | null>): Promise<{ formatters: ResourceLabelFormatter[]; calls: number }> {
	const formatters: ResourceLabelFormatter[] = [];
	let calls = 0;
	const labelService: Pick<ILabelService, 'registerFormatter'> = {
		registerFormatter: formatter => {
			formatters.push(formatter);
			return Disposable.None;
		},
	};
	const remoteAgentService: Pick<IRemoteAgentService, 'getEnvironment'> = {
		getEnvironment: () => {
			calls++;
			return environment;
		},
	};
	new LabelContribution(labelService as ILabelService, remoteAgentService as IRemoteAgentService);
	await environment.then(() => undefined, () => undefined);
	return { formatters, calls };
}

function assertRemoteFormatting(formatter: ResourceLabelFormatter, os: OperatingSystem): void {
	assert.strictEqual(formatter.formatting.label, '${path}');
	assert.strictEqual(formatter.formatting.separator, os === OperatingSystem.Windows ? '\\' : '/');
	assert.strictEqual(formatter.formatting.tildify, os !== OperatingSystem.Windows);
	assert.strictEqual(formatter.formatting.normalizeDriveLetter, os === OperatingSystem.Windows);
	assert.strictEqual(formatter.formatting.workspaceSuffix, isWeb ? undefined : Schemas.vscodeRemote);
}
