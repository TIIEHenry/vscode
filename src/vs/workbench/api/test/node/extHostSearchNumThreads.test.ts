/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../base/common/event.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../platform/log/common/log.js';
import { ExtHostConfigProvider, IExtHostConfiguration } from '../../common/extHostConfiguration.js';
import { IExtHostInitDataService } from '../../common/extHostInitDataService.js';
import { URITransformerService } from '../../common/extHostUriTransformerService.js';
import { NativeExtHostSearch } from '../../node/extHostSearch.js';
import { AnyCallRPCProtocol } from '../common/testRPCProtocol.js';
import type * as vscode from 'vscode';

class RipgrepThreadsConfiguration extends mock<IExtHostConfiguration>() {

	reads = 0;
	fail = false;
	value: number | undefined = 4;
	gate: Promise<void> | undefined;

	private readonly provider: ExtHostConfigProvider;

	constructor(private readonly configurationEmitter: Emitter<vscode.ConfigurationChangeEvent>) {
		super();
		const configuration = this;
		this.provider = new class extends mock<ExtHostConfigProvider>() {
			override get onDidChangeConfiguration(): Event<vscode.ConfigurationChangeEvent> {
				return configurationEmitter.event;
			}

			override getConfiguration(): vscode.WorkspaceConfiguration {
				return new class extends mock<vscode.WorkspaceConfiguration>() {
					override get<T>(section: string): T | undefined;
					override get<T>(section: string, defaultValue: T): T;
					override get<T>(section: string, defaultValue?: T): T | undefined {
						if (section !== 'ripgrep.maxThreads') {
							return defaultValue;
						}
						configuration.reads++;
						if (configuration.fail) {
							throw new Error('ripgrep.maxThreads failed');
						}
						return (configuration.value ?? defaultValue) as T | undefined;
					}
				};
			}
		};
	}

	override async getConfigProvider(): Promise<ExtHostConfigProvider> {
		if (this.gate) {
			await this.gate;
		}
		return this.provider;
	}

	fire(section: string): void {
		this.configurationEmitter.fire({
			affectsConfiguration: (candidate: string) => candidate === section,
		});
	}
}

async function flushConfigurationSubscription(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

suite('NativeExtHostSearch getNumThreadsCached', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	let configurationEmitter: Emitter<vscode.ConfigurationChangeEvent>;
	let configuration: RipgrepThreadsConfiguration;
	let host: NativeExtHostSearch;

	setup(async () => {
		configurationEmitter = new Emitter<vscode.ConfigurationChangeEvent>();
		configuration = new RipgrepThreadsConfiguration(configurationEmitter);
		host = disposables.add(new NativeExtHostSearch(
			AnyCallRPCProtocol(),
			new class extends mock<IExtHostInitDataService>() {
				override remote = { isRemote: false, authority: undefined, connectionData: null };
			},
			new URITransformerService(null),
			configuration,
			new NullLogService(),
		));
		await flushConfigurationSubscription();
	});

	teardown(() => {
		configurationEmitter.dispose();
	});

	test('reads ripgrep.maxThreads again after the first read fails', async () => {
		configuration.fail = true;

		await assert.rejects(() => host.getNumThreadsCached(), /ripgrep\.maxThreads failed/);
		assert.strictEqual(configuration.reads, 1);

		configuration.fail = false;
		configuration.value = 8;
		assert.strictEqual(await host.getNumThreadsCached(), 8);
		assert.strictEqual(configuration.reads, 2);
	});

	test('reads ripgrep.maxThreads once while the read is in flight', async () => {
		let release!: () => void;
		configuration.gate = new Promise<void>(resolve => { release = resolve; });

		const first = host.getNumThreadsCached();
		const second = host.getNumThreadsCached();
		assert.strictEqual(configuration.reads, 0);

		release();
		assert.strictEqual(await first, 4);
		assert.strictEqual(await second, 4);
		assert.strictEqual(configuration.reads, 1);
	});

	test('does not read ripgrep.maxThreads again after success when configuration is unchanged', async () => {
		assert.strictEqual(await host.getNumThreadsCached(), 4);
		configuration.value = 9;

		assert.strictEqual(await host.getNumThreadsCached(), 4);
		assert.strictEqual(configuration.reads, 1);
	});

	test('reads ripgrep.maxThreads again after search configuration changes', async () => {
		assert.strictEqual(await host.getNumThreadsCached(), 4);
		configuration.value = 9;
		configuration.fire('search');

		assert.strictEqual(await host.getNumThreadsCached(), 9);
		assert.strictEqual(configuration.reads, 2);
	});
});
