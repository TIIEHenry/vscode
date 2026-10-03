/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Event } from '../../../../../base/common/event.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { ExtUri } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock, upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { NullTelemetryService } from '../../../../../platform/telemetry/common/telemetryUtils.js';
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { IWorkspaceTrustRequestService } from '../../../../../platform/workspace/common/workspaceTrust.js';
import { IEditorService, ISaveEditorsResult } from '../../../../services/editor/common/editorService.js';
import { TestId } from '../../common/testId.js';
import { MainThreadTestCollection } from '../../common/mainThreadTestCollection.js';
import { TestingConfigKeys } from '../../common/configuration.js';
import { LiveTestResult } from '../../common/testResult.js';
import { ITestResultService } from '../../common/testResultService.js';
import { IMainThreadTestController, ITestService, simplifyTestsToExecute, testsInFile } from '../../common/testService.js';
import { TestService } from '../../common/testServiceImpl.js';
import { ITestProfileService, TestProfileService } from '../../common/testProfileService.js';
import { ResolvedTestRunRequest, TestControllerCapability, TestDiffOpType, TestItemExpandState, TestRunProfileBitset } from '../../common/testTypes.js';
import { TestTestCollection, TestTestItem, getInitializedMainTestCollection, makeSimpleStubTree } from './testStubs.js';
import { TestStorageService, TestWorkspaceTrustRequestService } from '../../../../test/common/workbenchTestServices.js';

suite('Workbench - Test Service', () => {
	const ds = ensureNoDisposablesAreLeakedInTestSuite();

	suite('simplifyTestsToExecute', () => {
		const tree1 = {
			a: {
				b1: {
					c1: {
						d: undefined
					},
					c2: {
						d: undefined
					},
				},
				b2: undefined,
			}
		} as const;

		test('noop on single item', async () => {
			const c = await getInitializedMainTestCollection(makeSimpleStubTree(tree1));

			const t = simplifyTestsToExecute(c, [
				c.getNodeById(new TestId(['ctrlId', 'a', 'b1']).toString())!
			]);

			assert.deepStrictEqual(t.map(t => t.item.extId.toString()), [
				new TestId(['ctrlId', 'a', 'b1']).toString()
			]);
		});

		test('goes to common root 1', async () => {
			const c = await getInitializedMainTestCollection(makeSimpleStubTree(tree1));

			const t = simplifyTestsToExecute(c, [
				c.getNodeById(new TestId(['ctrlId', 'a', 'b1', 'c1', 'd']).toString())!,
				c.getNodeById(new TestId(['ctrlId', 'a', 'b1', 'c2']).toString())!,
			]);

			assert.deepStrictEqual(t.map(t => t.item.extId.toString()), [
				new TestId(['ctrlId', 'a', 'b1']).toString()
			]);
		});

		test('goes to common root 2', async () => {
			const c = await getInitializedMainTestCollection(makeSimpleStubTree(tree1));

			const t = simplifyTestsToExecute(c, [
				c.getNodeById(new TestId(['ctrlId', 'a', 'b1', 'c1']).toString())!,
				c.getNodeById(new TestId(['ctrlId', 'a', 'b1']).toString())!,
			]);

			assert.deepStrictEqual(t.map(t => t.item.extId.toString()), [
				new TestId(['ctrlId', 'a', 'b1']).toString()
			]);
		});

		test('goes to common root 3', async () => {
			const c = await getInitializedMainTestCollection(makeSimpleStubTree(tree1));

			const t = simplifyTestsToExecute(c, [
				c.getNodeById(new TestId(['ctrlId', 'a', 'b1', 'c1', 'd']).toString())!,
				c.getNodeById(new TestId(['ctrlId', 'a', 'b1', 'c2']).toString())!,
			]);

			assert.deepStrictEqual(t.map(t => t.item.extId.toString()), [
				new TestId(['ctrlId', 'a', 'b1']).toString()
			]);
		});

		test('goes to common root 4', async () => {
			const c = await getInitializedMainTestCollection(makeSimpleStubTree(tree1));

			const t = simplifyTestsToExecute(c, [
				c.getNodeById(new TestId(['ctrlId', 'a', 'b2']).toString())!,
				c.getNodeById(new TestId(['ctrlId', 'a', 'b1']).toString())!,
			]);

			assert.deepStrictEqual(t.map(t => t.item.extId.toString()), [
				new TestId(['ctrlId']).toString()
			]);
		});

		test('no-op divergent trees', async () => {
			const c = await getInitializedMainTestCollection(makeSimpleStubTree(tree1));

			const t = simplifyTestsToExecute(c, [
				c.getNodeById(new TestId(['ctrlId', 'a', 'b1', 'c2']).toString())!,
				c.getNodeById(new TestId(['ctrlId', 'a', 'b2']).toString())!,
			]);

			assert.deepStrictEqual(t.map(t => t.item.extId.toString()), [
				new TestId(['ctrlId', 'a', 'b1', 'c2']).toString(),
				new TestId(['ctrlId', 'a', 'b2']).toString(),
			]);
		});
	});

	suite('testsInFile', () => {
		test('canonicalizes URI before comparing with stored test URIs (#275268)', async () => {
			const canonicalUri = URI.from({ scheme: 'vscode-remote', authority: 'wsl+Ubuntu', path: '/home/user/test.py' });
			const rawUri = URI.file('/home/user/test.py');
			const extUri = new ExtUri(() => false);

			// Build a collection where test items are stored with the canonical URI.
			const collection = new TestTestCollection();
			collection.resolveHandler = item => {
				if (item === undefined) {
					collection.root.children.add(new TestTestItem(new TestId(['ctrlId', 'test1']), 'test1', canonicalUri));
				}
			};
			const mainCollection = await getInitializedMainTestCollection(collection);

			// Mock IUriIdentityService: asCanonicalUri maps rawUri to canonicalUri,
			// simulating a remote environment where URI.file() produces a non-canonical form.
			const ident = upcastPartial<IUriIdentityService>({
				asCanonicalUri: (u: URI) => extUri.isEqual(u, rawUri) ? canonicalUri : u,
				extUri,
			});

			const testService = upcastPartial<ITestService>({
				collection: mainCollection,
			});

			const found: string[] = [];
			for await (const batch of testsInFile(testService, ident, rawUri, false)) {
				for (const item of batch) {
					found.push(item.item.extId);
				}
			}

			assert.deepStrictEqual(found, [new TestId(['ctrlId', 'test1']).toString()]);
		});

		test('indexes live diff-added tests by canonical URI and still finds them from raw URI input', async () => {
			const canonicalUri = URI.from({ scheme: 'vscode-remote', authority: 'wsl+Ubuntu', path: '/home/user/test.py' });
			const rawUri = URI.file('/home/user/test.py');
			const extUri = new ExtUri(() => false);

			const collection = new MainThreadTestCollection({
				asCanonicalUri: (u: URI) => u.toString() === rawUri.toString() ? canonicalUri : u,
			}, async () => { });

			const testId = new TestId(['ctrlId', 'test1']).toString();
			collection.apply([
				{
					op: TestDiffOpType.Add,
					item: {
						controllerId: 'ctrlId',
						expand: TestItemExpandState.NotExpandable,
						item: {
							extId: new TestId(['ctrlId']).toString(),
							label: 'root',
							tags: [],
							busy: false,
							uri: undefined,
							range: null,
							description: null,
							error: null,
							sortText: null,
						},
					}
				},
				{
					op: TestDiffOpType.Add,
					item: {
						controllerId: 'ctrlId',
						expand: TestItemExpandState.NotExpandable,
						item: {
							extId: testId,
							label: 'test1',
							tags: [],
							busy: false,
							uri: rawUri,
							range: null,
							description: null,
							error: null,
							sortText: null,
						},
					}
				}
			]);

			const added = collection.getNodeById(testId)!;
			assert.ok(extUri.isEqual(added.item.uri, canonicalUri), 'added test URI should be canonicalized on apply');
			assert.deepStrictEqual([...collection.getNodeByUrl(canonicalUri)].map(t => t.item.extId), [testId]);
			assert.deepStrictEqual([...collection.getNodeByUrl(rawUri)].map(t => t.item.extId), []);

			const ident = upcastPartial<IUriIdentityService>({
				asCanonicalUri: (u: URI) => extUri.isEqual(u, rawUri) ? canonicalUri : u,
				extUri,
			});

			const testService = upcastPartial<ITestService>({
				collection,
			});

			const found: string[] = [];
			for await (const batch of testsInFile(testService, ident, rawUri, false)) {
				for (const item of batch) {
					found.push(item.item.extId);
				}
			}

			assert.deepStrictEqual(found, [testId]);
		});
	});

	suite('runResolvedTests saveAllBeforeTest', () => {
		const defaultReq = (): ResolvedTestRunRequest => ({
			group: TestRunProfileBitset.Run,
			targets: [{
				profileId: 0,
				controllerId: 'ctrlId',
				testIds: ['ctrlId\0test'],
			}],
		});

		function createHarness(options: {
			saveAll?: () => Promise<ISaveEditorsResult>;
			saveBeforeTest?: boolean;
		}) {
			let runTestsCalls = 0;
			const saveAllCalls: unknown[] = [];

			class MockEditorService extends mock<IEditorService>() {
				override readonly onDidActiveEditorChange = Event.None;

				override saveAll() {
					saveAllCalls.push(1);
					return options.saveAll?.() ?? Promise.resolve({ success: true, editors: [] });
				}
			}

			class MockTestResultService extends mock<ITestResultService>() {
				override createLiveResult(req: ResolvedTestRunRequest) {
					return ds.add(new LiveTestResult('run-id', false, req, 0, NullTelemetryService));
				}
			}

			const configurationService = new TestConfigurationService({
				[TestingConfigKeys.SaveBeforeTest]: options.saveBeforeTest ?? true,
			});
			ds.add({ dispose: () => configurationService.onDidChangeConfigurationEmitter.dispose() });

			const instantiationService = ds.add(new TestInstantiationService());
			instantiationService.stub(IConfigurationService, configurationService);
			instantiationService.stub(IEditorService, new MockEditorService());
			instantiationService.stub(IWorkspaceTrustRequestService, ds.add(new TestWorkspaceTrustRequestService(true)));
			instantiationService.stub(INotificationService, upcastPartial<INotificationService>({}));
			instantiationService.stub(ITestResultService, new MockTestResultService());
			instantiationService.stub(IUriIdentityService, upcastPartial<IUriIdentityService>({
				asCanonicalUri: (u: URI) => u,
				extUri: new ExtUri(() => false),
			}));
			instantiationService.stub(IContextKeyService, ds.add(new MockContextKeyService()));
			instantiationService.stub(IStorageService, ds.add(new TestStorageService()));
			instantiationService.stub(ITestProfileService, ds.add(new TestProfileService(
				ds.add(new MockContextKeyService()),
				ds.add(new TestStorageService()),
			)));

			const testService = ds.add(instantiationService.createInstance(TestService));

			const controller = upcastPartial<IMainThreadTestController>({
				id: 'ctrlId',
				capabilities: observableValue<TestControllerCapability>('ctrlId.cap', 0 as TestControllerCapability),
				runTests: () => {
					runTestsCalls++;
					return Promise.resolve([]);
				},
			});
			ds.add(testService.registerTestController('ctrlId', controller));

			return { testService, runTestsCalls: () => runTestsCalls, saveAllCalls: () => saveAllCalls.length };
		}

		test('waits for saveAll before runTests', async () => {
			const saveAllDeferred = new DeferredPromise<ISaveEditorsResult>();
			ds.add({ dispose: () => saveAllDeferred.cancel() });
			const { testService, runTestsCalls, saveAllCalls } = createHarness({
				saveAll: () => saveAllDeferred.p,
			});

			const run = testService.runResolvedTests(defaultReq(), CancellationToken.None);
			await Promise.resolve();
			assert.strictEqual(runTestsCalls(), 0);
			assert.strictEqual(saveAllCalls(), 1);

			saveAllDeferred.complete({ success: true, editors: [] });
			await run;
			assert.strictEqual(runTestsCalls(), 1);
		});

		test('does not runTests when saveAll resolves success false', async () => {
			const { testService, runTestsCalls, saveAllCalls } = createHarness({
				saveAll: () => Promise.resolve({ success: false, editors: [] }),
			});

			await testService.runResolvedTests(defaultReq(), CancellationToken.None);
			assert.strictEqual(saveAllCalls(), 1);
			assert.strictEqual(runTestsCalls(), 0);
		});

		test('does not runTests when saveAll rejects', async () => {
			const { testService, runTestsCalls, saveAllCalls } = createHarness({
				saveAll: () => Promise.reject(new Error('save failed')),
			});

			await testService.runResolvedTests(defaultReq(), CancellationToken.None);
			assert.strictEqual(saveAllCalls(), 1);
			assert.strictEqual(runTestsCalls(), 0);
		});

		test('preserveFocus skips saveAll and still runTests', async () => {
			const { testService, runTestsCalls, saveAllCalls } = createHarness({});

			await testService.runResolvedTests({ ...defaultReq(), preserveFocus: true }, CancellationToken.None);
			assert.strictEqual(saveAllCalls(), 0);
			assert.strictEqual(runTestsCalls(), 1);
		});

		test('saveBeforeTest false skips saveAll and still runTests', async () => {
			const { testService, runTestsCalls, saveAllCalls } = createHarness({ saveBeforeTest: false });

			await testService.runResolvedTests(defaultReq(), CancellationToken.None);
			assert.strictEqual(saveAllCalls(), 0);
			assert.strictEqual(runTestsCalls(), 1);
		});
	});
});
