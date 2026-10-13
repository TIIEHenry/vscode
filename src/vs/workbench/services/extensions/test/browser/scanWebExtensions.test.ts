/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ExtensionType, IExtension, IExtensionDescription, TargetPlatform } from '../../../../../platform/extensions/common/extensions.js';
import { ExtensionService } from '../../browser/extensionService.js';

interface IScanCounts {
	system: number;
	user: number;
	development: number;
}

interface IScanWebExtensionsTarget {
	_scanWebExtensions(): Promise<IExtensionDescription[]>;
	_scanWebExtensionsPromise: Promise<IExtensionDescription[]> | undefined;
}

function extension(name: string): IExtension {
	return {
		identifier: { id: `pub.${name}` },
		manifest: {
			name,
			publisher: 'pub',
			version: '1.0.0',
			engines: { vscode: '^1.0.0' },
		},
		location: URI.file(`/extensions/${name}`),
		type: ExtensionType.User,
		isBuiltin: false,
		targetPlatform: TargetPlatform.UNIVERSAL,
		isValid: true,
		validations: [],
		preRelease: false,
	};
}

function createHarness(scans: {
	scanSystemExtensions: () => Promise<IExtension[]>;
	scanUserExtensions: (profileLocation: URI, options?: { skipInvalidExtensions?: boolean }) => Promise<IExtension[]>;
	scanExtensionsUnderDevelopment: () => Promise<IExtension[]>;
}, errors: unknown[]): IScanWebExtensionsTarget {
	const extensionsResource = URI.file('/profile/extensions.json');
	const service = Object.create(ExtensionService.prototype) as IScanWebExtensionsTarget & {
		_webExtensionsScannerService: typeof scans;
		_userDataProfileService: { currentProfile: { extensionsResource: URI } };
		_logService: { error(error: unknown): void; warn(...args: unknown[]): void; info(...args: unknown[]): void };
	};
	service._scanWebExtensionsPromise = undefined;
	service._webExtensionsScannerService = {
		scanSystemExtensions: () => scans.scanSystemExtensions(),
		scanUserExtensions: (profileLocation, options) => {
			assert.strictEqual(profileLocation.toString(), extensionsResource.toString());
			assert.deepStrictEqual(options, { skipInvalidExtensions: true });
			return scans.scanUserExtensions(profileLocation, options);
		},
		scanExtensionsUnderDevelopment: () => scans.scanExtensionsUnderDevelopment(),
	};
	service._userDataProfileService = { currentProfile: { extensionsResource } };
	service._logService = {
		error: error => { errors.push(error); },
		warn() { },
		info() { },
	};
	return service;
}

function idsOf(extensions: readonly IExtensionDescription[]): string[] {
	return extensions.map(extension => extension.identifier.value).sort();
}

suite('ExtensionService._scanWebExtensions', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected scan returns the partial list and the next call scans again', async () => {
		const error = new Error('user scan failed');
		const errors: unknown[] = [];
		const counts: IScanCounts = { system: 0, user: 0, development: 0 };
		const service = createHarness({
			scanSystemExtensions: async () => {
				counts.system++;
				return [extension('system')];
			},
			scanUserExtensions: async () => {
				counts.user++;
				if (counts.user === 1) {
					throw error;
				}
				return [extension('user')];
			},
			scanExtensionsUnderDevelopment: async () => {
				counts.development++;
				return [extension('dev')];
			},
		}, errors);

		const first = service._scanWebExtensions();
		const shared = service._scanWebExtensions();
		assert.strictEqual(shared, first);

		const listed = await first;
		assert.deepStrictEqual(idsOf(listed), ['pub.dev', 'pub.system']);
		assert.strictEqual(await shared, listed);
		assert.deepStrictEqual(errors, [error]);
		assert.deepStrictEqual(counts, { system: 1, user: 1, development: 1 });

		const second = service._scanWebExtensions();
		assert.notStrictEqual(second, first);
		assert.deepStrictEqual(idsOf(await second), ['pub.dev', 'pub.system', 'pub.user']);
		assert.deepStrictEqual(counts, { system: 2, user: 2, development: 2 });
		assert.strictEqual(service._scanWebExtensions(), second);
		assert.deepStrictEqual(counts, { system: 2, user: 2, development: 2 });
	});

	test('a synchronous scanner throw is not cached', async () => {
		const error = new Error('sync scan failed');
		const errors: unknown[] = [];
		const counts: IScanCounts = { system: 0, user: 0, development: 0 };
		const service = createHarness({
			scanSystemExtensions: () => {
				counts.system++;
				return Promise.resolve([extension('system')]);
			},
			scanUserExtensions: () => {
				counts.user++;
				throw error;
			},
			scanExtensionsUnderDevelopment: () => {
				counts.development++;
				return Promise.resolve([extension('dev')]);
			},
		}, errors);

		const first = service._scanWebExtensions();
		const shared = service._scanWebExtensions();
		assert.strictEqual(shared, first);
		const listed = await first;
		assert.ok(Array.isArray(listed));
		assert.strictEqual(await shared, listed);
		assert.deepStrictEqual(errors, [error]);

		const second = service._scanWebExtensions();
		assert.notStrictEqual(second, first);
		await second;
		assert.deepStrictEqual(counts, { system: 2, user: 2, development: 0 });
		assert.deepStrictEqual(errors, [error, error]);
	});

	test('a successful scan is reused and does not scan again', async () => {
		const errors: unknown[] = [];
		const counts: IScanCounts = { system: 0, user: 0, development: 0 };
		let release!: () => void;
		const gate = new Promise<void>(resolve => { release = resolve; });
		const service = createHarness({
			scanSystemExtensions: () => {
				counts.system++;
				return gate.then(() => [extension('system')]);
			},
			scanUserExtensions: () => {
				counts.user++;
				return gate.then(() => [extension('user')]);
			},
			scanExtensionsUnderDevelopment: () => {
				counts.development++;
				return gate.then(() => [extension('dev')]);
			},
		}, errors);

		const first = service._scanWebExtensions();
		const second = service._scanWebExtensions();
		assert.strictEqual(second, first);
		await Promise.resolve();
		assert.deepStrictEqual(counts, { system: 1, user: 1, development: 1 });

		release();
		assert.deepStrictEqual(idsOf(await first), ['pub.dev', 'pub.system', 'pub.user']);
		assert.strictEqual(await second, await first);
		const third = service._scanWebExtensions();
		assert.strictEqual(third, first);
		assert.deepStrictEqual(idsOf(await third), ['pub.dev', 'pub.system', 'pub.user']);
		assert.deepStrictEqual(counts, { system: 1, user: 1, development: 1 });
		assert.deepStrictEqual(errors, []);
	});
});
