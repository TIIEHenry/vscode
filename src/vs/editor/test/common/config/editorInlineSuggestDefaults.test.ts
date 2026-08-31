/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorOption, editorOptionsRegistry } from '../../../common/config/editorOptions.js';
import '../../../common/config/editorConfigurationSchema.js';

suite('EditorInlineSuggestDefaults - Preview ghost text', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('editor.inlineSuggest.enabled defaults to false (no auto Copilot-style inline suggestions)', () => {
		const inlineSuggestOption = editorOptionsRegistry[EditorOption.inlineSuggest];
		assert.strictEqual((inlineSuggestOption.defaultValue as { enabled: boolean }).enabled, false);

		const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
		const property = configurationRegistry.getConfigurationProperties()['editor.inlineSuggest.enabled'];
		assert.strictEqual(property.default, false);
	});
});
