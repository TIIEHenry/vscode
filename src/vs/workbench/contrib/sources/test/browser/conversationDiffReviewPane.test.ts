/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise, timeout } from '../../../../../base/common/async.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { IDiffProviderFactoryService } from '../../../../../editor/browser/widget/diffEditor/diffProviderFactoryService.js';
import { TestDiffProviderFactoryService } from '../../../../../editor/test/browser/diff/testDiffProviderFactoryService.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { emptyProgressRunner, IEditorProgressService } from '../../../../../platform/progress/common/progress.js';
import { IUserInteractionService, MockUserInteractionService } from '../../../../../platform/userInteraction/browser/userInteractionService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentReadGitFileDiffRequest, UniverseAgentWriteGitApplyHunksRequest, UniverseAgentWriteGitStagePathsRequest, UniverseAgentWriteGitWriteResult } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IViewDescriptorService, IViewPaneContainer, ViewContainerLocation } from '../../../../common/views.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import { workbenchInstantiationService, TestEditorGroupView } from '../../../../test/browser/workbenchTestServices.js';
import { IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { ISCMRepository, ISCMResource, ISCMService } from '../../../scm/common/scm.js';
import { ConversationDiffReviewInput } from '../../browser/conversationDiffReviewInput.js';
import { ConversationDiffReviewPane } from '../../browser/conversationDiffReviewPane.js';
import { SOURCES_DIFF_PANEL_CONTAINER_ID } from '../../browser/sourcesDiffPanelIds.js';
import { ISourcesChangesModel } from '../../common/sourcesChangesModel.js';
import { SourcesChangesModel } from '../../common/sourcesChangesReadModel.js';

import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ICodeEditorService } from '../../../../../editor/browser/services/codeEditorService.js';
import { DiffEditorWidget } from '../../../../../editor/browser/widget/diffEditor/diffEditorWidget.js';
import { ISourcesChangeRef } from '../../common/sourcesChangeRef.js';
import { isSourcesChangesWriteClosed } from '../../common/sourcesChangesGitWrite.js';

suite('Conversation diff review pane', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const acceptedWrite: UniverseAgentWriteGitWriteResult = {
		supported: true,
		reason: '',
		success: true,
		errorMessage: '',
		exitCode: 0,
		stdout: '',
	};

	const acceptCursorUnifiedDiff = [
		'diff --git a/src/a.ts b/src/a.ts',
		'--- a/src/a.ts',
		'+++ b/src/a.ts',
		'@@ -1,3 +1,4 @@',
		' line1',
		'-old',
		'+new',
		'+extra',
	].join('\n');

	function createLeftoverScmService(resource: URI, groupId = 'workingTree'): ISCMService {
		const group = {
			id: groupId,
			label: groupId === 'index' ? 'Staged Changes' : 'Changes',
			resources: [] as ISCMResource[],
		};
		const scmResource = {
			sourceUri: resource,
			resourceGroup: group,
			decorations: {},
			open: async () => { },
		} as unknown as ISCMResource;
		group.resources.push(scmResource);
		const repository = {
			provider: {
				groups: [group],
				rootUri: resource,
				onDidChangeResources: Event.None,
				onDidChangeResourceGroups: Event.None,
			},
		};
		return {
			_serviceBrand: undefined,
			get repositories() { return [repository]; },
			get repositoryCount() { return 1; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService;
	}

	function stubSessionAndChangesModel(
		instantiationService: ReturnType<typeof workbenchInstantiationService>,
		connection: IUniverseAgentConnection,
	): void {
		instantiationService.stub(IAgentSessionContext, {
			_serviceBrand: undefined,
			getActiveSessionId: () => 'session-1',
			isEngineSessionReady: () => true,
			isPairingHold: () => false,
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: Event.None,
			acquireSessionView: () => { throw new Error('not used'); },
		} satisfies IAgentSessionContext);
		instantiationService.stub(ISourcesChangesModel, store.add(instantiationService.createInstance(SourcesChangesModel)));
		instantiationService.stub(IConversationRosterService, {
			getActiveSessionId: () => 'session-1',
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: Event.None,
			isEngineSessionReady: () => true,
		} as unknown as IConversationRosterService);
		instantiationService.stub(IUniverseAgentConnection, connection);
	}

	function createInstantiationService(resource: URI, connection: IUniverseAgentConnection, resolveModels = false) {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IViewDescriptorService, {
			getViewLocationById: () => ViewContainerLocation.Panel,
			onDidChangeLocation: Event.None,
			getViewDescriptorById: () => null,
			getViewContainerByViewId: () => ({
				id: SOURCES_DIFF_PANEL_CONTAINER_ID,
				title: { value: 'Diff', original: 'Diff' },
				ctorDescriptor: {} as SyncDescriptor<IViewPaneContainer>,
			}),
			getViewContainerModel: () => ({
				onDidChangeContainerInfo: Event.None,
			}),
			getDefaultContainerById: () => null,
		} as unknown as IViewDescriptorService);
		instantiationService.stub(ISCMService, createLeftoverScmService(resource));
		instantiationService.stub(IUniverseAgentConnection, connection);
		stubSessionAndChangesModel(instantiationService, connection);
		instantiationService.stub(ICommandService, {
			onWillExecuteCommand: Event.None,
			onDidExecuteCommand: Event.None,
			executeCommand: async () => undefined,
		} as unknown as ICommandService);
		if (resolveModels) {
			instantiationService.stub(IDiffProviderFactoryService, new TestDiffProviderFactoryService());
			instantiationService.stub(IUserInteractionService, new MockUserInteractionService());
			instantiationService.stub(IEditorProgressService, {
				_serviceBrand: undefined, show: () => emptyProgressRunner,
				showWhile: async promise => { await promise; },
			} satisfies IEditorProgressService);
		} else {
			instantiationService.stub(ITextModelService, {
				createModelReference: async () => {
					throw new Error('boom');
				},
			} as unknown as ITextModelService);
		}
		return instantiationService;
	}

	function paintReviewWriteChrome(pane: ConversationDiffReviewPane): void {
		const host = pane as unknown as { comparisonLoadFailed: boolean; updateReviewActions: () => void };
		host.comparisonLoadFailed = false;
		host.updateReviewActions();
	}

	test('Accept post-read authorization input.dispose with live Pane and identical input sends no ApplyHunks', async () => {
		const resource = URI.parse('inmemory://accept-input-dispose/modified');
		const original = URI.parse('inmemory://accept-input-dispose/original');
		const started = new DeferredPromise<void>();
		const release = new DeferredPromise<void>();
		store.add({ dispose: () => { void release.complete(); } });
		const reads: UniverseAgentReadGitFileDiffRequest[] = [];
		const applies: UniverseAgentWriteGitApplyHunksRequest[] = [];
		const commands: string[] = [];
		const validDiff = [
			'diff --git a/src/a.ts b/src/a.ts', '--- a/src/a.ts', '+++ b/src/a.ts',
			'@@ -1,2 +1,2 @@', ' line1', '-old', '+new',
		].join('\n');
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitFileDiff: async (request: UniverseAgentReadGitFileDiffRequest) => {
				reads.push(request);
				void started.complete();
				await release.p;
				return { supported: true, reason: '', path: request.path, unifiedDiff: validDiff };
			},
			writeGitApplyHunks: async (request: UniverseAgentWriteGitApplyHunksRequest) => {
				applies.push(request);
				return acceptedWrite;
			},
		} as unknown as IUniverseAgentConnection;
		const instantiation = createInstantiationService(resource, connection, true);
		instantiation.stub(ICommandService, {
			_serviceBrand: undefined, onWillExecuteCommand: Event.None, onDidExecuteCommand: Event.None,
			executeCommand: async <T>(id: string): Promise<T | undefined> => { commands.push(id); return undefined; },
		} satisfies ICommandService);
		const pane = store.add(instantiation.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		pane.create(parent);
		const models = instantiation.get(IModelService);
		store.add(models.createModel('line1\nold', null, original));
		store.add(models.createModel('line1\nnew', null, resource));
		const resolver = instantiation.get(ITextModelService);
		store.add(await resolver.createModelReference(original));
		store.add(await resolver.createModelReference(resource));
		const input = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree', {
			origin: 'engine', sessionId: 'session-1', gitPath: 'src/a.ts', kind: 'Modified', indexState: 'Unstaged',
		}));
		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
		assert.strictEqual(pane.didComparisonLoadFail(), false);
		(pane as unknown as { acceptCursor: { side: 'new'; line: number } }).acceptCursor = { side: 'new', line: 2 };
		const operation = (pane as unknown as { runAccept(): Promise<void> }).runAccept();
		try {
			await Promise.race([started.p, operation.then(() => { throw new Error('Accept returned before FileDiff started'); })]);
			input.dispose();
			assert.strictEqual(pane.input, input);
			assert.strictEqual(input.isDisposed(), true);
			await release.complete();
			await operation;
			assert.deepStrictEqual({ reads, applies, commands }, {
				reads: [{ sessionId: 'session-1', path: 'src/a.ts', indexState: 'Unstaged' }], applies: [], commands: [],
			});
		} finally { await release.complete(); await operation; }
	});

	test('in-flight Accept does not ApplyHunks after clearInput bumps write generation', async function () {
		const resource = toResource.call(this, '/project/src/inflight-accept-clear.ts');
		const original = toResource.call(this, '/project/src/inflight-accept-clear.ts.git');
		const applyCalls: UniverseAgentWriteGitApplyHunksRequest[] = [];
		let releaseRead: (() => void) | undefined;
		const readGate = new Promise<void>(resolve => {
			releaseRead = resolve;
		});
		let readInFlight = false;
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitFileDiff: async () => {
				readInFlight = true;
				await readGate;
				return { supported: true, reason: '', path: 'src/a.ts', unifiedDiff: acceptCursorUnifiedDiff };
			},
			writeGitApplyHunks: async (request: UniverseAgentWriteGitApplyHunksRequest) => {
				applyCalls.push(request);
				return acceptedWrite;
			},
			writeGitStagePaths: async (request: UniverseAgentWriteGitStagePathsRequest) => {
				return acceptedWrite;
			},
		} as unknown as IUniverseAgentConnection;

		const instantiationService = createInstantiationService(resource, connection);
		const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		pane.create(parent);
		const input = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree', {
			origin: 'engine',
			sessionId: 'session-1',
			gitPath: 'src/a.ts',
			indexState: 'Unstaged',
			kind: 'Modified',
		}));
		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
		paintReviewWriteChrome(pane);
		(pane as unknown as { acceptCursor: { side: 'new'; line: number } }).acceptCursor = { side: 'new', line: 3 };

		const acceptPromise = (pane as unknown as { runAccept: () => Promise<void> }).runAccept();
		while (!readInFlight) {
			await Promise.resolve();
		}
		pane.clearInput();
		releaseRead!();
		await acceptPromise;

		assert.deepStrictEqual(applyCalls, []);
	});

	suite('Local Git completion ownership', () => {
		type LocalAction = 'clean' | 'unstage' | 'stage';
		type Invalidation = 'replace' | 'clear' | 'clear-and-restore' | 'dispose' | 'input-dispose';
		interface Binding {
			readonly ref: ISourcesChangeRef;
			readonly input: ConversationDiffReviewInput;
		}
		interface CommandGate {
			readonly id: string;
			readonly resource: ISCMResource;
			readonly started: DeferredPromise<void>;
			readonly result: DeferredPromise<string | undefined>;
			readonly returned: DeferredPromise<void>;
		}

		/** Fixed task window after the public handler return includes the host's finally. */
		async function flushCompletion(): Promise<void> {
			for (let turn = 0; turn < 4; turn++) {
				await timeout(0);
			}
		}

		async function waitForGate(label: string, gate: DeferredPromise<void>): Promise<void> {
			for (let turn = 0; turn < 40; turn++) {
				if (gate.isResolved) {
					return;
				}
				await timeout(0);
			}
			assert.fail(`Local Git fixture did not reach ${label}; this is not a business red`);
		}

		/**
		 * Observe actual DOM objects, including detached originals. Calibrate same-value
		 * capture and normal forwarding before opening the completion window. Covered
		 * setter counts do not establish private update invocation or collapse-write counts.
		 */
		function observeFeedback(elements: readonly HTMLElement[]) {
			const writes: string[] = [];
			const restore: (() => void)[] = [];
			const cleanup = store.add(toDisposable(() => {
				const errors: Error[] = [];
				for (const undo of restore.reverse()) {
					try { undo(); }
					catch (error) { errors.push(error instanceof Error ? error : new Error(String(error))); }
				}
				if (errors.length) {
					throw new AggregateError(errors, 'R5 descriptor cleanup qualification failed');
				}
			}));
			const install = (target: object, key: 'display' | 'textContent', label: string) => {
				const own = Object.getOwnPropertyDescriptor(target, key);
				let owner: object | null = target;
				let descriptor: PropertyDescriptor | undefined;
				while (owner && !descriptor) {
					descriptor = Object.getOwnPropertyDescriptor(owner, key);
					owner = Object.getPrototypeOf(owner);
				}
				assert.ok(descriptor?.get && descriptor.set, `R5 qualification: ${label} needs a native accessor`);
				const accessor = descriptor;
				Object.defineProperty(target, key, {
					configurable: true,
					enumerable: accessor.enumerable,
					get: () => accessor.get!.call(target),
					set: (value: string | null) => {
						writes.push(label);
						accessor.set!.call(target, value);
					},
				});
				restore.push(() => {
					if (own) {
						Object.defineProperty(target, key, own);
					} else {
						assert.strictEqual(Reflect.deleteProperty(target, key), true, `R5 cleanup qualification: ${label}`);
					}
					assert.deepStrictEqual(Object.getOwnPropertyDescriptor(target, key), own);
				});
				const initial: string | null = Reflect.get(target, key);
				const count = writes.length;
				Reflect.set(target, key, initial);
				assert.deepStrictEqual(writes.slice(count), [label], `R5 same-value capture qualification: ${label}`);
				const alternative = key === 'display' ? (initial === 'none' ? '' : 'none') : `${initial ?? ''} calibration`;
				Reflect.set(target, key, alternative);
				assert.strictEqual(Reflect.get(target, key), alternative, `R5 forwarding qualification: ${label}`);
				Reflect.set(target, key, initial);
				assert.strictEqual(Reflect.get(target, key), initial);
			};
			try {
				for (const [index, element] of [...new Set(elements)].entries()) {
					install(element.style, 'display', `${index}.style.display`);
					install(element, 'textContent', `${index}.textContent`);
				}
				assert.ok(restore.length > 0, 'R5 observation qualification needs actual feedback objects');
				writes.length = 0;
				return { writes, dispose: () => cleanup.dispose() };
			} catch (error) {
				cleanup.dispose();
				throw error;
			}
		}

		async function mountLocalGitHost(groupId = 'workingTree') {
			const state: {
				activeSessionId: string; connected: boolean; pairingHold: boolean;
				readiness: 'ready' | 'unavailable'; readFailed: boolean;
			} = { activeSessionId: 'session-1', connected: false, pairingHold: false, readiness: 'ready', readFailed: false };
			const connectionChanged = store.add(new Emitter<void>());
			const sessionChanged = store.add(new Emitter<string>());
			const changesChanged = store.add(new Emitter<void>());
			const unary: string[] = [];
			const unsupported: UniverseAgentWriteGitWriteResult = {
				supported: false, reason: 'not supported', success: false, errorMessage: '', exitCode: 0, stdout: '',
			};
			const connection = {
				isEngineConnected: () => state.connected,
				getConnectionPhase: () => ({ kind: state.connected ? 'connected' as const : 'disconnected' as const }),
				getConnectionSnapshot: () => ({ pairingPending: state.pairingHold }),
				onDidChangeConnection: connectionChanged.event,
				readGitFileDiff: async () => {
					unary.push('readGitFileDiff');
					return { supported: false, reason: 'not supported', path: '', unifiedDiff: '' };
				},
				writeGitStagePaths: async () => { unary.push('writeGitStagePaths'); return unsupported; },
				writeGitApplyHunks: async () => { unary.push('writeGitApplyHunks'); return unsupported; },
			} as unknown as IUniverseAgentConnection;
			const session: IAgentSessionContext = {
				_serviceBrand: undefined, getActiveSessionId: () => state.activeSessionId,
				isEngineSessionReady: () => state.readiness === 'ready',
				getEngineSessionReadiness: () => state.readiness, isPairingHold: () => state.pairingHold,
				onDidChangeActiveSession: sessionChanged.event, onDidChangeSession: sessionChanged.event,
				acquireSessionView: () => { throw new Error('not used'); },
			};
			const snapshot = () => ({
				generation: 1, settled: true, entries: [],
				state: state.readFailed
					? { kind: 'engine-leftover' as const, sessionId: 'session-1', reason: 'read-failed' as const }
					: { kind: 'scm' as const },
			});
			const changes: ISourcesChangesModel = {
				_serviceBrand: undefined, onDidChange: changesChanged.event, getSnapshot: snapshot,
				isWriteClosed: () => isSourcesChangesWriteClosed(snapshot().state, {
					phaseConnected: state.connected, pairingPending: state.pairingHold,
					engineConnected: state.connected, engineSessionReady: state.readiness === 'ready',
				}),
				isFileDiffOpenSkipped: () => state.readFailed || state.pairingHold,
				refresh: async () => { }, scheduleRefresh: () => { }, flushScheduledRefresh: () => { },
			};
			const instantiation = workbenchInstantiationService(undefined, store);
			instantiation.stub(IDiffProviderFactoryService, new TestDiffProviderFactoryService());
			instantiation.stub(IUserInteractionService, new MockUserInteractionService());
			instantiation.stub(IViewDescriptorService, {
				getViewLocationById: () => ViewContainerLocation.Panel,
				onDidChangeLocation: Event.None, getViewDescriptorById: () => null,
				getViewContainerByViewId: () => ({
					id: SOURCES_DIFF_PANEL_CONTAINER_ID, title: { value: 'Diff', original: 'Diff' },
					ctorDescriptor: {} as SyncDescriptor<IViewPaneContainer>,
				}),
				getViewContainerModel: () => ({ onDidChangeContainerInfo: Event.None }),
				getDefaultContainerById: () => null,
			} as unknown as IViewDescriptorService);
			instantiation.stub(IEditorProgressService, {
				_serviceBrand: undefined, show: () => emptyProgressRunner, showWhile: async promise => { await promise; },
			} satisfies IEditorProgressService);
			instantiation.stub(IUniverseAgentConnection, connection);
			instantiation.stub(IAgentSessionContext, session);
			instantiation.stub(ISourcesChangesModel, changes);
			instantiation.stub(IConversationRosterService, {
				getActiveSessionId: () => state.activeSessionId,
				onDidChangeActiveSession: sessionChanged.event, onDidChangeSession: sessionChanged.event,
				isEngineSessionReady: () => state.readiness === 'ready',
			} as unknown as IConversationRosterService);
			const gates: CommandGate[] = [];
			const calls: { id: string; resource: ISCMResource; argumentCount: number }[] = [];
			for (const id of ['git.clean', 'git.unstage', 'git.stage']) {
				store.add(CommandsRegistry.registerCommand(id, async (_accessor, ...args: ISCMResource[]) => {
					const gate = gates.find(candidate => candidate.id === id && !candidate.started.isSettled);
					assert.ok(gate, `unexpected public local command ${id}`);
					assert.strictEqual(args.length, 1);
					assert.strictEqual(args[0], gate.resource);
					calls.push({ id, resource: args[0], argumentCount: args.length });
					void gate.started.complete();
					try {
						const error = await gate.result.p;
						if (error !== undefined) {
							throw new Error(error);
						}
					} finally {
						void gate.returned.complete();
					}
				}));
			}
			instantiation.stub(ICommandService, {
				_serviceBrand: undefined, onWillExecuteCommand: Event.None, onDidExecuteCommand: Event.None,
				executeCommand: async <T>(id: string, ...args: unknown[]): Promise<T | undefined> => {
					const command = CommandsRegistry.getCommand(id);
					assert.ok(command, `missing public command ${id}`);
					await instantiation.invokeFunction(command.handler, ...args);
					return undefined;
				},
			} satisfies ICommandService);
			store.add(toDisposable(() => {
				for (const gate of gates) {
					void gate.result.complete(undefined);
				}
			}));
			const models = instantiation.get(IModelService);
			const resolver = instantiation.get(ITextModelService);
			const repositories: ISCMRepository[] = [];
			const binding = async (name: string): Promise<Binding> => {
				const modified = URI.parse(`inmemory://pane-local-git/${name}/modified`);
				const original = URI.parse(`inmemory://pane-local-git/${name}/original`);
				store.add(models.createModel('line1\nold', null, original));
				store.add(models.createModel('line1\nnew', null, modified));
				// Hold real resolver references across clear/same-object reuse.
				store.add(await resolver.createModelReference(original));
				store.add(await resolver.createModelReference(modified));
				const scm = createLeftoverScmService(modified, groupId);
				const added = [...scm.repositories];
				repositories.push(...added);
				const ref: ISourcesChangeRef = {
					modified, original, groupId, origin: 'scm',
					scmResource: added[0].provider.groups[0].resources[0],
				};
				return { ref, input: store.add(new ConversationDiffReviewInput(modified, original, groupId, ref)) };
			};
			const a = await binding('a');
			const b = await binding('b');
			instantiation.stub(ISCMService, {
				...createLeftoverScmService(a.ref.modified, groupId),
				get repositories() { return repositories; },
				get repositoryCount() { return repositories.length; },
			} satisfies ISCMService);
			const root = document.createElement('div');
			document.body.appendChild(root);
			store.add(toDisposable(() => root.remove()));
			const host = store.add(instantiation.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
			host.create(root);
			const show = async (value: Binding) => {
				await host.setInput(value.input, undefined, Object.create(null), CancellationToken.None);
				assert.strictEqual(host.didComparisonLoadFail(), false);
				assert.strictEqual(host.getComparisonLoadState(), 'ok');
				const editors = instantiation.get(ICodeEditorService).listDiffEditors().filter(editor => root.contains(editor.getContainerDomNode()));
				assert.strictEqual(editors.length, 1, 'fixture needs a real loaded DiffEditorWidget');
				assert.ok(editors[0] instanceof DiffEditorWidget);
				const model = editors[0].getModel();
				assert.ok(model);
				assert.deepStrictEqual([model.original.uri.toString(), model.modified.uri.toString()], [value.ref.original!.toString(), value.ref.modified.toString()]);
				current = value;
				await flushCompletion();
			};
			let current = a;
			await show(a);
			const button = (action: LocalAction): HTMLButtonElement => {
				const element = root.querySelector(`.conversation-diff-review-${action === 'clean' ? 'revert' : action}`);
				assert.ok(element instanceof HTMLButtonElement);
				return element;
			};
			const notice = root.querySelector('.conversation-diff-review-notice:not(.conversation-diff-review-move-notice)');
			assert.ok(notice instanceof HTMLElement);
			const feedback = () => [...root.querySelectorAll<HTMLElement>('.conversation-diff-review-stage, .conversation-diff-review-accept, .conversation-diff-review-revert, .conversation-diff-review-unstage, .conversation-diff-review-unstage-unavailable, .conversation-diff-review-notice:not(.conversation-diff-review-move-notice)')];
			const click = async (action: LocalAction) => {
				const element = button(action);
				assert.deepStrictEqual({ connected: element.isConnected, display: element.style.display, disabled: element.disabled }, {
					connected: true, display: '', disabled: false,
				}, 'fixture needs an enabled visible real DOM action');
				const gate: CommandGate = {
					id: `git.${action}`, resource: current.ref.scmResource!,
					started: new DeferredPromise<void>(), result: new DeferredPromise<string | undefined>(), returned: new DeferredPromise<void>(),
				};
				gates.push(gate);
				element.click();
				await waitForGate(`${gate.id} started`, gate.started);
				assert.strictEqual(gate.result.isSettled, false, 'command must still be pending');
				return gate;
			};
			const finish = async (gate: CommandGate, error?: string) => {
				await gate.result.complete(error);
				await waitForGate(`${gate.id} returned`, gate.returned);
				await flushCompletion();
			};
			const invalidate = async (action: Invalidation) => {
				if (action === 'replace') { await show(b); }
				else if (action === 'clear') { host.clearInput(); }
				else if (action === 'clear-and-restore') { host.clearInput(); await show(a); assert.strictEqual(host.input, a.input); }
				else if (action === 'input-dispose') { a.input.dispose(); assert.strictEqual(host.input, a.input); assert.strictEqual(a.input.isDisposed(), true); }
				else { host.dispose(); }
				await flushCompletion();
			};
			return {
				a, b, show, state, notice, button, click, finish, invalidate, feedback,
				noticeState: () => ({ text: notice.textContent, display: notice.style.display, error: notice.classList.contains('is-error') }),
				notify: () => { sessionChanged.fire(state.activeSessionId); connectionChanged.fire(); changesChanged.fire(); },
				assertCalls: (expected: { action: LocalAction; owner: Binding }[]) => {
					assert.deepStrictEqual(calls, expected.map(({ action, owner }) => ({ id: `git.${action}`, resource: owner.ref.scmResource!, argumentCount: 1 })));
					for (const [index, value] of expected.entries()) {
						assert.strictEqual(calls[index].resource, value.owner.ref.scmResource, 'fixed resource object identity');
					}
					assert.deepStrictEqual(unary, [], 'local-only entry and completion must send zero engine unary');
				},
				releaseAll: async () => {
					for (const gate of gates) { await gate.result.complete(undefined); }
					await flushCompletion();
				},
			};
		}

		for (const action of ['clean', 'unstage'] as const) {
			const group = action === 'unstage' ? 'index' : 'workingTree';
			for (const target of ['replace', 'clear'] as const) {
				test(`R1 ${action} old failure after ${target} leaves current notice unchanged`, async () => {
					const h = await mountLocalGitHost(group);
					try {
						const old = await h.click(action);
						await h.invalidate(target);
						const expected = h.noticeState();
						await h.finish(old, 'sentinel-A');
						assert.deepStrictEqual(h.noticeState(), expected);
						h.assertCalls([{ action, owner: h.a }]);
					} finally { await h.releaseAll(); }
				});
			}
			test(`R2 ${action} old success preserves the new owner's public command error`, async () => {
				const h = await mountLocalGitHost(group);
				try {
					const old = await h.click(action);
					await h.show(h.b);
					const next = await h.click(action);
					await h.finish(next, 'sentinel-B');
					assert.strictEqual(h.notice.textContent, 'sentinel-B');
					const expected = h.noticeState();
					await h.finish(old);
					assert.deepStrictEqual(h.noticeState(), expected);
					h.assertCalls([{ action, owner: h.a }, { action, owner: h.b }]);
				} finally { await h.releaseAll(); }
			});
			test(`R3 ${action} old success preserves the different URI current collapse`, async () => {
				const h = await mountLocalGitHost(group);
				try {
					const old = await h.click(action);
					await h.show(h.b);
					const next = await h.click(action);
					await h.finish(next);
					assert.strictEqual(h.button(action).style.display, 'none', 'current B command must first collapse its real button');
					await h.finish(old);
					assert.strictEqual(h.button(action).style.display, 'none', 'late A must not expose B action again');
					h.assertCalls([{ action, owner: h.a }, { action, owner: h.b }]);
				} finally { await h.releaseAll(); }
			});
		}

		for (const action of ['clean', 'unstage', 'stage'] as const) {
			for (const invalidation of ['replace', 'clear', 'clear-and-restore', 'dispose', 'input-dispose'] as const) {
				for (const outcome of ['resolve', 'reject'] as const) {
					test(`R4/R5 ${action} ${outcome} after ${invalidation} writes no covered feedback setters`, async () => {
						const h = await mountLocalGitHost(action === 'unstage' ? 'index' : 'workingTree');
						try {
							const old = await h.click(action);
							const retained = h.feedback();
							await h.invalidate(invalidation);
							const expected = h.noticeState();
							const observation = observeFeedback([...retained, ...h.feedback()]);
							try {
								await h.finish(old, outcome === 'reject' ? 'late-A' : undefined);
								assert.deepStrictEqual({ writes: observation.writes, notice: h.noticeState() }, { writes: [], notice: expected });
								h.assertCalls([{ action, owner: h.a }]);
							} finally { observation.dispose(); }
						} finally { await h.releaseAll(); }
					});
				}
			}
			for (const outcome of ['resolve', 'reject'] as const) {
				test(`P1 current ${action} ${outcome} retains local completion semantics`, async () => {
					const h = await mountLocalGitHost(action === 'unstage' ? 'index' : 'workingTree');
					try {
						const seed = await h.click(action);
						await h.finish(seed, 'previous-error');
						assert.strictEqual(h.notice.textContent, 'previous-error');
						const current = await h.click(action);
						await h.finish(current, outcome === 'reject' ? 'current-error' : undefined);
						assert.deepStrictEqual(h.noticeState(), outcome === 'reject'
							? { text: 'current-error', display: '', error: true }
							: { text: '', display: 'none', error: false });
						assert.strictEqual(h.button(action).style.display, outcome === 'reject' || action === 'stage' ? '' : 'none');
						if (action === 'stage') {
							assert.strictEqual(h.button('clean').style.display, '', 'local Stage must not collapse Revert');
						}
						h.assertCalls([{ action, owner: h.a }, { action, owner: h.a }]);
					} finally { await h.releaseAll(); }
				});
			}
		}

		for (const action of ['clean', 'unstage'] as const) {
			for (const last of ['resolve', 'reject'] as const) {
				test(`P2 same-owner ${action} reverse completion keeps the last ${last} feedback`, async () => {
					const h = await mountLocalGitHost(action === 'unstage' ? 'index' : 'workingTree');
					try {
						const first = await h.click(action);
						const second = await h.click(action);
						await h.finish(second, last === 'resolve' ? 'second-error' : undefined);
						await h.finish(first, last === 'reject' ? 'first-error' : undefined);
						assert.strictEqual(h.notice.textContent, last === 'reject' ? 'first-error' : '');
						assert.strictEqual(h.button(action).style.display, 'none');
						h.assertCalls([{ action, owner: h.a }, { action, owner: h.a }]);
					} finally { await h.releaseAll(); }
				});
			}
		}
		for (const outcome of ['resolve', 'reject'] as const) {
			test(`P2 same-owner pending clean survives a real local Stage before its ${outcome}`, async () => {
				const h = await mountLocalGitHost();
				try {
					const clean = await h.click('clean');
					const stage = await h.click('stage');
					await h.finish(stage);
					assert.strictEqual(h.button('clean').style.display, '');
					assert.strictEqual(h.button('stage').style.display, '');
					await h.finish(clean, outcome === 'reject' ? 'clean-error' : undefined);
					assert.strictEqual(h.notice.textContent, outcome === 'reject' ? 'clean-error' : '');
					assert.strictEqual(h.button('clean').style.display, outcome === 'reject' ? '' : 'none');
					h.assertCalls([{ action: 'clean', owner: h.a }, { action: 'stage', owner: h.a }]);
				} finally { await h.releaseAll(); }
			});
		}

		for (const change of ['active-session', 'connection', 'readiness', 'pairing', 'read-failed'] as const) {
			for (const outcome of ['resolve', 'reject'] as const) {
				test(`P3 same owner ${change} preserves the already sent ${outcome} and does not resend`, async () => {
					const h = await mountLocalGitHost();
					try {
						const seed = await h.click('clean');
						await h.finish(seed, 'previous-error');
						const pending = await h.click('clean');
						if (change === 'active-session') { h.state.activeSessionId = 'session-2'; }
						if (change === 'connection') { h.state.connected = true; }
						if (change === 'readiness') { h.state.connected = true; h.state.readiness = 'unavailable'; }
						if (change === 'pairing') { h.state.connected = true; h.state.pairingHold = true; }
						if (change === 'read-failed') { h.state.readFailed = true; }
						h.notify();
						await flushCompletion();
						const closed = change === 'readiness' || change === 'pairing' || change === 'read-failed';
						if (closed) { assert.strictEqual(h.button('clean').style.display, 'none'); }
						await h.finish(pending, outcome === 'reject' ? 'same-owner-error' : undefined);
						assert.strictEqual(h.notice.textContent, outcome === 'reject' ? 'same-owner-error' : '');
						if (closed) { assert.strictEqual(h.button('clean').style.display, 'none', 'fresh closed chrome remains closed'); }
						h.state.connected = false;
						h.state.pairingHold = false;
						h.state.readiness = 'ready';
						h.state.readFailed = false;
						h.notify();
						await flushCompletion();
						assert.strictEqual(h.button('clean').style.display, outcome === 'reject' ? '' : 'none');
						h.assertCalls([{ action: 'clean', owner: h.a }, { action: 'clean', owner: h.a }]);
					} finally { await h.releaseAll(); }
				});
			}
		}
	});
});
