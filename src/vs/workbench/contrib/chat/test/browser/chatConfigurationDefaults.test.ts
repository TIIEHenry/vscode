/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { ChatConfiguration } from '../../common/constants.js';
import '../../browser/chat.shared.contribution.js';

suite('ChatConfigurationDefaults - INV-NO-COPILOT titlebar', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('editor window chat.agentsControl.enabled defaults to hidden (no compact command-center chrome)', () => {
		const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
		const property = configurationRegistry.getConfigurationProperties()[ChatConfiguration.AgentStatusEnabled];
		assert.strictEqual(property.default, 'hidden');
	});

	test('editor window chat.titleBar.signIn.enabled defaults to false (no Copilot Sign In on title bar)', () => {
		const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
		const property = configurationRegistry.getConfigurationProperties()[ChatConfiguration.TitleBarSignInEnabled];
		assert.strictEqual(property.default, false);
	});
});
