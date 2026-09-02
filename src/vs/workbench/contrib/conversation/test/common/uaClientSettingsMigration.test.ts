/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConfigurationKeyValuePairs, ConfigurationValue, Extensions, IConfigurationMigrationRegistry } from '../../../../common/configuration.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import {
	migrateUaClientEnumToDefault,
	migrateUaClientRemovedKey,
	registerUaClientSettingsMigrations,
} from '../../common/uaClientSettingsMigration.js';
import {
	UA_CLIENT_CONVERSATION_DENSITY_VALUES,
	UA_CLIENT_DISPLAY_CONVERSATION_DENSITY,
	UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR,
	UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR_VALUES,
	UA_CLIENT_REMOVED_SETTING_KEYS,
} from '../../common/uaClientSettingsKeys.js';

function asPairs(key: string, result: ConfigurationValue | ConfigurationKeyValuePairs): ConfigurationKeyValuePairs {
	return Array.isArray(result) ? result : [[key, result]];
}

suite('UA Client settings migration (CS-6)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('invalid conversationDensity returns default comfortable', () => {
		assert.deepStrictEqual(
			asPairs(UA_CLIENT_DISPLAY_CONVERSATION_DENSITY, migrateUaClientEnumToDefault('legacy-dense', UA_CLIENT_CONVERSATION_DENSITY_VALUES, 'comfortable')),
			[[UA_CLIENT_DISPLAY_CONVERSATION_DENSITY, { value: 'comfortable' }]],
		);
		assert.deepStrictEqual(
			asPairs(UA_CLIENT_DISPLAY_CONVERSATION_DENSITY, migrateUaClientEnumToDefault(42, UA_CLIENT_CONVERSATION_DENSITY_VALUES, 'comfortable')),
			[[UA_CLIENT_DISPLAY_CONVERSATION_DENSITY, { value: 'comfortable' }]],
		);
	});

	test('valid conversationDensity is left unchanged', () => {
		assert.deepStrictEqual(migrateUaClientEnumToDefault('comfortable', UA_CLIENT_CONVERSATION_DENSITY_VALUES, 'comfortable'), []);
		assert.deepStrictEqual(migrateUaClientEnumToDefault('compact', UA_CLIENT_CONVERSATION_DENSITY_VALUES, 'comfortable'), []);
	});

	test('invalid keyboardEnter.behavior returns default send', () => {
		assert.deepStrictEqual(
			asPairs(UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR, migrateUaClientEnumToDefault('submit', UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR_VALUES, 'send')),
			[[UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR, { value: 'send' }]],
		);
	});

	test('valid keyboardEnter.behavior is left unchanged', () => {
		assert.deepStrictEqual(migrateUaClientEnumToDefault('send', UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR_VALUES, 'send'), []);
		assert.deepStrictEqual(migrateUaClientEnumToDefault('newline', UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR_VALUES, 'send'), []);
	});

	test('removed keys migrate to undefined so settings.json drops them', () => {
		assert.deepStrictEqual(migrateUaClientRemovedKey(), { value: undefined });
	});

	test('registers official migrations for enum defaults and removed keys', () => {
		registerUaClientSettingsMigrations();
		const registry = Registry.as<IConfigurationMigrationRegistry & { migrations: { key: string }[] }>(Extensions.ConfigurationMigration);
		const keys = registry.migrations.map(migration => migration.key);
		assert.ok(keys.includes(UA_CLIENT_DISPLAY_CONVERSATION_DENSITY));
		assert.ok(keys.includes(UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR));
		for (const removed of UA_CLIENT_REMOVED_SETTING_KEYS) {
			assert.ok(keys.includes(removed), `missing migration for ${removed}`);
		}
	});
});
