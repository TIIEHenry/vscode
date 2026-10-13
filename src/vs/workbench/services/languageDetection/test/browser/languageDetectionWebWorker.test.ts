/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import type { ModelOperations } from '@vscode/vscode-languagedetection';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { IWebWorkerServer } from '../../../../../base/common/worker/webWorker.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { LanguageDetectionWorker } from '../../browser/languageDetectionWebWorker.js';

type ModelLoadTestApi = {
	getModelOperations(): Promise<ModelOperations>;
	createModelOperations(): Promise<ModelOperations>;
	_modelOperations: ModelOperations | undefined;
	_modelOperationsLoadPromise: Promise<ModelOperations> | undefined;
};

class StubLanguageDetectionHost {
	indexCalls = 0;
	indexImpl: () => Promise<string> = async () => {
		throw new Error('unexpected model index load');
	};

	$getIndexJsUri(): Promise<string> {
		this.indexCalls++;
		return this.indexImpl();
	}

	$getLanguageId(): Promise<string | undefined> {
		return Promise.resolve(undefined);
	}

	$sendTelemetryEvent(): Promise<void> {
		return Promise.resolve();
	}

	$getRegexpModelUri(): Promise<string> {
		return Promise.resolve('');
	}

	$getModelJsonUri(): Promise<string> {
		return Promise.resolve('');
	}

	$getWeightsUri(): Promise<string> {
		return Promise.resolve('');
	}
}

function createWorker(host: StubLanguageDetectionHost): LanguageDetectionWorker {
	const server: IWebWorkerServer = {
		setChannel() { },
		getChannel<T extends object>(): T {
			return host as unknown as T;
		}
	};
	return new LanguageDetectionWorker(server);
}

function testApi(worker: LanguageDetectionWorker): ModelLoadTestApi {
	return worker as unknown as ModelLoadTestApi;
}

function fakeModelOperations(): ModelOperations {
	return {
		runModel: () => Promise.resolve([])
	} as unknown as ModelOperations;
}

suite('LanguageDetectionWorker getModelOperations', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	let host: StubLanguageDetectionHost;
	let worker: LanguageDetectionWorker;

	setup(() => {
		host = new StubLanguageDetectionHost();
		worker = createWorker(host);
	});

	test('loads again after the first model load fails', async () => {
		host.indexImpl = async () => {
			throw new Error('index failed');
		};
		const api = testApi(worker);

		const first = api.getModelOperations();
		await assert.rejects(first, /index failed/);
		assert.strictEqual(api._modelOperationsLoadPromise, undefined);
		assert.strictEqual(host.indexCalls, 1);

		const second = api.getModelOperations();
		assert.notStrictEqual(second, first);
		await assert.rejects(second, /index failed/);
		assert.strictEqual(host.indexCalls, 2);
		assert.strictEqual(api._modelOperationsLoadPromise, undefined);
	});

	test('shares one load while the model load is in flight', async () => {
		const gate = new DeferredPromise<string>();
		host.indexImpl = () => gate.p;
		const api = testApi(worker);

		const first = api.getModelOperations();
		const second = api.getModelOperations();
		assert.strictEqual(host.indexCalls, 1);
		assert.strictEqual(first, second);

		const settled = Promise.allSettled([first, second]);
		await gate.error(new Error('stop'));
		const results = await settled;
		assert.strictEqual(results[0].status, 'rejected');
		assert.strictEqual(results[1].status, 'rejected');
		assert.strictEqual(host.indexCalls, 1);
	});

	test('returns the loaded model without loading again', async () => {
		const operations = fakeModelOperations();
		let loads = 0;
		const api = testApi(worker);
		api.createModelOperations = async () => {
			loads++;
			return operations;
		};

		assert.strictEqual(await api.getModelOperations(), operations);
		assert.strictEqual(api._modelOperations, operations);
		assert.strictEqual(loads, 1);
		assert.strictEqual(host.indexCalls, 0);

		assert.strictEqual(await api.getModelOperations(), operations);
		assert.strictEqual(loads, 1);
		assert.strictEqual(host.indexCalls, 0);
	});

	test('drops a failed load only when the field still points at that attempt', async () => {
		const gate = new DeferredPromise<string>();
		host.indexImpl = () => gate.p;
		const api = testApi(worker);
		const operations = fakeModelOperations();
		const inflight = api.getModelOperations();
		const replacement = Promise.resolve(operations);
		api._modelOperationsLoadPromise = replacement;

		const seen = inflight.then(() => 'resolved', () => 'rejected');
		await gate.error(new Error('old attempt failed'));
		assert.strictEqual(await seen, 'rejected');
		assert.strictEqual(api._modelOperationsLoadPromise, replacement);
		assert.strictEqual(host.indexCalls, 1);
	});
});
