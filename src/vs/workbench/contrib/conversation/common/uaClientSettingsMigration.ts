/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import { ConfigurationKeyValuePairs, ConfigurationValue, Extensions as WorkbenchExtensions, IConfigurationMigrationRegistry } from '../../../common/configuration.js';
import {
	UA_CLIENT_CONVERSATION_DENSITY_VALUES,
	UA_CLIENT_DISPLAY_CONVERSATION_DENSITY,
	UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR,
	UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR_VALUES,
	UA_CLIENT_REMOVED_SETTING_KEYS,
} from './uaClientSettingsKeys.js';

export function migrateUaClientEnumToDefault(value: unknown, allowed: readonly string[], fallback: string): ConfigurationValue | ConfigurationKeyValuePairs {
	if (typeof value === 'string' && allowed.includes(value)) {
		return [];
	}
	return { value: fallback };
}

export function migrateUaClientRemovedKey(): ConfigurationValue {
	return { value: undefined };
}

export function registerUaClientSettingsMigrations(): void {
	Registry.as<IConfigurationMigrationRegistry>(WorkbenchExtensions.ConfigurationMigration)
		.registerConfigurationMigrations([
			{
				key: UA_CLIENT_DISPLAY_CONVERSATION_DENSITY,
				migrateFn: value => migrateUaClientEnumToDefault(value, UA_CLIENT_CONVERSATION_DENSITY_VALUES, 'comfortable'),
			},
			{
				key: UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR,
				migrateFn: value => migrateUaClientEnumToDefault(value, UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR_VALUES, 'send'),
			},
			...UA_CLIENT_REMOVED_SETTING_KEYS.map(key => ({
				key,
				migrateFn: () => migrateUaClientRemovedKey(),
			})),
		]);
}
