/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shouldRegisterRemoteHostStatusBar } from '../../browser/remoteIndicator.js';

suite('RemoteStatusIndicator - default window status bar', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Remote Host status bar is hidden in local default Code window', () => {
		assert.strictEqual(
			shouldRegisterRemoteHostStatusBar({
				isSessionsWindow: false,
				remoteAuthority: undefined,
				hasVirtualWorkspaceLocation: false,
				hasWindowIndicator: false,
			}),
			false,
			'default Code window must not register status.host'
		);
	});

	test('Remote Host status bar remains available in Agents Window', () => {
		assert.strictEqual(
			shouldRegisterRemoteHostStatusBar({
				isSessionsWindow: true,
				remoteAuthority: undefined,
				hasVirtualWorkspaceLocation: false,
				hasWindowIndicator: false,
			}),
			true,
			'Agents Window may register status.host'
		);
	});

	test('Remote Host status bar remains available for real remote windows', () => {
		assert.strictEqual(
			shouldRegisterRemoteHostStatusBar({
				isSessionsWindow: false,
				remoteAuthority: 'ssh-remote+myhost',
				hasVirtualWorkspaceLocation: false,
				hasWindowIndicator: false,
			}),
			true,
			'remote windows must keep status.host'
		);
	});

	test('Remote Host status bar remains available for virtual workspaces', () => {
		assert.strictEqual(
			shouldRegisterRemoteHostStatusBar({
				isSessionsWindow: false,
				remoteAuthority: undefined,
				hasVirtualWorkspaceLocation: true,
				hasWindowIndicator: false,
			}),
			true,
			'virtual workspaces must keep status.host'
		);
	});

	test('Remote Host status bar remains available when window indicator is provided', () => {
		assert.strictEqual(
			shouldRegisterRemoteHostStatusBar({
				isSessionsWindow: false,
				remoteAuthority: undefined,
				hasVirtualWorkspaceLocation: false,
				hasWindowIndicator: true,
			}),
			true,
			'embedder-provided window indicators must keep status.host'
		);
	});
});
