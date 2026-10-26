/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise, timeout } from '../../../../base/common/async.js';
import { IStringDictionary } from '../../../../base/common/collections.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { isWeb } from '../../../../base/common/platform.js';
import { URI } from '../../../../base/common/uri.js';
import { DefaultConfiguration, PolicyConfiguration } from '../../common/configurations.js';
import { IFileService } from '../../../files/common/files.js';
import { FileService } from '../../../files/common/fileService.js';
import { InMemoryFileSystemProvider } from '../../../files/common/inMemoryFilesystemProvider.js';
import { NullLogService } from '../../../log/common/log.js';
import { Extensions, IConfigurationNode, IConfigurationRegistry } from '../../common/configurationRegistry.js';
import { Registry } from '../../../registry/common/platform.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { deepClone } from '../../../../base/common/objects.js';
import { IPolicyService, PolicyDefinition, PolicyValue, PolicyValueSource } from '../../../policy/common/policy.js';
import { FilePolicyService } from '../../../policy/common/filePolicyService.js';
import { runWithFakedTimers } from '../../../../base/test/common/timeTravelScheduler.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { PolicyCategory } from '../../../../base/common/policy.js';

suite('PolicyConfiguration', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	let testObject: PolicyConfiguration;
	let fileService: IFileService;
	let policyService: IPolicyService;
	const policyFile = URI.file('policyFile').with({ scheme: 'vscode-tests' });
	const policyConfigurationNode: IConfigurationNode = {
		'id': 'policyConfiguration',
		'order': 1,
		'title': 'a',
		'type': 'object',
		'properties': {
			'policy.settingA': {
				'type': 'string',
				'default': 'defaultValueA',
				policy: {
					name: 'PolicySettingA',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.0.0',
					localization: { description: { key: '', value: '' }, }
				}
			},
			'policy.settingB': {
				'type': 'string',
				'default': 'defaultValueB',
				policy: {
					name: 'PolicySettingB',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.0.0',
					localization: { description: { key: '', value: '' }, }
				}
			},
			'policy.objectSetting': {
				'type': 'object',
				'default': {},
				policy: {
					name: 'PolicyObjectSetting',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.0.0',
					localization: { description: { key: '', value: '' }, }
				}
			},
			'policy.arraySetting': {
				'type': 'object',
				'default': [],
				policy: {
					name: 'PolicyArraySetting',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.0.0',
					localization: { description: { key: '', value: '' }, }
				}
			},
			'policy.booleanSetting': {
				'type': 'boolean',
				'default': true,
				policy: {
					name: 'PolicyBooleanSetting',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.0.0',
					localization: { description: { key: '', value: '' }, }
				}
			},
			'policy.internalSetting': {
				'type': 'string',
				'default': 'defaultInternalValue',
				included: false,
				policy: {
					name: 'PolicyInternalSetting',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.0.0',
					localization: { description: { key: '', value: '' }, }
				}
			},
			'policy.ownerSetting': {
				'type': 'boolean',
				'default': true,
				policy: {
					name: 'PolicyShared',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.0.0',
					restrictedValue: true,
					localization: { description: { key: 'shared.owner', value: '' }, }
				}
			},
			'policy.referenceSetting': {
				'type': 'boolean',
				'default': true,
				policyReference: {
					name: 'PolicyShared',
				}
			},
			'policy.orphanReferenceSetting': {
				'type': 'boolean',
				'default': true,
				policyReference: {
					name: 'PolicyOrphanReference',
				}
			},
			'nonPolicy.setting': {
				'type': 'boolean',
				'default': true
			}
		}
	};

	suiteSetup(() => Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration(policyConfigurationNode));
	suiteTeardown(() => Registry.as<IConfigurationRegistry>(Extensions.Configuration).deregisterConfigurations([policyConfigurationNode]));

	setup(async () => {
		const defaultConfiguration = disposables.add(new DefaultConfiguration(new NullLogService()));
		await defaultConfiguration.initialize();
		fileService = disposables.add(new FileService(new NullLogService()));
		const diskFileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
		disposables.add(fileService.registerProvider(policyFile.scheme, diskFileSystemProvider));
		policyService = disposables.add(new FilePolicyService(policyFile, fileService, new NullLogService()));
		testObject = disposables.add(new PolicyConfiguration(defaultConfiguration, policyService, new NullLogService()));
	});

	test('initialize: with policies', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicySettingA': 'policyValueA' })));

		await testObject.initialize();
		const acutal = testObject.configurationModel;

		assert.strictEqual(acutal.getValue('policy.settingA'), 'policyValueA');
		assert.strictEqual(acutal.getValue('policy.settingB'), undefined);
		assert.strictEqual(acutal.getValue('nonPolicy.setting'), undefined);
		assert.deepStrictEqual(acutal.keys, ['policy.settingA']);
		assert.deepStrictEqual(acutal.overrides, []);
	});

	test('initialize: no policies', async () => {
		await testObject.initialize();
		const acutal = testObject.configurationModel;

		assert.deepStrictEqual(acutal.keys, []);
		assert.deepStrictEqual(acutal.overrides, []);
		assert.strictEqual(acutal.getValue('policy.settingA'), undefined);
		assert.strictEqual(acutal.getValue('policy.settingB'), undefined);
		assert.strictEqual(acutal.getValue('nonPolicy.setting'), undefined);
	});

	test('initialize: with policies but not registered', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicySettingA': 'policyValueA', 'PolicySettingB': 'policyValueB', 'PolicySettingC': 'policyValueC' })));

		await testObject.initialize();
		const acutal = testObject.configurationModel;

		assert.strictEqual(acutal.getValue('policy.settingA'), 'policyValueA');
		assert.strictEqual(acutal.getValue('policy.settingB'), 'policyValueB');
		assert.strictEqual(acutal.getValue('nonPolicy.setting'), undefined);
		assert.deepStrictEqual(acutal.keys, ['policy.settingA', 'policy.settingB']);
		assert.deepStrictEqual(acutal.overrides, []);
	});

	test('initialize: with object type policy', async () => {
		const expected = {
			'microsoft': true,
			'github': 'stable',
			'other': 1,
			'complex': {
				'key': 'value'
			},
			'array': [1, 2, 3]
		};
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicyObjectSetting': JSON.stringify(expected) })));

		await testObject.initialize();
		const acutal = testObject.configurationModel;

		assert.deepStrictEqual(acutal.getValue('policy.objectSetting'), expected);
	});

	test('initialize: with array type policy', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicyArraySetting': JSON.stringify([1]) })));

		await testObject.initialize();
		const acutal = testObject.configurationModel;

		assert.deepStrictEqual(acutal.getValue('policy.arraySetting'), [1]);
	});

	test('initialize: with boolean type policy as false', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicyBooleanSetting': false })));

		await testObject.initialize();
		const acutal = testObject.configurationModel;

		assert.deepStrictEqual(acutal.getValue('policy.booleanSetting'), false);
	});

	test('initialize: with boolean type policy as true', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicyBooleanSetting': true })));

		await testObject.initialize();
		const acutal = testObject.configurationModel;

		assert.deepStrictEqual(acutal.getValue('policy.booleanSetting'), true);
	});

	test('initialize: with object type policy ignores policy if value is not valid', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicyObjectSetting': '{"a": "b", "hello": }' })));

		await testObject.initialize();
		const acutal = testObject.configurationModel;

		assert.deepStrictEqual(acutal.getValue('policy.objectSetting'), undefined);
	});

	test('initialize: with object type policy ignores policy if there are duplicate keys', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicyObjectSetting': '{"microsoft": true, "microsoft": false }' })));

		await testObject.initialize();
		const acutal = testObject.configurationModel;

		assert.deepStrictEqual(acutal.getValue('policy.objectSetting'), undefined);
	});

	test('change: when policy is added', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicySettingA': 'policyValueA' })));
		await testObject.initialize();

		await runWithFakedTimers({ useFakeTimers: true }, async () => {
			const promise = Event.toPromise(testObject.onDidChangeConfiguration);
			await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicySettingA': 'policyValueA', 'PolicySettingB': 'policyValueB', 'PolicySettingC': 'policyValueC' })));
			await promise;
		});

		const acutal = testObject.configurationModel;
		assert.strictEqual(acutal.getValue('policy.settingA'), 'policyValueA');
		assert.strictEqual(acutal.getValue('policy.settingB'), 'policyValueB');
		assert.strictEqual(acutal.getValue('nonPolicy.setting'), undefined);
		assert.deepStrictEqual(acutal.keys, ['policy.settingA', 'policy.settingB']);
		assert.deepStrictEqual(acutal.overrides, []);
	});

	test('change: when policy is updated', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicySettingA': 'policyValueA' })));
		await testObject.initialize();

		await runWithFakedTimers({ useFakeTimers: true }, async () => {
			const promise = Event.toPromise(testObject.onDidChangeConfiguration);
			await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicySettingA': 'policyValueAChanged' })));
			await promise;
		});

		const acutal = testObject.configurationModel;
		assert.strictEqual(acutal.getValue('policy.settingA'), 'policyValueAChanged');
		assert.strictEqual(acutal.getValue('policy.settingB'), undefined);
		assert.strictEqual(acutal.getValue('nonPolicy.setting'), undefined);
		assert.deepStrictEqual(acutal.keys, ['policy.settingA']);
		assert.deepStrictEqual(acutal.overrides, []);
	});

	test('change: when policy is removed', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicySettingA': 'policyValueA' })));
		await testObject.initialize();

		await runWithFakedTimers({ useFakeTimers: true }, async () => {
			const promise = Event.toPromise(testObject.onDidChangeConfiguration);
			await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({})));
			await promise;
		});

		const acutal = testObject.configurationModel;
		assert.strictEqual(acutal.getValue('policy.settingA'), undefined);
		assert.strictEqual(acutal.getValue('policy.settingB'), undefined);
		assert.strictEqual(acutal.getValue('nonPolicy.setting'), undefined);
		assert.deepStrictEqual(acutal.keys, []);
		assert.deepStrictEqual(acutal.overrides, []);
	});

	test('initialize: an owning policy applies to both the owner and its references', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicyShared': false })));

		await testObject.initialize();
		const actual = testObject.configurationModel;

		assert.strictEqual(actual.getValue('policy.ownerSetting'), false);
		assert.strictEqual(actual.getValue('policy.referenceSetting'), false);
		assert.deepStrictEqual([...actual.keys].sort(), ['policy.ownerSetting', 'policy.referenceSetting']);
	});

	test('initialize: a reference resolves even when its owner is not registered', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicyOrphanReference': false })));

		await testObject.initialize();
		const actual = testObject.configurationModel;

		assert.strictEqual(actual.getValue('policy.orphanReferenceSetting'), false);
		assert.deepStrictEqual(actual.keys, ['policy.orphanReferenceSetting']);
	});

	test('initialize: the owner definition is authoritative; a reference only contributes the policy name', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicyShared': false })));

		await testObject.initialize();

		// The owner declares restrictedValue; the reference is a pure pointer. The registered
		// definition must be the owner's.
		const definition = policyService.policyDefinitions['PolicyShared'];
		assert.strictEqual(definition?.type, 'boolean');
		assert.strictEqual(definition?.restrictedValue, true);
	});

	test('change: a late-registering owner supersedes an earlier reference definition', async () => {
		// Only the reference for `PolicyOrphanReference` is registered initially (models the editor
		// window: the agent-host reference loads eagerly while the extension policy owner loads later).
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicyOrphanReference': false })));
		await testObject.initialize();

		// The synthesized reference definition carries no restrictedValue.
		assert.strictEqual(testObject.configurationModel.getValue('policy.orphanReferenceSetting'), false);
		assert.strictEqual(policyService.policyDefinitions['PolicyOrphanReference']?.restrictedValue, undefined);

		const ownerNode: IConfigurationNode = {
			'id': '_test_late_owner',
			'type': 'object',
			'properties': {
				'policy.lateOwner': {
					'type': 'boolean',
					'default': true,
					policy: {
						name: 'PolicyOrphanReference',
						category: PolicyCategory.Extensions,
						minimumVersion: '1.0.0',
						restrictedValue: true,
						localization: { description: { key: 'late.owner', value: '' }, }
					}
				}
			}
		};

		try {
			const promise = Event.toPromise(testObject.onDidChangeConfiguration);
			Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration(ownerNode);
			await promise;

			// The owner's definition (with restrictedValue) must now supersede the reference's, and
			// both settings remain gated by the same policy value.
			assert.strictEqual(policyService.policyDefinitions['PolicyOrphanReference']?.restrictedValue, true);
			assert.strictEqual(testObject.configurationModel.getValue('policy.lateOwner'), false);
			assert.strictEqual(testObject.configurationModel.getValue('policy.orphanReferenceSetting'), false);
		} finally {
			Registry.as<IConfigurationRegistry>(Extensions.Configuration).deregisterConfigurations([ownerNode]);
		}
	});

	test('change: deregistering the owner falls back to a surviving reference definition', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicyOrphanReference': false })));
		await testObject.initialize();

		const ownerNode: IConfigurationNode = {
			'id': '_test_owner_removal',
			'type': 'object',
			'properties': {
				'policy.removableOwner': {
					'type': 'boolean',
					'default': true,
					policy: {
						name: 'PolicyOrphanReference',
						category: PolicyCategory.Extensions,
						minimumVersion: '1.0.0',
						restrictedValue: true,
						localization: { description: { key: 'removable.owner', value: '' }, }
					}
				}
			}
		};
		const registry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);

		let promise = Event.toPromise(testObject.onDidChangeConfiguration);
		registry.registerConfiguration(ownerNode);
		await promise;
		assert.strictEqual(policyService.policyDefinitions['PolicyOrphanReference']?.restrictedValue, true);

		// Removing the owner must re-resolve the policy and fall back to the surviving reference,
		// so the owner-only restrictedValue no longer applies.
		promise = Event.toPromise(testObject.onDidChangeConfiguration);
		registry.deregisterConfigurations([ownerNode]);
		await promise;
		assert.strictEqual(policyService.policyDefinitions['PolicyOrphanReference']?.restrictedValue, undefined);
		assert.strictEqual(testObject.configurationModel.getValue('policy.orphanReferenceSetting'), false);
	});

	test('change: an owning policy update propagates to both the owner and its references', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicyShared': false })));
		await testObject.initialize();

		await runWithFakedTimers({ useFakeTimers: true }, async () => {
			const promise = Event.toPromise(testObject.onDidChangeConfiguration);
			await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({})));
			await promise;
		});

		const acutal = testObject.configurationModel;
		assert.strictEqual(acutal.getValue('policy.ownerSetting'), undefined);
		assert.strictEqual(acutal.getValue('policy.referenceSetting'), undefined);
	});

	test('change: when policy setting is registered', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicySettingC': 'policyValueC' })));
		await testObject.initialize();

		const promise = Event.toPromise(testObject.onDidChangeConfiguration);
		policyConfigurationNode.properties!['policy.settingC'] = {
			'type': 'string',
			'default': 'defaultValueC',
			policy: {
				name: 'PolicySettingC',
				category: PolicyCategory.Extensions,
				minimumVersion: '1.0.0',
				localization: { description: { key: '', value: '' }, },
			}
		};
		Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration(deepClone(policyConfigurationNode));
		await promise;

		const acutal = testObject.configurationModel;
		assert.strictEqual(acutal.getValue('policy.settingC'), 'policyValueC');
		assert.strictEqual(acutal.getValue('policy.settingA'), undefined);
		assert.strictEqual(acutal.getValue('policy.settingB'), undefined);
		assert.strictEqual(acutal.getValue('nonPolicy.setting'), undefined);
		assert.deepStrictEqual(acutal.keys, ['policy.settingC']);
		assert.deepStrictEqual(acutal.overrides, []);
	});

	test('change: when policy setting is deregistered', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicySettingA': 'policyValueA' })));
		await testObject.initialize();

		const promise = Event.toPromise(testObject.onDidChangeConfiguration);
		Registry.as<IConfigurationRegistry>(Extensions.Configuration).deregisterConfigurations([policyConfigurationNode]);
		await promise;

		const acutal = testObject.configurationModel;
		assert.strictEqual(acutal.getValue('policy.settingA'), undefined);
		assert.strictEqual(acutal.getValue('policy.settingB'), undefined);
		assert.strictEqual(acutal.getValue('nonPolicy.setting'), undefined);
		assert.deepStrictEqual(acutal.keys, []);
		assert.deepStrictEqual(acutal.overrides, []);
	});

	test('initialize: with internal policies', async () => {
		await fileService.writeFile(policyFile, VSBuffer.fromString(JSON.stringify({ 'PolicyInternalSetting': 'internalValue' })));

		await testObject.initialize();
		const acutal = testObject.configurationModel;

		assert.strictEqual(acutal.getValue('policy.settingA'), undefined);
		assert.strictEqual(acutal.getValue('policy.settingB'), undefined);
		assert.strictEqual(acutal.getValue('policy.internalSetting'), 'internalValue');
		assert.strictEqual(acutal.getValue('nonPolicy.setting'), undefined);
		assert.deepStrictEqual(acutal.keys, ['policy.internalSetting']);
		assert.deepStrictEqual(acutal.overrides, []);
	});

});

const submissionPolicyName = 'PolicySubmissionLifecycle';
const submissionSettingKey = 'policy.submissionLifecycle';

interface PolicySubmission {
	readonly definitions: IStringDictionary<PolicyDefinition>;
	readonly completion: DeferredPromise<IStringDictionary<PolicyValue>>;
}

/** Implements the public contract directly so caller tests do not depend on AbstractPolicyService. */
class SubmissionPolicyService implements IPolicyService {
	declare readonly _serviceBrand: undefined;
	readonly policyDefinitions: IStringDictionary<PolicyDefinition> = {};
	readonly changes = new Emitter<readonly string[]>();
	registrations = 0;
	readonly onDidChange: Event<readonly string[]> = (listener, thisArgs, disposables) => {
		this.registrations++;
		return this.changes.event(listener, thisArgs, disposables);
	};
	readonly updates: PolicySubmission[] = [];
	private readonly started: DeferredPromise<PolicySubmission>[] = [];
	private values: IStringDictionary<PolicyValue> = {};

	waitForUpdate(index: number): Promise<PolicySubmission> {
		return (this.started[index] ??= new DeferredPromise<PolicySubmission>()).p;
	}

	async updatePolicyDefinitions(definitions: IStringDictionary<PolicyDefinition>): Promise<IStringDictionary<PolicyValue>> {
		// Other suites can register unrelated definitions in the shared registry.
		// Only this suite's policy is held at the controlled backend boundary.
		if (definitions[submissionPolicyName]) {
			const update = { definitions: { ...definitions }, completion: new DeferredPromise<IStringDictionary<PolicyValue>>() };
			const index = this.updates.push(update) - 1;
			void (this.started[index] ??= new DeferredPromise<PolicySubmission>()).complete(update);
			this.values = await update.completion.p;
		}
		Object.assign(this.policyDefinitions, definitions);
		return { ...this.values };
	}

	getPolicyValue(name: string): PolicyValue | undefined {
		return this.values[name];
	}

	getPolicyValueSource(name: string): PolicyValueSource | undefined {
		return this.values[name] === undefined ? undefined : PolicyValueSource.Device;
	}

	serialize(): undefined {
		return undefined;
	}
}

class SubmissionLogService extends NullLogService {
	readonly errors: { message: string | Error; args: unknown[] }[] = [];

	override error(message: string | Error, ...args: unknown[]): void {
		this.errors.push({ message, args });
	}
}

suite('PolicyConfiguration submission lifecycle', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	const registry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
	let service: SubmissionPolicyService;
	let configuration: PolicyConfiguration;
	let logService: SubmissionLogService;
	let node: IConfigurationNode;

	setup(async () => {
		node = {
			id: 'policySubmissionLifecycle',
			type: 'object',
			properties: {
				[submissionSettingKey]: {
					type: 'boolean', default: false,
					policy: {
						name: submissionPolicyName, category: PolicyCategory.Extensions, minimumVersion: '1.0.0',
						restrictedValue: true, localization: { description: { key: '', value: '' } },
					},
				},
			},
		};
		registry.registerConfiguration(node);
		const defaults = disposables.add(new DefaultConfiguration(new NullLogService()));
		await defaults.initialize();
		service = new SubmissionPolicyService();
		logService = new SubmissionLogService();
		configuration = disposables.add(new PolicyConfiguration(defaults, service, logService));
		disposables.add(service.changes);
		// Deregister after the configurations and their registry listeners are disposed.
		disposables.add(toDisposable(() => registry.deregisterConfigurations([node])));
	});

	function setRestrictedValue(value: boolean, notify = false): void {
		const property = node.properties![submissionSettingKey];
		property.policy = { ...property.policy!, restrictedValue: value };
		if (notify) {
			registry.updateConfigurations({ remove: [node], add: [node] });
		}
	}

	test('same definition shares pending initialization and installs listeners once', async () => {
		const first = configuration.initialize();
		const update = await service.waitForUpdate(0);
		let secondSettled = false;
		const second = configuration.initialize().then(result => {
			secondSettled = true;
			return result;
		});
		// The backend remains gated while all already queued initialization continuations run.
		await timeout(0);
		assert.strictEqual(secondSettled, false);
		assert.strictEqual(service.updates.length, 1);
		await update.completion.complete({ [submissionPolicyName]: true });
		await Promise.all([first, second]);
		assert.strictEqual(configuration.configurationModel.getValue(submissionSettingKey), true);
		assert.strictEqual(service.registrations, 1);

		const changed = Event.toPromise(configuration.onDidChangeConfiguration);
		setRestrictedValue(false, true);
		const next = await service.waitForUpdate(1);
		await next.completion.complete({ [submissionPolicyName]: false });
		await changed;
		assert.strictEqual(service.updates.length, 2);
		configuration.dispose();
		assert.strictEqual(service.changes.hasListeners(), false);
		setRestrictedValue(true, true);
		await timeout(0);
		assert.strictEqual(service.updates.length, 2, 'disposed configuration must not submit another definition');
	});

	test('failed initialization preserves the original rejection and retries the same definition', async () => {
		const first = configuration.initialize();
		const update = await service.waitForUpdate(0);
		const second = configuration.initialize();
		const error = new Error('policy backend failed');
		const rejections = [first, second].map(promise => assert.rejects(promise, (reason: unknown) => reason === error));
		await update.completion.error(error);
		await Promise.all(rejections);
		assert.strictEqual(service.registrations, 0);

		const retry = configuration.initialize();
		await timeout(0);
		assert.strictEqual(service.updates.length, 2, 'the caller must not suppress the same definition after failure');
		const retried = await service.waitForUpdate(1);
		await retried.completion.complete({ [submissionPolicyName]: true });
		await retry;
		assert.strictEqual(configuration.configurationModel.getValue(submissionSettingKey), true);
		assert.strictEqual(service.registrations, 1);
	});

	test('returning to a successful definition while a newer one is pending resubmits it', async () => {
		const initial = configuration.initialize();
		await (await service.waitForUpdate(0)).completion.complete({ [submissionPolicyName]: true });
		await initial;
		setRestrictedValue(false);
		const second = configuration.initialize();
		const secondUpdate = await service.waitForUpdate(1);
		setRestrictedValue(true);
		const latest = configuration.initialize();
		assert.strictEqual(service.updates.length, 2, 'submissions must stay serial');
		assert.strictEqual(secondUpdate.definitions[submissionPolicyName].restrictedValue, false);

		await secondUpdate.completion.complete({ [submissionPolicyName]: false });
		const latestUpdate = await service.waitForUpdate(2);
		assert.strictEqual(latestUpdate.definitions[submissionPolicyName].restrictedValue, true);
		await latestUpdate.completion.complete({ [submissionPolicyName]: true });
		await Promise.all([second, latest]);
		assert.strictEqual(configuration.configurationModel.getValue(submissionSettingKey), true);
		assert.strictEqual(service.policyDefinitions[submissionPolicyName].restrictedValue, true);
	});

	test('dynamic submission failure is logged and the same registry definition can be retried', async () => {
		const initial = configuration.initialize();
		await (await service.waitForUpdate(0)).completion.complete({ [submissionPolicyName]: true });
		await initial;
		const unhandled: unknown[] = [];
		const onUnhandled = (reason: unknown) => unhandled.push(reason);
		const onBrowserUnhandled = (event: PromiseRejectionEvent) => onUnhandled(event.reason);
		if (isWeb) {
			globalThis.addEventListener('unhandledrejection', onBrowserUnhandled);
		} else {
			process.on('unhandledRejection', onUnhandled);
		}
		try {
			setRestrictedValue(false, true);
			const update = await service.waitForUpdate(1);
			const error = new Error('dynamic policy update failed');
			await update.completion.error(error);
			await timeout(0);
			assert.deepStrictEqual(unhandled, []);
			assert.strictEqual(logService.errors.length, 1);
			assert.strictEqual(logService.errors[0].args[0], error);
			assert.strictEqual(configuration.configurationModel.getValue(submissionSettingKey), true);
			assert.strictEqual(service.updates.length, 2, 'failure must not trigger a hidden retry');

			const changed = Event.toPromise(configuration.onDidChangeConfiguration);
			setRestrictedValue(false, true);
			await timeout(0);
			assert.strictEqual(service.updates.length, 3, 'the next same-definition event must reach the backend');
			const retried = await service.waitForUpdate(2);
			await retried.completion.complete({ [submissionPolicyName]: false });
			await changed;
			assert.strictEqual(configuration.configurationModel.getValue(submissionSettingKey), false);
		} finally {
			if (isWeb) {
				globalThis.removeEventListener('unhandledrejection', onBrowserUnhandled);
			} else {
				process.off('unhandledRejection', onUnhandled);
			}
		}
	});
});
