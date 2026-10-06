/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { IConfigurationChangeEvent } from '../../../../../platform/configuration/common/configuration.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { markersFileDecorationsEnablementAffectsConfiguration } from '../../browser/markersFileDecorations.js';

function mockConfigurationChangeEvent(keys: string[]): IConfigurationChangeEvent {
	return {
		affectsConfiguration: (key: string) => keys.includes(key),
	} as IConfigurationChangeEvent;
}

suite('MarkersFileDecorations - enablement configuration', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('decorations.enabled only', () => {
		assert.strictEqual(
			markersFileDecorationsEnablementAffectsConfiguration(mockConfigurationChangeEvent(['problems.decorations.enabled'])),
			true
		);
	});

	test('visibility only', () => {
		assert.strictEqual(
			markersFileDecorationsEnablementAffectsConfiguration(mockConfigurationChangeEvent(['problems.visibility'])),
			true
		);
	});

	test('autoReveal only', () => {
		assert.strictEqual(
			markersFileDecorationsEnablementAffectsConfiguration(mockConfigurationChangeEvent(['problems.autoReveal'])),
			false
		);
	});

	test('neither visibility nor decorations.enabled', () => {
		assert.strictEqual(
			markersFileDecorationsEnablementAffectsConfiguration(mockConfigurationChangeEvent([])),
			false
		);
	});
});
