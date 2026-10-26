/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IStringDictionary } from '../../../../base/common/collections.js';
import { PolicyName } from '../../../../base/common/policy.js';
import { AbstractPolicyService, PolicyDefinition, PolicyValue, PolicyValueSource } from '../../common/policy.js';

class TestPolicyService extends AbstractPolicyService {
	update(name: PolicyName, value: PolicyValue | undefined, source: PolicyValueSource | undefined): boolean {
		return this.updatePolicyValue(name, value, source);
	}

	protected async _updatePolicyDefinitions(_policyDefinitions: IStringDictionary<PolicyDefinition>): Promise<void> {
		// no-op: the OS/file watcher is irrelevant for serialization tests
	}
}

interface ControlledPolicyUpdate {
	readonly definitions: IStringDictionary<PolicyDefinition>;
	readonly completion: DeferredPromise<IStringDictionary<PolicyValue>>;
}

class ControlledPolicyService extends AbstractPolicyService {
	readonly updates: ControlledPolicyUpdate[] = [];
	readonly started: DeferredPromise<ControlledPolicyUpdate>[] = [];
	onStart: (() => void) | undefined;

	waitForUpdate(index: number): Promise<ControlledPolicyUpdate> {
		return (this.started[index] ??= new DeferredPromise<ControlledPolicyUpdate>()).p;
	}

	protected override async _updatePolicyDefinitions(definitions: IStringDictionary<PolicyDefinition>): Promise<void> {
		const update = { definitions, completion: new DeferredPromise<IStringDictionary<PolicyValue>>() };
		const index = this.updates.push(update) - 1;
		void (this.started[index] ??= new DeferredPromise<ControlledPolicyUpdate>()).complete(update);
		this.onStart?.();
		this.policies = new Map(Object.entries(await update.completion.p));
	}
}

suite('AbstractPolicyService', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('same definition waits for the pending submission and caches only its success', async () => {
		const service = disposables.add(new ControlledPolicyService());
		const definitions = { Policy: { type: 'string' } satisfies PolicyDefinition };
		const first = service.updatePolicyDefinitions(definitions);
		const update = await service.waitForUpdate(0);
		let secondSettled = false;
		const second = service.updatePolicyDefinitions(definitions).then(result => {
			secondSettled = true;
			return result;
		});
		await Promise.resolve();
		assert.strictEqual(secondSettled, false);
		assert.strictEqual(service.updates.length, 1);

		await update.completion.complete({ Policy: 'applied' });
		assert.deepStrictEqual(await first, { Policy: 'applied' });
		assert.deepStrictEqual(await second, { Policy: 'applied' });
		assert.deepStrictEqual(await service.updatePolicyDefinitions(definitions), { Policy: 'applied' });
		assert.strictEqual(service.updates.length, 1);
	});

	test('same definition shares the original rejection and can be explicitly retried', async () => {
		const service = disposables.add(new ControlledPolicyService());
		const definitions = { Policy: { type: 'string' } satisfies PolicyDefinition };
		const first = service.updatePolicyDefinitions(definitions);
		const update = await service.waitForUpdate(0);
		const second = service.updatePolicyDefinitions(definitions);
		const error = new Error('submission failed');
		const rejections = [first, second].map(promise => assert.rejects(promise, reason => reason === error));
		await update.completion.error(error);
		await Promise.all(rejections);
		assert.strictEqual(service.getPolicyValue('Policy'), undefined);

		const retry = service.updatePolicyDefinitions(definitions);
		await Promise.resolve();
		assert.strictEqual(service.updates.length, 2, 'retry must reach the backend');
		const retried = await service.waitForUpdate(1);
		assert.strictEqual(service.updates.length, 2);
		await retried.completion.complete({ Policy: 'retried' });
		assert.deepStrictEqual(await retry, { Policy: 'retried' });
	});

	test('different definitions follow the in-flight snapshot and finish at the latest value', async () => {
		const service = disposables.add(new ControlledPolicyService());
		const original: PolicyDefinition = { type: 'string', restrictedValue: 'original' };
		const latest: PolicyDefinition = { type: 'string', restrictedValue: 'latest' };
		const first = service.updatePolicyDefinitions({ Policy: original });
		const originalUpdate = await service.waitForUpdate(0);
		const second = service.updatePolicyDefinitions({ Policy: latest });
		assert.strictEqual(service.updates.length, 1, 'the latest update must not run concurrently');
		assert.strictEqual(originalUpdate.definitions['Policy'], original, 'the in-flight snapshot must stay unchanged');

		await originalUpdate.completion.complete({ Policy: 'original' });
		const latestUpdate = await service.waitForUpdate(1);
		assert.strictEqual(latestUpdate.definitions['Policy'], latest);
		await latestUpdate.completion.complete({ Policy: 'latest' });
		assert.deepStrictEqual(await first, { Policy: 'latest' });
		assert.deepStrictEqual(await second, { Policy: 'latest' });
		assert.strictEqual(service.getPolicyValue('Policy'), 'latest');
	});

	test('a failed update does not silently retry a newer queued definition', async () => {
		const service = disposables.add(new ControlledPolicyService());
		const first = service.updatePolicyDefinitions({ Policy: { type: 'string', restrictedValue: 'original' } });
		const update = await service.waitForUpdate(0);
		const latest = { Policy: { type: 'string', restrictedValue: 'latest' } satisfies PolicyDefinition };
		const second = service.updatePolicyDefinitions(latest);
		assert.strictEqual(service.updates.length, 1, 'the queued definition must not start a hidden second attempt');
		const error = new Error('original failed');
		const rejections = [first, second].map(promise => assert.rejects(promise, reason => reason === error));
		await update.completion.error(error);
		await Promise.all(rejections);
		assert.strictEqual(service.updates.length, 1);

		const retry = service.updatePolicyDefinitions(latest);
		await Promise.resolve();
		assert.strictEqual(service.updates.length, 2, 'retry must submit the latest definition');
		const retried = await service.waitForUpdate(1);
		assert.strictEqual(retried.definitions['Policy'], latest.Policy);
		await retried.completion.complete({ Policy: 'latest' });
		assert.deepStrictEqual(await retry, { Policy: 'latest' });
	});

	test('synchronous reentry joins the installed pending submission', async () => {
		const service = disposables.add(new ControlledPolicyService());
		const definitions = { Policy: { type: 'string' } satisfies PolicyDefinition };
		let reentrant: Promise<IStringDictionary<PolicyValue>> | undefined;
		service.onStart = () => {
			service.onStart = undefined;
			reentrant = service.updatePolicyDefinitions(definitions);
		};
		const first = service.updatePolicyDefinitions(definitions);
		const update = await service.waitForUpdate(0);
		assert.ok(reentrant);
		assert.strictEqual(service.updates.length, 1);
		await update.completion.complete({ Policy: 'applied' });
		assert.deepStrictEqual(await first, { Policy: 'applied' });
		assert.deepStrictEqual(await reentrant, { Policy: 'applied' });
	});

	test('serialize() omits the non-cloneable value callback so policiesData can be sent over IPC', async () => {
		const service = new TestPolicyService();

		await service.updatePolicyDefinitions({
			'WithCallback': {
				type: 'boolean',
				value: (policyData) => policyData.chat_preview_features_enabled === false ? false : undefined,
				restrictedValue: false,
			},
			'PlainDefinition': {
				type: 'string',
			}
		});

		const serialized = service.serialize();

		// The callback must not survive serialization...
		assert.strictEqual(typeof serialized['WithCallback'].definition.value, 'undefined');
		// ...while the structured-clone-safe metadata is preserved.
		assert.strictEqual(serialized['WithCallback'].definition.type, 'boolean');
		assert.strictEqual(serialized['WithCallback'].definition.restrictedValue, false);
		assert.strictEqual(serialized['PlainDefinition'].definition.type, 'string');

		// The whole payload must be structured-clone-safe (this is how it is delivered to the
		// renderer as part of the window configuration's policiesData).
		assert.doesNotThrow(() => structuredClone(serialized));

		service.dispose();
	});

	test('tracks value and source changes together', () => {
		const service = new TestPolicyService();
		const states: { changed: boolean; value: PolicyValue | undefined; source: PolicyValueSource | undefined }[] = [];
		const update = (value: PolicyValue | undefined, source: PolicyValueSource | undefined) => {
			const changed = service.update('Policy', value, source);
			states.push({
				changed,
				value: service.getPolicyValue('Policy'),
				source: service.getPolicyValueSource('Policy'),
			});
		};

		update(false, undefined);
		update(false, PolicyValueSource.Account);
		update(false, PolicyValueSource.AccountGate);
		update(false, PolicyValueSource.AccountGate);
		update(undefined, undefined);

		assert.deepStrictEqual(states, [
			{ changed: true, value: false, source: PolicyValueSource.Device },
			{ changed: true, value: false, source: PolicyValueSource.Account },
			{ changed: true, value: false, source: PolicyValueSource.AccountGate },
			{ changed: false, value: false, source: PolicyValueSource.AccountGate },
			{ changed: true, value: undefined, source: undefined },
		]);

		service.dispose();
	});
});
