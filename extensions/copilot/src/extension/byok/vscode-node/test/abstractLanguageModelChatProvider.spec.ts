/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ILogService } from '../../../../platform/log/common/logService';
import { TestLogService } from '../../../../platform/testing/common/testLogService';
import { CancellationToken } from '../../../../util/vs/base/common/cancellation';
import { AbstractLanguageModelChatProvider, ExtendedLanguageModelChatInformation, LanguageModelChatConfiguration } from '../abstractLanguageModelChatProvider';
import type { IBYOKStorageService } from '../byokStorageService';

// Stands in for `commands.executeCommand`. Mocking the whole `vscode` module fails here because the
// provider's import chain reads exports (such as `ChatHookType`) that the test shim does not define.
const executeCommand = vi.fn();

class TestProvider extends AbstractLanguageModelChatProvider {
	readonly listedApiKeys: (string | undefined)[] = [];

	constructor(storage: IBYOKStorageService, logService: ILogService) {
		super('anthropic', 'Anthropic', undefined, storage, logService);
	}

	protected override async configureDefaultGroupIfExists(name: string, configuration: LanguageModelChatConfiguration): Promise<void> {
		await executeCommand('lm.migrateLanguageModelsProviderGroup', { vendor: this._id, name, ...configuration });
	}

	override async provideLanguageModelChatResponse(): Promise<void> { }

	override async provideTokenCount(): Promise<number> {
		return 0;
	}

	protected override async getAllModels(_silent: boolean, apiKey: string | undefined): Promise<ExtendedLanguageModelChatInformation<LanguageModelChatConfiguration>[]> {
		this.listedApiKeys.push(apiKey);
		return [];
	}
}

function createStorage(apiKey: string | undefined) {
	let migrated = false;
	return {
		getAPIKey: vi.fn(async () => apiKey),
		storeAPIKey: vi.fn(async () => undefined),
		deleteAPIKey: vi.fn(async () => undefined),
		getStoredModelConfigs: vi.fn(async () => ({})),
		saveModelConfig: vi.fn(async () => undefined),
		removeModelConfig: vi.fn(async () => undefined),
		isLegacyApiKeyMigrated: vi.fn(() => migrated),
		markLegacyApiKeyMigrated: vi.fn(async () => { migrated = true; }),
	};
}

/** Lets the migration that the constructor starts run to completion. */
function flush(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0));
}

describe('AbstractLanguageModelChatProvider legacy API key migration', () => {
	let logService: TestLogService;

	beforeEach(() => {
		executeCommand.mockReset();
		logService = new TestLogService();
		vi.spyOn(logService, 'error');
	});

	function createProvider(storage: IBYOKStorageService): TestProvider {
		return new TestProvider(storage, logService);
	}

	it('marks the migration and then deletes the stored key once the group was migrated', async () => {
		executeCommand.mockResolvedValue(undefined);
		const storage = createStorage('legacy-key');

		createProvider(storage);
		await flush();

		expect(executeCommand).toHaveBeenCalledTimes(1);
		expect(executeCommand).toHaveBeenCalledWith('lm.migrateLanguageModelsProviderGroup', { vendor: 'anthropic', name: 'Anthropic', apiKey: 'legacy-key' });
		expect(storage.markLegacyApiKeyMigrated).toHaveBeenCalledTimes(1);
		expect(storage.deleteAPIKey).toHaveBeenCalledTimes(1);
		expect(storage.markLegacyApiKeyMigrated.mock.invocationCallOrder[0]).toBeLessThan(storage.deleteAPIKey.mock.invocationCallOrder[0]);
	});

	it('keeps the stored key when the migration fails and migrates again on the next activation', async () => {
		executeCommand.mockRejectedValue(new Error('network unavailable'));
		const storage = createStorage('legacy-key');

		createProvider(storage);
		await flush();

		expect(storage.markLegacyApiKeyMigrated).not.toHaveBeenCalled();
		expect(storage.deleteAPIKey).not.toHaveBeenCalled();
		expect(logService.error).toHaveBeenCalledTimes(1);

		createProvider(storage);
		await flush();

		expect(executeCommand).toHaveBeenCalledTimes(2);
	});

	it('stops migrating without deleting the stored key when a group with the same name exists', async () => {
		executeCommand.mockRejectedValue(new Error('Language model group with name Anthropic already exists for vendor anthropic'));
		const storage = createStorage('legacy-key');

		createProvider(storage);
		await flush();

		expect(storage.markLegacyApiKeyMigrated).toHaveBeenCalledTimes(1);
		expect(storage.deleteAPIKey).not.toHaveBeenCalled();

		createProvider(storage);
		await flush();

		expect(executeCommand).toHaveBeenCalledTimes(1);
	});

	it('never lists models with the stored key and migrates once per instance', async () => {
		let finishMigration: () => void = () => { };
		executeCommand.mockReturnValue(new Promise<void>(resolve => { finishMigration = resolve; }));
		const storage = createStorage('legacy-key');

		const provider = createProvider(storage);
		await provider.provideLanguageModelChatInformation({ silent: true }, CancellationToken.None);
		await flush();

		expect(provider.listedApiKeys).toEqual([undefined]);
		expect(executeCommand).toHaveBeenCalledTimes(1);
		expect(storage.deleteAPIKey).not.toHaveBeenCalled();

		finishMigration();
		await flush();

		expect(storage.deleteAPIKey).toHaveBeenCalledTimes(1);
	});

	it('does nothing when no key is stored', async () => {
		const storage = createStorage(undefined);

		createProvider(storage);
		await flush();

		expect(executeCommand).not.toHaveBeenCalled();
		expect(storage.isLegacyApiKeyMigrated).not.toHaveBeenCalled();
	});
});
