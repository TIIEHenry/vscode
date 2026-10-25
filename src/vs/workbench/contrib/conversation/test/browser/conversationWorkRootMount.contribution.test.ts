/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IFileService, IFileStatWithMetadata } from '../../../../../platform/files/common/files.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import type { ConnectionPhase } from '../../../../../platform/universeAgent/common/connectionHubTypes.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IWorkspaceContextService, toWorkspaceFolder } from '../../../../../platform/workspace/common/workspace.js';
import { testWorkspace, Workspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import type { IAgentWorkRoot } from '../../../../services/agentSession/common/agentWorkRoot.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { IWorkspaceEditingService } from '../../../../services/workspaces/common/workspaceEditing.js';
import type { IWorkspaceFolderCreationData } from '../../../../../platform/workspaces/common/workspaces.js';
import { IWorkspaceTrustEnablementService, IWorkspaceTrustManagementService } from '../../../../../platform/workspace/common/workspaceTrust.js';
import { TestContextService } from '../../../../test/common/workbenchTestServices.js';
import { ConversationWorkRootMountContribution, resolveWorkRootMountCandidate } from '../../browser/conversationWorkRootMount.contribution.js';
import { ConversationWorkRootMountModel, workspaceBlocksAutoMount, type IWorkRootMountOffer } from '../../browser/conversationWorkRootMount.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';

const LOOPBACK: ConnectionPhase = { kind: 'connected', path: 'loopback' };

function engineRoot(workDir: string, sessionId = 's-1'): IAgentWorkRoot {
	return { sessionId, engineIdentityId: 'eng', workDir, source: 'session', access: 'engine', localRoot: undefined, projectKey: `eng\n${workDir}` };
}

suite('ConversationWorkRootMount', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	suite('resolveWorkRootMountCandidate', () => {

		const base = { phase: LOOPBACK, pairingPending: false, remoteAuthority: undefined, workspaceFolders: [] as URI[] };

		test('Loopback engine root on this machine is a candidate', () => {
			assert.strictEqual(resolveWorkRootMountCandidate({ ...base, root: engineRoot('/work/alpha/') })?.toString(), URI.file('/work/alpha').toString());
		});

		test('no candidate for a local root, a missing work dir, or a relative path', () => {
			const local: IAgentWorkRoot = { ...engineRoot('/work/alpha'), access: 'local', localRoot: URI.file('/work/alpha') };
			assert.strictEqual(resolveWorkRootMountCandidate({ ...base, root: local }), undefined);
			assert.strictEqual(resolveWorkRootMountCandidate({ ...base, root: { ...engineRoot(''), access: 'none', workDir: undefined } }), undefined);
			assert.strictEqual(resolveWorkRootMountCandidate({ ...base, root: engineRoot('relative/dir') }), undefined);
			assert.strictEqual(resolveWorkRootMountCandidate({ ...base, root: undefined }), undefined);
		});

		test('no candidate unless the engine is connected over Loopback without pairing', () => {
			const root = engineRoot('/work/alpha');
			assert.strictEqual(resolveWorkRootMountCandidate({ ...base, root, phase: { kind: 'connected', path: 'direct' } }), undefined);
			assert.strictEqual(resolveWorkRootMountCandidate({ ...base, root, phase: { kind: 'connected', path: 'hubRelay' } }), undefined);
			assert.strictEqual(resolveWorkRootMountCandidate({ ...base, root, phase: { kind: 'disconnected' } }), undefined);
			assert.strictEqual(resolveWorkRootMountCandidate({ ...base, root, pairingPending: true }), undefined);
		});

		test('no candidate in a remote window', () => {
			assert.strictEqual(resolveWorkRootMountCandidate({ ...base, root: engineRoot('/work/alpha'), remoteAuthority: 'ssh-remote+dev' }), undefined);
		});

		test('no candidate when the directory is an open folder or inside one', () => {
			const folders = [URI.file('/work')];
			assert.strictEqual(resolveWorkRootMountCandidate({ ...base, root: engineRoot('/work'), workspaceFolders: folders }), undefined);
			assert.strictEqual(resolveWorkRootMountCandidate({ ...base, root: engineRoot('/work/alpha'), workspaceFolders: folders }), undefined);
			assert.ok(resolveWorkRootMountCandidate({ ...base, root: engineRoot('/elsewhere'), workspaceFolders: folders }));
		});
	});

	suite('workspaceBlocksAutoMount', () => {

		const home = URI.file('/tmp/untitled-workspaces');
		const environment = { untitledWorkspacesHome: home } as IWorkbenchEnvironmentService;

		test('empty, single-folder, untitled, and temporary workspaces can auto-add', () => {
			assert.strictEqual(workspaceBlocksAutoMount(null, environment), false);
			assert.strictEqual(workspaceBlocksAutoMount(undefined, environment), false);
			assert.strictEqual(workspaceBlocksAutoMount(URI.file('/tmp/untitled-workspaces/abc/workspace.json'), environment), false);
			assert.strictEqual(workspaceBlocksAutoMount(URI.from({ scheme: 'tmp', path: '/workspace.json' }), environment), false);
		});

		test('a saved workspace file blocks auto-add', () => {
			assert.strictEqual(workspaceBlocksAutoMount(URI.file('/repo/app.code-workspace'), environment), true);
		});
	});

	function mount(options: {
		root: IAgentWorkRoot;
		phase?: ConnectionPhase;
		folders?: URI[];
		configuration?: URI | null;
		directories?: string[];
		statGate?: Promise<void>;
		trustEnabled?: boolean;
		trusted?: boolean;
		workspaceTrusted?: boolean;
		addFolders?: (folders: IWorkspaceFolderCreationData[], donotNotifyError?: boolean) => Promise<void>;
	}) {
		let root = options.root;
		let phase = options.phase ?? LOOPBACK;
		const onDidChangeActiveWorkRoot = store.add(new Emitter<IAgentWorkRoot>());
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const sessionContext = {
			getActiveWorkRoot: () => root,
			onDidChangeActiveWorkRoot: onDidChangeActiveWorkRoot.event,
		} as unknown as IAgentSessionContext;
		const base = createConversationConnectionTestStub();
		const connection = createConversationConnectionTestStub({
			getConnectionPhase: () => phase,
			onDidChangeConnection: onDidChangeConnection.event,
		});
		const folders = options.folders ?? [];
		const contextService = new TestContextService(options.configuration
			? new Workspace('configured', folders.map(folder => toWorkspaceFolder(folder)), options.configuration)
			: (options.folders ? testWorkspace(...options.folders) : new Workspace('empty', [])));
		const added: string[][] = [];
		const notifyFlags: Array<boolean | undefined> = [];
		const editing = {
			addFolders: async (foldersToAdd: IWorkspaceFolderCreationData[], donotNotifyError?: boolean) => {
				added.push(foldersToAdd.map(folder => folder.uri.path));
				notifyFlags.push(donotNotifyError);
				await options.addFolders?.(foldersToAdd, donotNotifyError);
			},
		} as unknown as IWorkspaceEditingService;
		const stats: string[] = [];
		const directories = new Set(options.directories ?? []);
		const fileService = {
			stat: async (resource: URI) => {
				stats.push(resource.path);
				await options.statGate;
				if (!directories.has(resource.path)) {
					throw new Error('not found');
				}
				return { isDirectory: true } as IFileStatWithMetadata;
			},
		} as unknown as IFileService;
		const environment = {
			remoteAuthority: undefined,
			untitledWorkspacesHome: URI.file('/tmp/untitled-workspaces'),
		} as IWorkbenchEnvironmentService;
		let trusted = options.trusted ?? true;
		const onDidChangeTrustedFolders = store.add(new Emitter<void>());
		const trustEnablement = { isWorkspaceTrustEnabled: () => options.trustEnabled ?? false } as IWorkspaceTrustEnablementService;
		const trustManagement = {
			onDidChangeTrust: Event.None,
			onDidChangeTrustedFolders: onDidChangeTrustedFolders.event,
			workspaceTrustInitialized: Promise.resolve(),
			isWorkspaceTrusted: () => options.workspaceTrusted ?? true,
			getUriTrustInfo: async (uri: URI) => ({ uri, trusted }),
		} as unknown as IWorkspaceTrustManagementService;
		const model = store.add(new ConversationWorkRootMountModel());
		const contribution = store.add(new ConversationWorkRootMountContribution(
			sessionContext,
			connection,
			contextService as unknown as IWorkspaceContextService,
			editing,
			fileService,
			environment,
			new NullLogService(),
			trustEnablement,
			trustManagement,
			model,
		));
		return {
			contribution,
			added,
			notifyFlags,
			stats,
			offer(): IWorkRootMountOffer | undefined { return model.getOffer(); },
			accept: () => model.acceptOffer(),
			setTrusted(next: boolean) { trusted = next; onDidChangeTrustedFolders.fire(); },
			setRoot(next: IAgentWorkRoot) { root = next; onDidChangeActiveWorkRoot.fire(next); },
			setPhase(next: ConnectionPhase) { phase = next; onDidChangeConnection.fire(base.getConnectionSnapshot()); },
		};
	}

	test('adds the active session directory once when it exists on this machine', async () => {
		const harness = mount({ root: engineRoot('/work/alpha'), directories: ['/work/alpha'] });
		await timeout(0);
		assert.deepStrictEqual(harness.added, [['/work/alpha']]);
		assert.deepStrictEqual(harness.notifyFlags, [true]);
		assert.strictEqual(harness.offer(), undefined);

		harness.setPhase(LOOPBACK);
		await timeout(0);
		assert.deepStrictEqual(harness.added, [['/work/alpha']]);
	});

	test('does not add a directory that does not exist, and does not stat it again on connection events', async () => {
		const harness = mount({ root: engineRoot('/work/missing') });
		await timeout(0);
		harness.setPhase(LOOPBACK);
		await timeout(0);
		assert.deepStrictEqual(harness.added, []);
		assert.deepStrictEqual(harness.stats, ['/work/missing']);
	});

	test('waits for Loopback before adding', async () => {
		const harness = mount({ root: engineRoot('/work/alpha'), phase: { kind: 'connected', path: 'direct' }, directories: ['/work/alpha'] });
		await timeout(0);
		assert.deepStrictEqual(harness.added, []);
		harness.setPhase(LOOPBACK);
		await timeout(0);
		assert.deepStrictEqual(harness.added, [['/work/alpha']]);
	});

	test('drops a stat that returns after the session moved on', async () => {
		let release!: () => void;
		const statGate = new Promise<void>(resolve => { release = resolve; });
		const harness = mount({ root: engineRoot('/work/alpha'), directories: ['/work/alpha', '/work/beta'], statGate });
		harness.setRoot(engineRoot('/work/beta', 's-2'));
		release();
		await timeout(0);
		assert.deepStrictEqual(harness.added, [['/work/beta']]);
	});

	test('a failed add is not retried until the active root moves away and back', async () => {
		const harness = mount({
			root: engineRoot('/work/alpha'),
			directories: ['/work/alpha', '/work/beta'],
			addFolders: async () => { throw new Error('trust declined'); },
		});
		await timeout(0);
		harness.setPhase(LOOPBACK);
		await timeout(0);
		assert.deepStrictEqual(harness.added, [['/work/alpha']]);

		harness.setRoot(engineRoot('/work/beta', 's-2'));
		await timeout(0);
		harness.setRoot(engineRoot('/work/alpha', 's-1'));
		await timeout(0);
		assert.deepStrictEqual(harness.added, [['/work/alpha'], ['/work/beta'], ['/work/alpha']]);
	});

	test('an untrusted directory waits for a click, and a later trust grant adds it', async () => {
		const harness = mount({ root: engineRoot('/work/alpha'), directories: ['/work/alpha'], trustEnabled: true, trusted: false });
		await timeout(0);
		assert.deepStrictEqual(harness.added, []);
		assert.strictEqual(harness.offer()?.reason, 'trust');
		assert.strictEqual(harness.offer()?.uri.path, '/work/alpha');

		harness.setPhase(LOOPBACK);
		await timeout(0);
		assert.deepStrictEqual(harness.stats, ['/work/alpha']);

		await harness.accept();
		assert.deepStrictEqual(harness.added, [['/work/alpha']]);
		assert.deepStrictEqual(harness.notifyFlags, [undefined]);

		harness.setTrusted(true);
		await timeout(0);
		assert.deepStrictEqual(harness.added, [['/work/alpha'], ['/work/alpha']]);
		assert.deepStrictEqual(harness.notifyFlags, [undefined, true]);
		assert.strictEqual(harness.offer(), undefined);
	});

	test('a saved workspace file is not rewritten; an untitled workspace still auto-adds', async () => {
		const saved = mount({
			root: engineRoot('/work/alpha'),
			directories: ['/work/alpha'],
			folders: [URI.file('/work/other')],
			configuration: URI.file('/repo/app.code-workspace'),
		});
		await timeout(0);
		assert.deepStrictEqual(saved.added, []);
		assert.strictEqual(saved.offer()?.reason, 'confirm');

		const untitled = mount({
			root: engineRoot('/work/alpha'),
			directories: ['/work/alpha'],
			folders: [URI.file('/work/other')],
			configuration: URI.file('/tmp/untitled-workspaces/abc/workspace.json'),
		});
		await timeout(0);
		assert.deepStrictEqual(untitled.added, [['/work/alpha']]);
		assert.strictEqual(untitled.offer(), undefined);
	});
});
