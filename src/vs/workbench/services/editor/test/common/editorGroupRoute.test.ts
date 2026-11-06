/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { EditorGroupRouteRegistry, IEditorGroupRoute } from '../../common/editorGroupRoute.js';

suite('Editor group route registry', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createRoute(): IEditorGroupRoute {
		return {
			classify: () => 'foreign',
			isExtensionTab: () => false,
			createDefaultRoot: () => { throw new Error('not used'); },
		};
	}

	test('unregistered registry answers undefined', () => {
		const registry = new EditorGroupRouteRegistry();

		assert.strictEqual(registry.get(), undefined);
	});

	test('register exposes the route until the handle is disposed', () => {
		const registry = new EditorGroupRouteRegistry();
		const route = createRoute();

		const handle = store.add(registry.register(route));
		assert.strictEqual(registry.get(), route);

		handle.dispose();
		assert.strictEqual(registry.get(), undefined);
	});

	test('a second registration while one is live throws and leaves the first in place', () => {
		const registry = new EditorGroupRouteRegistry();
		const first = createRoute();
		store.add(registry.register(first));

		assert.throws(() => registry.register(createRoute()), /already registered/);
		assert.strictEqual(registry.get(), first);
	});

	test('re-registering after dispose works and a stale handle does not unregister the new route', () => {
		const registry = new EditorGroupRouteRegistry();
		const first = createRoute();
		const firstHandle = registry.register(first);
		firstHandle.dispose();

		const second = createRoute();
		store.add(registry.register(second));
		assert.strictEqual(registry.get(), second);

		firstHandle.dispose();
		assert.strictEqual(registry.get(), second);
	});

	test('disposing the handle twice is harmless', () => {
		const registry = new EditorGroupRouteRegistry();
		const handle = registry.register(createRoute());

		handle.dispose();
		handle.dispose();
		assert.strictEqual(registry.get(), undefined);
	});
});
