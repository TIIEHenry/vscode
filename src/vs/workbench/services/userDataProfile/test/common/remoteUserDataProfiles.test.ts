/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { DidChangeProfilesEvent, IUserDataProfile, toUserDataProfile } from '../../../../../platform/userDataProfile/common/userDataProfile.js';
import { RemoteUserDataProfilesService } from '../../common/remoteUserDataProfiles.js';

function makeProfile(id: string, name: string, isDefault: boolean, options?: { isTransient?: boolean; useDefaultFlags?: IUserDataProfile['useDefaultFlags'] }): IUserDataProfile {
	return {
		...toUserDataProfile(id, name, URI.file(`/profiles/${id}`), URI.file('/cache'), {
			transient: options?.isTransient,
			useDefaultFlags: options?.useDefaultFlags,
		}),
		isDefault,
	};
}

interface IRemoteEnvironment {
	profiles: { all: readonly IUserDataProfile[]; home: URI };
}

function createService(options: {
	remoteAuthority?: string;
	connection: { getChannel(name: string): { call(command: string, args?: unknown[]): Promise<unknown>; listen(event: string): (listener: (event: DidChangeProfilesEvent) => void) => { dispose(): void } } } | null;
	getEnvironment: () => Promise<IRemoteEnvironment | null>;
	currentProfile: IUserDataProfile;
	localProfiles?: readonly IUserDataProfile[];
	onDidChangeProfiles?: (listener: (event: DidChangeProfilesEvent) => void) => { dispose(): void };
	storage?: {
		get(key: string, scope: number): string | undefined;
		store(key: string, value: string, scope: number, target: number): void;
		remove(key: string, scope: number): void;
	};
}) {
	let subscriptions = 0;
	const onDidChangeProfiles = options.onDidChangeProfiles ?? (() => {
		subscriptions++;
		return { dispose() { subscriptions--; } };
	});
	const storage = options.storage ?? {
		get: () => undefined,
		store: () => { },
		remove: () => { },
	};
	const service = new RemoteUserDataProfilesService(
		{ remoteAuthority: options.remoteAuthority } as never,
		{
			getConnection: () => options.connection,
			getEnvironment: options.getEnvironment,
		} as never,
		{
			profiles: options.localProfiles ?? [options.currentProfile],
			onDidChangeProfiles,
		} as never,
		{ currentProfile: options.currentProfile } as never,
		storage as never,
		{ error() { } } as never,
	);
	return { service, subscriptions: () => subscriptions };
}

suite('RemoteUserDataProfilesService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const home = URI.file('/remote-profiles');

	function environment(profiles: readonly IUserDataProfile[]): IRemoteEnvironment {
		return { profiles: { all: profiles, home } };
	}

	function channelFor(profiles: IUserDataProfile[], onCreate?: (id: string, name: string, options: { transient?: boolean; useDefaultFlags?: IUserDataProfile['useDefaultFlags'] } | undefined) => IUserDataProfile | Promise<IUserDataProfile>) {
		const onDidChangeProfiles = store.add(new Emitter<DidChangeProfilesEvent>());
		const channel = {
			listen: (event: string) => event === 'onDidChangeProfiles' ? onDidChangeProfiles.event : () => ({ dispose() { } }),
			call: async (command: string, args?: unknown[]) => {
				if (command === 'createProfile') {
					const id = args?.[0] as string;
					const name = args?.[1] as string;
					const options = args?.[2] as { transient?: boolean; useDefaultFlags?: IUserDataProfile['useDefaultFlags'] } | undefined;
					const created = onCreate ? await onCreate(id, name, options) : makeProfile(id, name, false);
					const index = profiles.findIndex(profile => profile.id === created.id);
					if (index >= 0) {
						profiles.splice(index, 1, created);
					} else {
						profiles.push(created);
					}
					onDidChangeProfiles.fire({ added: [created], removed: [], updated: [], all: profiles.slice() });
					return created;
				}
				if (command === 'updateProfile') {
					return args?.[0];
				}
				return undefined;
			},
		};
		return channel;
	}

	test('retries getRemoteProfiles after getEnvironment rejects', async () => {
		const defaultProfile = makeProfile('default', 'Default', true);
		let reads = 0;
		const { service } = createService({
			connection: { getChannel: () => channelFor([defaultProfile]) },
			getEnvironment: async () => {
				reads++;
				if (reads === 1) {
					throw new Error('environment offline');
				}
				return environment([defaultProfile]);
			},
			currentProfile: defaultProfile,
		});
		store.add(service);

		await assert.rejects(service.getRemoteProfiles(), (error: unknown) => error instanceof Error && error.message === 'environment offline');
		assert.strictEqual(reads, 1);

		assert.deepStrictEqual((await service.getRemoteProfiles()).map(profile => profile.id), ['default']);
		assert.strictEqual(reads, 2);
		assert.deepStrictEqual((await service.getRemoteProfiles()).map(profile => profile.id), ['default']);
		assert.strictEqual(reads, 2);
	});

	test('retries when getEnvironment returns null, and keeps a later success', async () => {
		const defaultProfile = makeProfile('default', 'Default', true);
		let reads = 0;
		const { service } = createService({
			connection: { getChannel: () => channelFor([defaultProfile]) },
			getEnvironment: async () => {
				reads++;
				return reads === 1 ? null : environment([defaultProfile]);
			},
			currentProfile: defaultProfile,
		});
		store.add(service);

		await assert.rejects(service.getRemoteProfiles(), /Remote profiles service not available/);
		assert.strictEqual(reads, 1);

		const first = service.getRemoteProfiles();
		const second = service.getRemoteProfiles();
		assert.strictEqual(reads, 2);
		assert.deepStrictEqual((await first).map(profile => profile.id), ['default']);
		assert.deepStrictEqual((await second).map(profile => profile.id), ['default']);
		assert.strictEqual(reads, 2);

		await service.getRemoteProfile(defaultProfile);
		assert.strictEqual(reads, 2);
	});

	test('a window without a remote connection does not retry getEnvironment', async () => {
		const defaultProfile = makeProfile('default', 'Default', true);
		let reads = 0;
		const { service } = createService({
			connection: null,
			getEnvironment: async () => {
				reads++;
				return environment([defaultProfile]);
			},
			currentProfile: defaultProfile,
		});
		store.add(service);

		await assert.rejects(service.getRemoteProfiles(), /Remote profiles service not available/);
		await assert.rejects(service.getRemoteProfile(defaultProfile), /Remote profiles service not available/);
		assert.strictEqual(reads, 0);
	});

	test('in-flight reads share one init, then a success stays cached', async () => {
		const defaultProfile = makeProfile('default', 'Default', true);
		let reads = 0;
		let releaseEnvironment!: (environment: IRemoteEnvironment) => void;
		const { service } = createService({
			connection: { getChannel: () => channelFor([defaultProfile]) },
			getEnvironment: () => {
				reads++;
				return new Promise(resolve => { releaseEnvironment = resolve; });
			},
			currentProfile: defaultProfile,
		});
		store.add(service);

		const first = service.getRemoteProfiles();
		const second = service.getRemoteProfiles();
		assert.strictEqual(reads, 1);

		releaseEnvironment(environment([defaultProfile]));
		assert.deepStrictEqual((await first).map(profile => profile.id), ['default']);
		assert.deepStrictEqual((await second).map(profile => profile.id), ['default']);
		await service.getRemoteProfiles();
		assert.strictEqual(reads, 1);
	});

	test('retries creating the remote profile and subscribes to local changes once', async () => {
		const defaultProfile = makeProfile('default', 'Default', true);
		const flags = { settings: true };
		const currentProfile = makeProfile('other', 'Other', false, { isTransient: true, useDefaultFlags: flags });
		const remoteProfiles = [defaultProfile];
		let creates = 0;
		const channel = channelFor(remoteProfiles, async (id, name, options) => {
			creates++;
			assert.strictEqual(id, 'other');
			assert.strictEqual(name, 'Other');
			assert.deepStrictEqual(options, { transient: true, useDefaultFlags: flags });
			if (creates === 1) {
				throw new Error('create failed');
			}
			return makeProfile(id, name, false, { isTransient: true, useDefaultFlags: flags });
		});
		let subscriptions = 0;
		const { service } = createService({
			connection: { getChannel: name => { assert.strictEqual(name, 'userDataProfiles'); return channel; } },
			getEnvironment: async () => environment(remoteProfiles),
			currentProfile,
			localProfiles: [defaultProfile, currentProfile],
			onDidChangeProfiles: () => {
				subscriptions++;
				return { dispose() { subscriptions--; } };
			},
		});
		store.add(service);

		await assert.rejects(service.getRemoteProfile(currentProfile), (error: unknown) => error instanceof Error && error.message === 'create failed');
		assert.strictEqual(creates, 1);
		assert.strictEqual(subscriptions, 1);

		const created = await service.getRemoteProfile(currentProfile);
		assert.strictEqual(created.id, 'other');
		assert.strictEqual(created.name, 'Other');
		assert.strictEqual(created.isTransient, true);
		assert.strictEqual(creates, 2);
		assert.strictEqual(subscriptions, 1);

		await service.getRemoteProfile(currentProfile);
		assert.strictEqual(creates, 2);
		assert.strictEqual(subscriptions, 1);
	});

	test('retries after associating the remote profile fails to store', async () => {
		const defaultProfile = makeProfile('default', 'Default', true);
		const currentProfile = makeProfile('other', 'Other', false);
		const remoteProfiles = [defaultProfile];
		let stores = 0;
		const values = new Map<string, string>();
		const { service } = createService({
			remoteAuthority: 'test-remote',
			connection: { getChannel: () => channelFor(remoteProfiles) },
			getEnvironment: async () => environment([defaultProfile]),
			currentProfile,
			localProfiles: [defaultProfile, currentProfile],
			storage: {
				get: key => values.get(key),
				store: (key, value) => {
					stores++;
					if (stores === 1) {
						throw new Error('store failed');
					}
					values.set(key, value);
				},
				remove: key => { values.delete(key); },
			},
		});
		store.add(service);

		await assert.rejects(service.getRemoteProfiles(), (error: unknown) => error instanceof Error && error.message === 'store failed');
		assert.strictEqual(stores, 1);

		assert.deepStrictEqual((await service.getRemoteProfiles()).map(profile => profile.id), ['default', 'other']);
		assert.ok(stores >= 2);
	});

});
