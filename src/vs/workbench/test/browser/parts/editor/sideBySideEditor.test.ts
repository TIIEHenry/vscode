/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Orientation } from '../../../../../base/browser/ui/splitview/splitview.js';
import { Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { SideBySideEditor } from '../../../../browser/parts/editor/sideBySideEditor.js';
import { TestEditorGroupView, workbenchInstantiationService } from '../../workbenchTestServices.js';

suite('SideBySideEditor', () => {

	const disposables = new DisposableStore();

	teardown(() => {
		disposables.clear();
	});

	ensureNoDisposablesAreLeakedInTestSuite();

	test('size constraints follow orientation (HORIZONTAL vs VERTICAL)', () => {
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		const group = disposables.add(new TestEditorGroupView(1));
		const sideBySideEditor = disposables.add(instantiationService.createInstance(SideBySideEditor, group));

		(sideBySideEditor as any).primaryEditorPane = {
			minimumWidth: 100,
			minimumHeight: 200,
			maximumWidth: 800,
			maximumHeight: 600,
			onDidChangeSizeConstraints: Event.None
		};
		(sideBySideEditor as any).secondaryEditorPane = {
			minimumWidth: 120,
			minimumHeight: 180,
			maximumWidth: 900,
			maximumHeight: 500,
			onDidChangeSizeConstraints: Event.None
		};

		// Default orientation is HORIZONTAL
		assert.strictEqual((sideBySideEditor as any).orientation, Orientation.HORIZONTAL);
		assert.strictEqual(sideBySideEditor.minimumWidth, 220); // 100 + 120
		assert.strictEqual(sideBySideEditor.maximumWidth, 1700); // 800 + 900
		assert.strictEqual(sideBySideEditor.minimumHeight, 200); // max(200, 180)
		assert.strictEqual(sideBySideEditor.maximumHeight, 500); // min(600, 500)

		// Set orientation to VERTICAL
		(sideBySideEditor as any).orientation = Orientation.VERTICAL;
		assert.strictEqual(sideBySideEditor.minimumWidth, 120); // max(100, 120)
		assert.strictEqual(sideBySideEditor.maximumWidth, 800); // min(800, 900)
		assert.strictEqual(sideBySideEditor.minimumHeight, 380); // 200 + 180
		assert.strictEqual(sideBySideEditor.maximumHeight, 1100); // 600 + 500
	});

	test('cross-axis maximum stays finite when one pane maximum is Infinity', () => {
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		const group = disposables.add(new TestEditorGroupView(1));
		const sideBySideEditor = disposables.add(instantiationService.createInstance(SideBySideEditor, group));

		(sideBySideEditor as any).primaryEditorPane = {
			minimumWidth: 100,
			minimumHeight: 200,
			maximumWidth: 800,
			maximumHeight: Number.POSITIVE_INFINITY,
			onDidChangeSizeConstraints: Event.None
		};
		(sideBySideEditor as any).secondaryEditorPane = {
			minimumWidth: 120,
			minimumHeight: 180,
			maximumWidth: 900,
			maximumHeight: 500,
			onDidChangeSizeConstraints: Event.None
		};

		// HORIZONTAL: cross axis height max is min(Infinity, 500) = 500
		(sideBySideEditor as any).orientation = Orientation.HORIZONTAL;
		assert.strictEqual(sideBySideEditor.maximumHeight, 500);

		// VERTICAL: cross axis width max with secondary Infinity is min(800, Infinity) = 800
		(sideBySideEditor as any).secondaryEditorPane.maximumWidth = Number.POSITIVE_INFINITY;
		(sideBySideEditor as any).orientation = Orientation.VERTICAL;
		assert.strictEqual(sideBySideEditor.maximumWidth, 800);
	});

	test('configuration update changes orientation and fires onDidChangeSizeConstraints', () => {
		const configService = new TestConfigurationService();
		configService.setUserConfiguration('workbench', { editor: { splitInGroupLayout: 'horizontal' } });

		const instantiationService = workbenchInstantiationService({ configurationService: () => configService }, disposables);
		const group = disposables.add(new TestEditorGroupView(1));
		const sideBySideEditor = disposables.add(instantiationService.createInstance(SideBySideEditor, group));

		const container = document.createElement('div');
		sideBySideEditor.create(container);

		let fired = false;
		disposables.add(sideBySideEditor.onDidChangeSizeConstraints(() => {
			fired = true;
		}));

		configService.setUserConfiguration('workbench', { editor: { splitInGroupLayout: 'vertical' } });
		configService.onDidChangeConfigurationEmitter.fire({
			affectsConfiguration: (key: string) => key === SideBySideEditor.SIDE_BY_SIDE_LAYOUT_SETTING
		} as any);

		assert.strictEqual(fired, true);
		assert.strictEqual((sideBySideEditor as any).orientation, Orientation.VERTICAL);
	});
});
