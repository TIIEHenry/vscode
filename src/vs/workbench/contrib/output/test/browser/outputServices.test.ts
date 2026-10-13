/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { IFileDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IFileService, IFileStatWithMetadata } from '../../../../../platform/files/common/files.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { ILogService, ILoggerService, LogLevel } from '../../../../../platform/log/common/log.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { ILifecycleService } from '../../../../services/lifecycle/common/lifecycle.js';
import { IDefaultLogLevelsService } from '../../../../services/log/common/defaultLogLevels.js';
import { Extensions, IOutputChannelRegistry } from '../../../../services/output/common/output.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { TestLifecycleService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { DelegatedOutputChannelModel, FileOutputChannelModel, MultiFileOutputChannelModel } from '../../common/outputChannelModel.js';
import { OutputLinkProvider } from '../../browser/outputLinkProvider.js';
import { OutputService } from '../../browser/outputServices.js';

suite('OutputService - output folder creation', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('creates the output folder again after the first createFolder rejection', async () => {
		const registry = Registry.as<IOutputChannelRegistry>(Extensions.OutputChannels);
		const createdIds: string[] = [];
		const lifecycleService = disposables.add(new TestLifecycleService());
		const storageService = disposables.add(new TestStorageService());
		const instantiationService = disposables.add(new TestInstantiationService());
		const folderPromises: Promise<unknown>[] = [];
		const resources: URI[] = [];
		let attempts = 0;
		let rejectFirst: (error: Error) => void = () => {
			throw new Error('output folder creation was not started');
		};
		const model = { dispose() { }, onDispose: Event.None };

		instantiationService.stub(ILifecycleService, lifecycleService);
		instantiationService.stub(IStorageService, storageService);
		instantiationService.stub(IContextKeyService, new MockContextKeyService());
		instantiationService.stub(ITextModelService, {
			registerTextModelContentProvider: () => ({ dispose() { } }),
		});
		instantiationService.stub(ILogService, { error() { } });
		instantiationService.stub(ILoggerService, {
			onDidChangeLogLevel: Event.None,
			getLogLevel: () => LogLevel.Info,
			setLogLevel() { },
		});
		instantiationService.stub(IViewsService, {
			onDidChangeViewVisibility: Event.None,
			getActiveViewWithId: () => null,
			isViewVisible: () => false,
			openView: async () => null,
		});
		instantiationService.stub(IDefaultLogLevelsService, {
			onDidChangeDefaultLogLevels: Event.None,
			getDefaultLogLevel: () => LogLevel.Info,
		});
		instantiationService.stub(IFileDialogService, {});
		instantiationService.stub(IWorkbenchEnvironmentService, {
			windowLogsPath: URI.file('/tmp/output-folder-retry'),
		});
		instantiationService.stub(ILanguageService, {
			createById: () => ({ languageId: 'plaintext', onDidChange: Event.None }),
			createByMimeType: () => ({ languageId: 'plaintext', onDidChange: Event.None }),
		});
		instantiationService.stub(IFileService, {
			createFolder: (resource: URI): Promise<IFileStatWithMetadata> => {
				attempts++;
				resources.push(resource);
				if (attempts === 1) {
					return new Promise<IFileStatWithMetadata>((_resolve, reject) => {
						rejectFirst = reject;
					});
				}
				return Promise.resolve(undefined as unknown as IFileStatWithMetadata);
			},
		});
		instantiationService.stubInstance(OutputLinkProvider, { dispose() { } });
		instantiationService.stubInstance(DelegatedOutputChannelModel, model);
		instantiationService.stubInstance(FileOutputChannelModel, model);
		instantiationService.stubInstance(MultiFileOutputChannelModel, model);

		const originalCreate = instantiationService.createInstance.bind(instantiationService);
		instantiationService.createInstance = ((ctor: unknown, ...args: unknown[]) => {
			if (typeof ctor === 'function' && ctor.name === 'OutputChannel' && args[2] instanceof Promise) {
				folderPromises.push(args[2]);
			}
			return originalCreate(ctor as never, ...args as never[]);
		}) as typeof instantiationService.createInstance;

		const outputService = disposables.add(instantiationService.createInstance(OutputService));
		const suffix = `${Date.now()}`;
		const register = (name: string) => {
			const id = `output-folder-retry-${name}-${suffix}`;
			createdIds.push(id);
			registry.registerChannel({ id, label: name, log: false });
		};

		try {
			if (attempts === 0) {
				register('first');
			}
			assert.strictEqual(attempts, 1, 'first output channel should create the folder once');
			assert.ok(folderPromises.length >= 1);
			const failed = folderPromises[0];
			assert.ok(folderPromises.every(promise => promise === failed), 'in-flight channels must share the creation promise');

			register('while-pending');
			assert.strictEqual(attempts, 1, 'a second channel must not create the folder while the first attempt is pending');
			assert.ok(folderPromises.every(promise => promise === failed));

			const failure = failed.then(() => {
				throw new Error('output folder creation should reject');
			}, (error: unknown) => error);
			rejectFirst(new Error('create-output-folder-failed'));
			const error = await failure;
			assert.ok(error instanceof Error);
			assert.strictEqual(error.message, 'create-output-folder-failed');
			await new Promise(resolve => setTimeout(resolve, 0));

			const promisesBeforeRetry = folderPromises.length;
			register('retry');
			assert.strictEqual(attempts, 2, 'the next channel should create the folder again after rejection');
			assert.ok(folderPromises.length > promisesBeforeRetry);
			const retried = folderPromises[folderPromises.length - 1];
			assert.notStrictEqual(retried, failed);
			await retried;
			assert.strictEqual(resources[0].toString(), resources[1].toString());

			const attemptsAfterSuccess = attempts;
			register('after-success');
			assert.strictEqual(attempts, attemptsAfterSuccess, 'a successful creation stays cached');
		} finally {
			outputService.dispose();
			for (const id of createdIds) {
				registry.removeChannel(id);
			}
		}
	});
});
