/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ExtensionRecommendation, ExtensionRecommendations } from '../../browser/extensionRecommendations.js';

class TestExtensionRecommendations extends ExtensionRecommendations {

	readonly recommendations: ReadonlyArray<ExtensionRecommendation> = [];
	doActivateCalls = 0;
	private failure: Error | undefined;
	private gate: Promise<void> | undefined;

	failWith(error: Error): void {
		this.failure = error;
	}

	hold(gate: Promise<void>): void {
		this.gate = gate;
	}

	succeed(): void {
		this.failure = undefined;
		this.gate = undefined;
	}

	protected async doActivate(): Promise<void> {
		this.doActivateCalls++;
		if (this.gate) {
			await this.gate;
		}
		if (this.failure) {
			throw this.failure;
		}
	}
}

suite('ExtensionRecommendations', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function create(): TestExtensionRecommendations {
		return disposables.add(new TestExtensionRecommendations());
	}

	test('activate calls doActivate again after rejection, then caches success', async () => {
		const error = new Error('activate failed');
		const recommendations = create();
		recommendations.failWith(error);

		const pending = recommendations.activate();
		assert.strictEqual(recommendations.activated, true);
		assert.strictEqual(recommendations.doActivateCalls, 1);
		await assert.rejects(pending, (reason: unknown) => reason === error);
		assert.strictEqual(recommendations.activated, false);
		assert.strictEqual(recommendations.doActivateCalls, 1);

		recommendations.succeed();
		await recommendations.activate();
		assert.strictEqual(recommendations.activated, true);
		assert.strictEqual(recommendations.doActivateCalls, 2);

		await recommendations.activate();
		assert.strictEqual(recommendations.activated, true);
		assert.strictEqual(recommendations.doActivateCalls, 2);
	});

	test('in-flight activate calls share one doActivate', async () => {
		let release!: () => void;
		const gate = new Promise<void>(resolve => { release = resolve; });
		const recommendations = create();
		recommendations.hold(gate);

		const first = recommendations.activate();
		const second = recommendations.activate();
		assert.strictEqual(first, second);
		assert.strictEqual(recommendations.activated, true);
		assert.strictEqual(recommendations.doActivateCalls, 1);

		release();
		await Promise.all([first, second]);
		assert.strictEqual(recommendations.activated, true);
		assert.strictEqual(recommendations.doActivateCalls, 1);

		await recommendations.activate();
		assert.strictEqual(recommendations.doActivateCalls, 1);
	});

	test('a rejected attempt is cleared only while it still points at that attempt', async () => {
		const error = new Error('activate failed late');
		let rejectActivation!: (reason: Error) => void;
		const recommendations = disposables.add(new class extends ExtensionRecommendations {
			readonly recommendations: ReadonlyArray<ExtensionRecommendation> = [];
			doActivateCalls = 0;
			protected doActivate(): Promise<void> {
				this.doActivateCalls++;
				return new Promise((_resolve, reject) => {
					rejectActivation = reject;
				});
			}
		}());

		const first = recommendations.activate();
		assert.strictEqual(recommendations.activated, true);
		assert.strictEqual(recommendations.doActivateCalls, 1);
		const replacement = Promise.resolve();
		(recommendations as unknown as { _activationPromise: Promise<void> | null })._activationPromise = replacement;

		rejectActivation(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(recommendations.activated, true);
		assert.strictEqual((recommendations as unknown as { _activationPromise: Promise<void> | null })._activationPromise, replacement);

		await recommendations.activate();
		assert.strictEqual(recommendations.activated, true);
		assert.strictEqual(recommendations.doActivateCalls, 1);
	});
});
