/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { FileOperationError, FileOperationResult } from '../../../files/common/files.js';
import { FileService } from '../../../files/common/fileService.js';
import { InMemoryFileSystemProvider } from '../../../files/common/inMemoryFilesystemProvider.js';
import { NullLogService } from '../../../log/common/log.js';
import { FilePolicyService } from '../../common/filePolicyService.js';
import { PolicyDefinition } from '../../common/policy.js';

suite('FilePolicyService', () => {

	const disposables = new DisposableStore();
	const policyFile = URI.from({ scheme: 'policy-test', path: '/policies.json' });
	let fileService: FileService;
	let service: FilePolicyService;

	setup(() => {
		fileService = disposables.add(new FileService(new NullLogService()));
		disposables.add(fileService.registerProvider(policyFile.scheme, disposables.add(new InMemoryFileSystemProvider())));
		service = disposables.add(new FilePolicyService(policyFile, fileService, new NullLogService()));
	});

	teardown(() => disposables.clear());

	ensureNoDisposablesAreLeakedInTestSuite();

	function definition(): PolicyDefinition {
		return { type: 'string' };
	}

	async function load(content: string): Promise<void> {
		await fileService.writeFile(policyFile, VSBuffer.fromString(content));
		await service.updatePolicyDefinitions({ PolicyA: definition() });
	}

	test('keeps the last good table when the file is not valid JSON', async () => {
		await load(JSON.stringify({ PolicyA: 'good' }));
		assert.strictEqual(service.getPolicyValue('PolicyA'), 'good');

		const changes: string[][] = [];
		disposables.add(service.onDidChange(names => changes.push([...names])));
		await load('{ not json');

		assert.strictEqual(service.getPolicyValue('PolicyA'), 'good');
		assert.deepStrictEqual(changes, []);
	});

	test('keeps the last good table when the file is a JSON array', async () => {
		await load(JSON.stringify({ PolicyA: 'good' }));

		const changes: string[][] = [];
		disposables.add(service.onDidChange(names => changes.push([...names])));
		await load(JSON.stringify(['PolicyA']));

		assert.strictEqual(service.getPolicyValue('PolicyA'), 'good');
		assert.deepStrictEqual(changes, []);
	});

	test('keeps the last good table when reading fails for a reason other than FILE_NOT_FOUND', async () => {
		await load(JSON.stringify({ PolicyA: 'good' }));

		const original = fileService.readFile.bind(fileService);
		fileService.readFile = (async () => {
			throw new FileOperationError('permission denied', FileOperationResult.FILE_PERMISSION_DENIED);
		}) as typeof fileService.readFile;

		const changes: string[][] = [];
		disposables.add(service.onDidChange(names => changes.push([...names])));
		try {
			await service.updatePolicyDefinitions({ PolicyA: definition() });
		} finally {
			fileService.readFile = original;
		}

		assert.strictEqual(service.getPolicyValue('PolicyA'), 'good');
		assert.deepStrictEqual(changes, []);
	});

	test('a missing file clears the table', async () => {
		await load(JSON.stringify({ PolicyA: 'good' }));
		await fileService.del(policyFile);

		const changes: string[][] = [];
		disposables.add(service.onDidChange(names => changes.push([...names])));
		await service.updatePolicyDefinitions({ PolicyA: definition() });

		assert.strictEqual(service.getPolicyValue('PolicyA'), undefined);
		assert.deepStrictEqual(changes, [['PolicyA']]);
	});
});
