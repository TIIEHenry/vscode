/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { NullCommandService } from '../../../../../platform/commands/test/common/nullCommandService.js';
import { mainWindow } from '../../../../../base/browser/window.js';
import { DeferredPromise, timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize } from '../../../../../nls.js';
import { EditorActivation, EditorOpenSource, IResourceEditorInput } from '../../../../../platform/editor/common/editor.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { CommandsRegistry, ICommandEvent, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { getSelectionKeyboardEvent, WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { createEmptyCapabilitySnapshot } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import type {
	UniverseAgentConnectionSnapshot,
	UniverseAgentWriteGitCommitRequest,
	UniverseAgentWriteGitStagePathsRequest,
	UniverseAgentWriteGitWriteResult,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { registerTestEditor, TestEditorGroupsService, TestEditorGroupView, TestEditorInput, TestEditorService, workbenchInstantiationService, workbenchTeardown } from '../../../../test/browser/workbenchTestServices.js';
import { API_OPEN_DIFF_EDITOR_COMMAND_ID, API_OPEN_EDITOR_COMMAND_ID, setup as setupEditorCommands } from '../../../../browser/parts/editor/editorCommands.js';
import { isConversationPairingHold } from '../../../conversation/browser/conversationSessionStatus.js';
import { IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';
import { ISCMResource, ISCMResourceGroup, ISCMService } from '../../../scm/common/scm.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { DiffEditorInput } from '../../../../common/editor/diffEditorInput.js';
import { EditorGroupModel } from '../../../../common/editor/editorGroupModel.js';
import { EditorExtensions, EditorsOrder, IEditorFactoryRegistry, IEditorWillOpenEvent, IUntypedEditorInput, IVisibleEditorPane, isResourceDiffEditorInput, isResourceEditorInput } from '../../../../common/editor.js';
import { ACTIVE_GROUP, IEditorService } from '../../../../services/editor/common/editorService.js';
import { GroupDirection, IEditorGroup, IEditorGroupsService, preferredSideBySideGroupDirection } from '../../../../services/editor/common/editorGroupsService.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { StorageScope } from '../../../../../platform/storage/common/storage.js';
import { Memento } from '../../../../common/memento.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { EditorParts } from '../../../../browser/parts/editor/editorParts.js';
import { CategorizedMainEditorPart } from '../../../../browser/parts/editor/categorizedMainEditorPart.js';
import { EditorService } from '../../../../services/editor/browser/editorService.js';
import { editorGroupToColumn } from '../../../../services/editor/common/editorGroupColumn.js';
import { PreviewCategory } from '../../../../services/editor/common/previewCategoryService.js';
import { resolveSourcesChangeRefFromEditor } from '../../browser/sourcesDiffRefHelpers.js';
import { ConversationChatInput, getConversationChatResource, getDefaultConversationChatResource } from '../../../conversation/common/conversationChatInput.js';
import { createSourcesConversationOpenHarness } from './sourcesConversationOpenHarness.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import { type IAgentWorkRoot, resolveAgentLocalRoot } from '../../../../services/agentSession/common/agentWorkRoot.js';
import { sourcesRepositoryRootUris } from '../../common/sourcesChangesGit.js';
import { SourcesChangesList } from '../../browser/sourcesChangesList.js';
import { conversationDiffComparisonLoadFailedMessage } from '../../browser/conversationDiffReviewPane.js';
import { openSourcesChangeEntry, openSourcesChangeInConversation, ISourcesChangeEntryOpenDeps, sourcesConversationLeafMissingMessage } from '../../browser/sourcesChangeEntryOpen.js';
import { SOURCES_GIT_UNROOTED_SCHEME, sourcesGitDiffOpenFailureMessage, sourcesGitEmptyFileDiffMessage, sourcesGitLocalOnlyMessage, sourcesGitReadFailureMessage, sourcesGitReadPairingHoldMessage, sourcesGitReadUnavailableNoHookMessage } from '../../common/sourcesChangesGitRead.js';
import { sourcesGitDiffContentStore, sourcesGitDiffModelUri } from '../../browser/sourcesGitDiffContent.js';
import { sourcesGitEmptyStagePathMessage, sourcesGitSessionChangedMessage } from '../../common/sourcesChangesGitWrite.js';
import { ConversationDiffReviewInput } from '../../browser/conversationDiffReviewInput.js';
import { rememberSourcesDiffOpenIdentity, sourcesDiffOpenIdentity } from '../../browser/sourcesDiffOpenIdentity.js';
import { ISourcesChangeEntry, ISourcesChangesModel } from '../../common/sourcesChangesModel.js';
import { SourcesChangesModel } from '../../common/sourcesChangesReadModel.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';

// Isolate the active A pane without changing diff identity, matching or model behavior.
class SourcesHostDiffInput extends DiffEditorInput { }

suite('Sources - Changes list open', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	suiteSetup(() => {
		// These startup registrations live for the test process, outside each test's disposable scope.
		if (!CommandsRegistry.getCommand(API_OPEN_EDITOR_COMMAND_ID) || !CommandsRegistry.getCommand(API_OPEN_DIFF_EDITOR_COMMAND_ID)) {
			setupEditorCommands();
		}
	});

	function createEntry(resource: URI, scmResource?: ISCMResource): ISourcesChangeEntry {
		return {
			resource,
			name: resource.path.split('/').pop() ?? '',
			description: 'Changes',
			groupId: 'workingTree',
			scmResource,
		};
	}

	function createDeps(overrides: Partial<ISourcesChangeEntryOpenDeps> & Pick<ISourcesChangeEntryOpenDeps, 'editorService'>): ISourcesChangeEntryOpenDeps {
		const configurationService = new TestConfigurationService();
		return {
			commandService: NullCommandService,
			quickDiffService: {
				getQuickDiffs: async () => [],
			} as unknown as IQuickDiffService,
			configurationService,
			instantiationService: {
				createInstance: (ctor: typeof ConversationDiffReviewInput, modified: URI, original?: URI) =>
					store.add(new ctor(modified, original)),
			} as unknown as ISourcesChangeEntryOpenDeps['instantiationService'],
			sourcesDiffPanelService: {
				show: async () => { },
			} as unknown as ISourcesDiffPanelService,
			...overrides,
		};
	}

	function commandResource(resource: URI, command: ISCMResource['command'], open: ISCMResource['open'], comparison?: readonly [URI, URI]): ISCMResource {
		return {
			get resourceGroup(): ISCMResourceGroup { throw new Error('opening a resource must not inspect its group'); },
			sourceUri: resource,
			decorations: {},
			contextValue: undefined,
			command,
			multiDiffEditorOriginalUri: comparison?.[0],
			multiDiffEditorModifiedUri: comparison?.[1],
			open,
		};
	}

	function diffInput(original: URI, modified: URI, editorService: IEditorService): DiffEditorInput {
		return store.add(new DiffEditorInput(undefined, undefined,
			store.add(new TestEditorInput(original, 'test.original')),
			store.add(new TestEditorInput(modified, 'test.modified')),
			undefined, editorService));
	}

	function visiblePane(input: EditorInput, group: IEditorGroup): IVisibleEditorPane {
		return new class extends mock<IVisibleEditorPane>() {
			override readonly input = input;
			override readonly group = group;
		}();
	}

	function identitySnapshot(input: EditorInput, expectedResource: ISCMResource) {
		const identity = sourcesDiffOpenIdentity(input);
		// Keep failure reports away from SCM getters and the editor's service graph.
		return identity ? { groupId: identity.groupId, sameResource: identity.scmResource === expectedResource } : undefined;
	}

	for (const commandId of [API_OPEN_EDITOR_COMMAND_ID, API_OPEN_DIFF_EDITOR_COMMAND_ID]) {
		for (const slot of [undefined, 'newTab', 'replace'] as const) {
			for (const preserveFocus of [false, true]) {
				test(`API SCM ${commandId} ${slot ?? 'no slot'} preserveFocus=${preserveFocus} dispatches its DTO once`, async () => {
					const resource = URI.file('/project/shared.ts');
					const original = URI.parse('git:/project/shared.ts?baseline');
					// These are the ext-host API converters' optional argument slots.
					const providerOptions = [2, { preserveFocus: false, pinned: false }];
					const args = commandId === API_OPEN_EDITOR_COMMAND_ID
						? [resource, providerOptions, undefined]
						: [original, resource, 'Shared change', providerOptions];
					let resourceOpens = 0;
					const scmResource = commandResource(resource, { id: commandId, title: '', arguments: args }, async () => { resourceOpens++; });
					const commands: ICommandEvent[] = [];
					const commandService: ICommandService = {
						...NullCommandService,
						executeCommand: async (id, ...commandArgs) => {
							commands.push({ commandId: id, args: commandArgs });
							return undefined; // A fulfilled API command has a void contract.
						},
					};
					const opened = await openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({
						commandService,
						editorService: store.add(new TestEditorService()),
					}), { slot, preserveFocus, pinned: false });

					assert.strictEqual(opened, true);
					assert.strictEqual(resourceOpens, 0);
					assert.deepStrictEqual(commands, [{ commandId, args: [...args, {
						editorOptions: { preserveFocus, pinned: slot ? true : false, source: EditorOpenSource.USER },
						sideBySide: false,
					}] }]);
					assert.deepStrictEqual(providerOptions, [2, { preserveFocus: false, pinned: false }]);
					assert.strictEqual(args.length, commandId === API_OPEN_EDITOR_COMMAND_ID ? 3 : 4);
				});
			}
		}
	}

	for (const commandId of [API_OPEN_EDITOR_COMMAND_ID, API_OPEN_DIFF_EDITOR_COMMAND_ID]) {
		for (const rejects of [false, true]) {
			test(`API SCM ${commandId} newTab ${rejects ? 'rejects' : 'resolves'} without pre-pinning the focused preview`, async () => {
				const resource = URI.file('/alpha/shared.ts');
				const previous = store.add(new TestEditorInput(URI.file('/beta/shared.ts'), 'test.beta'));
				const group = new TestEditorGroupView(45);
				group.activeEditor = previous;
				group.editors = [previous];
				const trace: string[] = [];
				group.pinEditor = () => { trace.push('pin'); };
				group.closeEditor = async () => { trace.push('close'); return true; };
				const editorService = store.add(new TestEditorService());
				editorService.activeEditor = previous;
				const providerOptions = [2, { pinned: false, preserveFocus: true }];
				const args = commandId === API_OPEN_EDITOR_COMMAND_ID
					? [resource, providerOptions, undefined]
					: [URI.parse('git:/alpha/shared.ts?index'), resource, undefined, providerOptions];
				const scmResource = commandResource(resource, { id: commandId, title: '', arguments: args }, async () => { trace.push('resource.open'); });
				const boom = new Error('provider rejected');
				const open = () => openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({
					editorService,
					editorGroupsService: new TestEditorGroupsService([group]),
					commandService: { ...NullCommandService, executeCommand: async () => {
						trace.push('command');
						if (rejects) {
							throw boom;
						}
						return undefined;
					} },
				}), { slot: 'newTab', pinned: true, preserveFocus: true });
				if (rejects) {
					await assert.rejects(open, error => error === boom);
				} else {
					assert.strictEqual(await open(), true);
				}
				assert.deepStrictEqual({ trace, identity: sourcesDiffOpenIdentity(previous) }, { trace: ['command'], identity: undefined });
			});
		}

		test(`API SCM ${commandId} runs the official handler with provider column and options taking priority`, async () => {
			const instantiationService = workbenchInstantiationService(undefined, store);
			const groups = new TestEditorGroupsService([new TestEditorGroupView(46), new TestEditorGroupView(47), new TestEditorGroupView(48)]);
			const editorService = store.add(new TestEditorService());
			const opened: { input: EditorInput | IUntypedEditorInput; group: number | undefined }[] = [];
			editorService.openEditor = async (input, optionsOrGroup) => {
				opened.push({ input, group: typeof optionsOrGroup === 'number' ? optionsOrGroup : undefined });
				return undefined;
			};
			instantiationService.stub(IEditorService, editorService);
			instantiationService.stub(IEditorGroupsService, groups);
			instantiationService.stub(IOpenerService, new class extends mock<IOpenerService>() { }());
			const resource = URI.file('/alpha/priority.ts');
			const original = URI.parse('git:/alpha/priority.ts?index');
			const providerOptions = [2, { pinned: false, preserveFocus: false }];
			const args = commandId === API_OPEN_EDITOR_COMMAND_ID
				? [resource, providerOptions, undefined]
				: [original, resource, 'Priority', providerOptions];
			const scmResource = commandResource(resource, { id: commandId, title: '', arguments: args }, async () => assert.fail('API DTO must not fall back to resource.open'));
			const commandService: ICommandService = { ...NullCommandService, executeCommand: async (id, ...commandArgs) => {
				const command = CommandsRegistry.getCommand(id);
				assert.ok(command);
				await instantiationService.invokeFunction(accessor => command.handler(accessor, ...commandArgs));
				return undefined;
			} };
			assert.strictEqual(await openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({
				editorService, commandService, editorGroupsService: groups,
			}), { slot: 'newTab', pinned: true, preserveFocus: true }), true);
			assert.strictEqual(opened.length, 1);
			const request = opened[0];
			assert.ok(!(request.input instanceof EditorInput));
			assert.deepStrictEqual({ group: request.group, options: request.input.options }, {
				group: 48, options: { pinned: false, preserveFocus: false, source: EditorOpenSource.USER },
			});
			if (commandId === API_OPEN_DIFF_EDITOR_COMMAND_ID) {
				assert.ok(isResourceDiffEditorInput(request.input));
				assert.ok(request.input.original.resource);
				assert.ok(request.input.modified.resource);
				assert.deepStrictEqual([request.input.original.resource.toString(), request.input.modified.resource.toString()], [original.toString(), resource.toString()]);
			} else {
				assert.ok(isResourceEditorInput(request.input));
				assert.strictEqual(request.input.resource?.toString(), resource.toString());
			}
		});
	}

	for (const providerPinned of [undefined, false] as const) {
		test(`API newTab real group model honors ${providerPinned === false ? 'provider pinned:false' : 'the default pinned input'}`, async () => {
			const instantiationService = workbenchInstantiationService(undefined, store);
			const model = store.add(instantiationService.createInstance(EditorGroupModel, undefined));
			const previous = store.add(new TestEditorInput(URI.file('/beta/preview.ts'), 'test.preview'));
			const resource = URI.file('/alpha/new.ts');
			const opened = store.add(new TestEditorInput(resource, 'test.new'));
			model.openEditor(previous, { pinned: false, active: true });
			const group = new TestEditorGroupView(49);
			group.activeEditor = previous;
			group.editors = [previous];
			group.pinEditor = () => assert.fail('the API path must not pre-pin the old preview');
			const groups = new TestEditorGroupsService([group]);
			const editorService = store.add(new TestEditorService());
			editorService.openEditor = async input => {
				assert.ok(!(input instanceof EditorInput));
				model.openEditor(opened, { pinned: input.options?.pinned, active: true });
				group.activeEditor = opened;
				group.editors = model.getEditors(EditorsOrder.SEQUENTIAL);
				editorService.activeEditor = opened;
				return undefined;
			};
			instantiationService.stub(IEditorService, editorService);
			instantiationService.stub(IEditorGroupsService, groups);
			instantiationService.stub(IOpenerService, new class extends mock<IOpenerService>() { }());
			const scmResource = commandResource(resource, {
				id: API_OPEN_EDITOR_COMMAND_ID, title: '', arguments: [resource, [0, providerPinned === false ? { pinned: false } : undefined], undefined],
			}, async () => assert.fail('API DTO must not call resource.open'));
			const commandService: ICommandService = { ...NullCommandService, executeCommand: async (id, ...args) => {
				const command = CommandsRegistry.getCommand(id);
				assert.ok(command);
				await instantiationService.invokeFunction(accessor => command.handler(accessor, ...args));
				return undefined;
			} };
			await openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({ editorService, commandService, editorGroupsService: groups }), { slot: 'newTab' });
			assert.deepStrictEqual({
				editors: model.getEditors(EditorsOrder.SEQUENTIAL), preview: model.previewEditor,
				openedPinned: model.isPinned(opened),
			}, providerPinned === false
				? { editors: [opened], preview: opened, openedPinned: false }
				: { editors: [previous, opened], preview: previous, openedPinned: true });
		});
	}

	for (const slot of ['newTab', 'replace'] as const) {
		for (const result of ['no-op', 'same comparison', 'background comparison', 'current comparison'] as const) {
			test(`API diff ${slot} ${result} uses the complete DTO comparison identity`, async () => {
				const modified = URI.file('/alpha/shared.ts');
				const oldOriginal = URI.parse('git:/alpha/shared.ts?HEAD');
				const newOriginal = result === 'same comparison' ? oldOriginal : URI.parse('git:/alpha/shared.ts?index');
				const editorService = store.add(new TestEditorService());
				const previous = diffInput(oldOriginal, modified, editorService);
				const opened = result === 'same comparison' ? previous : diffInput(newOriginal, modified, editorService);
				const group = new TestEditorGroupView(50);
				group.activeEditor = previous;
				group.editors = [previous];
				const background = new TestEditorGroupView(51);
				const trace: string[] = [];
				group.pinEditor = () => { trace.push('pin:previous'); };
				group.closeEditor = async input => { assert.strictEqual(input, previous); trace.push('close:previous'); return true; };
				background.pinEditor = () => { trace.push('pin:background'); };
				editorService.activeEditor = previous;
				editorService.activeEditorPane = visiblePane(previous, group);
				editorService.visibleEditorPanes = [editorService.activeEditorPane];
				const oldResource = commandResource(modified, undefined, async () => { });
				const oldIdentity = { groupId: 'workingTree', scmResource: oldResource };
				rememberSourcesDiffOpenIdentity(previous, oldIdentity);
				const scmResource = commandResource(modified, {
					id: API_OPEN_DIFF_EDITOR_COMMAND_ID, title: '', arguments: [newOriginal.toJSON(), modified.toJSON(), undefined, [1, { preserveFocus: true, pinned: false }]],
				}, async () => assert.fail('API diff must not use resource.open'));
				const commandService: ICommandService = { ...NullCommandService, executeCommand: async () => {
					trace.push('command');
					if (result === 'background comparison') {
						background.activeEditor = opened;
						background.editors = [opened];
						editorService.visibleEditorPanes = [visiblePane(previous, group), visiblePane(opened, background)];
					} else if (result === 'current comparison') {
						group.activeEditor = opened;
						group.editors = [previous, opened];
						editorService.activeEditor = opened;
						editorService.activeEditorPane = visiblePane(opened, group);
					}
					return undefined;
				} };
				assert.strictEqual(await openSourcesChangeEntry({ ...createEntry(modified, scmResource), groupId: 'index' }, createDeps({
					editorService, commandService, editorGroupsService: new TestEditorGroupsService([group, background]),
					// A quickDiff baseline is deliberately different from the provider DTO.
					quickDiffService: new class extends mock<IQuickDiffService>() {
						override async getQuickDiffs() { return [{ id: 'git', originalResource: URI.parse('git:/alpha/shared.ts?quickDiff'), label: 'Git', kind: 'primary' as const }]; }
					}(),
				}), { slot, preserveFocus: true }), true);
				assert.deepStrictEqual({
					previousIdentity: identitySnapshot(previous, result === 'same comparison' ? scmResource : oldResource),
					openedIdentity: identitySnapshot(opened, scmResource), trace,
				}, {
					previousIdentity: { groupId: result === 'same comparison' ? 'index' : 'workingTree', sameResource: true },
					openedIdentity: result === 'no-op' ? undefined : { groupId: 'index', sameResource: true },
					trace: slot === 'replace' && result === 'current comparison' ? ['command', 'close:previous'] : ['command'],
				});
			});
		}
	}


	for (const kind of ['file', 'diff'] as const) {
		for (const slot of ['newTab', 'replace'] as const) {
			test(`delegated host official ${kind} ${slot} records inactive B and its canonical reveal while A stays active`, async () => {
				const disposables = store.add(new DisposableStore());
				disposables.add(registerTestEditor('SourcesHostTestEditor', [new SyncDescriptor(TestEditorInput), new SyncDescriptor(SourcesHostDiffInput)]));
				const instantiationService = workbenchInstantiationService(undefined, disposables);
				instantiationService.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));
				try {
					const parts = disposables.add(instantiationService.createInstance(EditorParts));
					parts.mainPart.create(document.createElement('div'));
					parts.mainPart.layout(1080, 800, 0, 0);
					await parts.whenReady;
					const main = parts.mainPart;
					assert.ok(main instanceof CategorizedMainEditorPart);
					instantiationService.stub(IEditorGroupsService, parts);
					const editorService = disposables.add(instantiationService.createInstance(EditorService, undefined));
					instantiationService.stub(IEditorService, editorService);
					instantiationService.stub(IOpenerService, new class extends mock<IOpenerService>() { }());
					const requests: EditorInput[] = [];
					disposables.add(editorService.onWillOpenEditor(event => {
						requests.push(event.editor);
						disposables.add(event.editor);
						if (event.editor instanceof DiffEditorInput) {
							disposables.add(event.editor.original);
							disposables.add(event.editor.modified);
						}
					}));
					const groupA = main.ensureCategoryGroup(PreviewCategory.Code);
					const groupB = main.addGroupInCategory(groupA, GroupDirection.RIGHT, PreviewCategory.Code);
					const modified = URI.file('/host/shared.ts');
					const original = URI.file('/host/shared.original.ts');
					const inputA = kind === 'diff'
						? store.add(new SourcesHostDiffInput(undefined, undefined, store.add(new TestEditorInput(original, 'test.host-original')), store.add(new TestEditorInput(modified, 'test.host-modified')), undefined, editorService))
						: store.add(new TestEditorInput(modified, 'test.host-file'));
					const blocker = store.add(new TestEditorInput(URI.file('/host/blocker.ts'), 'test.host-blocker'));
					await editorService.openEditor(inputA, { pinned: false }, groupA);
					await editorService.openEditor(blocker, { pinned: true }, groupB);
					parts.activateGroup(groupA.id);
					assert.strictEqual(main.getGroupCategory(groupA), PreviewCategory.Code);
					assert.strictEqual(main.getGroupCategory(groupB), PreviewCategory.Code);
					const oldResource = commandResource(modified, undefined, async () => { });
					rememberSourcesDiffOpenIdentity(inputA, { groupId: 'workingTree', scmResource: oldResource });
					const column = editorGroupToColumn(parts, groupB);
					assert.ok(column >= 0);
					const commandId = kind === 'diff' ? API_OPEN_DIFF_EDITOR_COMMAND_ID : API_OPEN_EDITOR_COMMAND_ID;
					const providerOptions = [column, { inactive: true, activation: EditorActivation.PRESERVE, pinned: false, preserveFocus: true }];
					const args = kind === 'diff' ? [original, modified, undefined, providerOptions] : [modified, providerOptions, undefined];
					let calls = 0;
					const commandService: ICommandService = { ...NullCommandService, executeCommand: async (id, ...commandArgs) => {
						calls++;
						const command = CommandsRegistry.getCommand(id);
						assert.ok(command);
						await instantiationService.invokeFunction(accessor => command.handler(accessor, ...commandArgs));
						return undefined;
					} };
					const first = commandResource(modified, { id: commandId, title: '', arguments: args }, async () => assert.fail('official API must not call custom.open'));
					const deps = createDeps({ editorService, editorGroupsService: parts, commandService });
					assert.strictEqual(await openSourcesChangeEntry({ ...createEntry(modified, first), groupId: 'index' }, deps, { slot }), true);
					const opened = groupB.editors.find(input => input !== blocker);
					assert.ok(opened);
					assert.ok(opened !== inputA);
					assert.deepStrictEqual({
						activeA: parts.activeGroup === groupA && groupA.activeEditor === inputA,
						activeB: groupB.activeEditor === blocker, pinnedA: groupA.isPinned(inputA), pinnedB: groupB.isPinned(opened),
						visibleB: editorService.visibleEditorPanes.some(pane => pane.input === opened),
						identityA: identitySnapshot(inputA, oldResource), identityB: identitySnapshot(opened, first), calls,
					}, {
						activeA: true, activeB: true, pinnedA: false, pinnedB: false, visibleB: false,
						identityA: { groupId: 'workingTree', sameResource: true }, identityB: { groupId: 'index', sameResource: true }, calls: 1,
					});
					const beforeReveal = requests.length;
					const second = commandResource(modified, { id: commandId, title: '', arguments: args }, async () => assert.fail('official API must not call custom.open'));
					assert.strictEqual(await openSourcesChangeEntry({ ...createEntry(modified, second), groupId: 'staged-again' }, deps, { slot }), true);
					assert.deepStrictEqual({
						calls, countB: groupB.editors.length, retainsB: groupB.editors.includes(opened),
						activeA: parts.activeGroup === groupA && groupA.activeEditor === inputA,
						identityA: identitySnapshot(inputA, oldResource), identityB: identitySnapshot(opened, second),
					}, {
						calls: 2, countB: 2, retainsB: true, activeA: true,
						identityA: { groupId: 'workingTree', sameResource: true }, identityB: { groupId: 'staged-again', sameResource: true },
					});
					if (kind === 'diff') {
						assert.ok(requests.slice(beforeReveal).some(input => input !== opened));
						const ref = resolveSourcesChangeRefFromEditor(opened, new class extends mock<ISCMService>() { override readonly repositories = []; }());
						assert.deepStrictEqual({ groupId: ref?.groupId, sameResource: ref?.scmResource === second, original: ref?.original?.toString(), modified: ref?.modified.toString() }, {
							groupId: 'staged-again', sameResource: true, original: original.toString(), modified: modified.toString(),
						});
					}
				} finally {
					try {
						await workbenchTeardown(instantiationService);
					} finally {
						disposables.dispose();
						Memento.clear(StorageScope.WORKSPACE);
						Memento.clear(StorageScope.PROFILE);
					}
				}
			});
		}
	}

	function observedScmHarness() {
		const events = store.add(new Emitter<IEditorWillOpenEvent>());
		const editorService = store.add(new class extends TestEditorService {
			override readonly onWillOpenEditor = events.event;
		}());
		const groups = [new TestEditorGroupView(80), new TestEditorGroupView(81), new TestEditorGroupView(82)];
		const previous = store.add(new TestEditorInput(URI.file('/old/preview.ts'), 'test.old-preview'));
		groups[0].activeEditor = previous;
		groups[0].editors = [previous];
		editorService.activeEditor = previous;
		editorService.activeEditorPane = visiblePane(previous, groups[0]);
		const trace: string[] = [];
		for (const group of groups) {
			group.pinEditor = input => trace.push(input === previous ? 'pin:previous' : 'pin:new');
			group.closeEditor = async () => { trace.push('close'); return true; };
		}
		const editorGroupsService = new TestEditorGroupsService(groups);
		const place = (input: EditorInput, group = groups[1], candidate = input) => {
			events.fire({ editor: candidate, groupId: group.id });
			group.editors = [input];
			group.activeEditor = input;
			editorService.visibleEditorPanes = [
				...(editorService.visibleEditorPanes ?? []).filter(pane => pane.group !== group),
				visiblePane(input, group),
			];
		};
		return { editorService, editorGroupsService, groups, events, previous, trace, place };
	}

	function pendingScmOpen(harness: ReturnType<typeof observedScmHarness>, options: {
		readonly kind?: 'file' | 'diff' | 'custom';
		readonly modified?: URI;
		readonly original?: URI;
		readonly groupId?: string;
		readonly slot?: 'newTab' | 'replace';
		readonly onEnter?: () => void;
		readonly reject?: Error;
	}) {
		const modified = options.modified ?? URI.file('/overlap/shared.ts');
		const original = options.original ?? URI.parse('git:/overlap/shared.ts?index#baseline');
		const entered = new DeferredPromise<void>();
		const released = new DeferredPromise<void>();
		let calls = 0;
		const run = async () => {
			calls++;
			options.onEnter?.();
			await entered.complete();
			await released.p;
			if (options.reject) {
				throw options.reject;
			}
		};
		const kind = options.kind ?? 'diff';
		const command = kind === 'custom' ? undefined : kind === 'file'
			? { id: API_OPEN_EDITOR_COMMAND_ID, title: '', arguments: [modified, [0, { pinned: false }], undefined] }
			: { id: API_OPEN_DIFF_EDITOR_COMMAND_ID, title: '', arguments: [original, modified, undefined, [0, { pinned: false }]] };
		const scmResource = commandResource(modified, command, kind === 'custom' ? run : async () => assert.fail('API must not call custom.open'), [original, modified]);
		const result = openSourcesChangeEntry({ ...createEntry(modified, scmResource), groupId: options.groupId ?? 'index' }, createDeps({
			editorService: harness.editorService, editorGroupsService: harness.editorGroupsService,
			commandService: { ...NullCommandService, executeCommand: async () => { await run(); return undefined; } },
		}), { slot: options.slot ?? 'replace', preserveFocus: true });
		return { result, entered: entered.p, release: () => released.complete(), scmResource, get calls() { return calls; } };
	}

	for (const firstToSettle of ['g1', 'g2'] as const) {
		test(`Sources overlap same tuple ${firstToSettle} settles first never attributes B to the no-op delegate`, async () => {
			const harness = observedScmHarness();
			const input = diffInput(URI.parse('git:/overlap/shared.ts?index#baseline'), URI.file('/overlap/shared.ts'), harness.editorService);
			const oldResource = commandResource(URI.file('/overlap/shared.ts'), undefined, async () => { });
			rememberSourcesDiffOpenIdentity(input, { groupId: 'old', scmResource: oldResource });
			const first = pendingScmOpen(harness, { groupId: 'g1' });
			await first.entered;
			const second = pendingScmOpen(harness, { groupId: 'g2', onEnter: () => harness.place(input) });
			await second.entered;
			const order = firstToSettle === 'g1' ? [first, second] : [second, first];
			for (const operation of order) {
				await operation.release();
				assert.strictEqual(await operation.result, true);
			}
			assert.deepStrictEqual({ calls: [first.calls, second.calls], identity: identitySnapshot(input, oldResource), trace: harness.trace, listening: harness.events.hasListeners }, {
				calls: [1, 1], identity: { groupId: 'old', sameResource: true }, trace: [], listening: false,
			});
		});
	}


	test('Sources overlap same tuple in the initiating group skips replace close', async () => {
		const harness = observedScmHarness();
		const input = diffInput(URI.parse('git:/overlap/shared.ts?index#baseline'), URI.file('/overlap/shared.ts'), harness.editorService);
		const first = pendingScmOpen(harness, { groupId: 'g1' });
		await first.entered;
		const second = pendingScmOpen(harness, { groupId: 'g2', onEnter: () => {
			const group = harness.groups[0];
			harness.events.fire({ editor: input, groupId: group.id });
			group.editors = [harness.previous, input];
			group.activeEditor = input;
		} });
		await second.entered;
		await second.release();
		assert.strictEqual(await second.result, true);
		await first.release();
		assert.strictEqual(await first.result, true);
		assert.deepStrictEqual({ calls: [first.calls, second.calls], identity: sourcesDiffOpenIdentity(input) !== undefined, previousRetained: harness.groups[0].editors.includes(harness.previous), trace: harness.trace }, {
			calls: [1, 1], identity: false, previousRetained: true, trace: [],
		});
	});

	test('Sources overlap three delegates retains sticky ambiguity after the first leaves', async () => {
		const harness = observedScmHarness();
		const input = diffInput(URI.parse('git:/overlap/shared.ts?index#baseline'), URI.file('/overlap/shared.ts'), harness.editorService);
		const first = pendingScmOpen(harness, { groupId: 'g1' });
		await first.entered;
		const second = pendingScmOpen(harness, { groupId: 'g2' });
		await second.entered;
		await first.release();
		assert.strictEqual(await first.result, true);
		const third = pendingScmOpen(harness, { groupId: 'g3', onEnter: () => harness.place(input) });
		await third.entered;
		await second.release();
		assert.strictEqual(await second.result, true);
		await third.release();
		assert.strictEqual(await third.result, true);
		assert.deepStrictEqual({ calls: [first.calls, second.calls, third.calls], identity: sourcesDiffOpenIdentity(input) !== undefined, trace: harness.trace, listening: harness.events.hasListeners }, {
			calls: [1, 1, 1], identity: false, trace: [], listening: false,
		});
	});

	for (const otherKind of ['diff', 'custom'] as const) {
		for (const customFirst of [false, true]) {
			test(`Sources overlap custom wildcard with ${otherKind} customFirst=${customFirst} preserves only its pre-pin cost`, async () => {
				const harness = observedScmHarness();
				const firstInput = diffInput(URI.parse('git:/wildcard/a.ts?base'), URI.file('/wildcard/a.ts'), harness.editorService);
				const secondInput = diffInput(URI.parse('git:/wildcard/b.ts?base'), URI.file('/wildcard/b.ts'), harness.editorService);
				const custom = { kind: 'custom' as const, groupId: 'custom', modified: URI.file('/wildcard/a.ts'), original: URI.parse('git:/wildcard/a.ts?base'), slot: 'newTab' as const, onEnter: () => harness.place(firstInput) };
				const other = { kind: otherKind, groupId: 'other', modified: URI.file('/wildcard/b.ts'), original: URI.parse('git:/wildcard/b.ts?base'), onEnter: () => harness.place(secondInput, harness.groups[2]) };
				const first = pendingScmOpen(harness, customFirst ? custom : other);
				await first.entered;
				const second = pendingScmOpen(harness, customFirst ? other : custom);
				await second.entered;
				await first.release();
				assert.strictEqual(await first.result, true);
				await second.release();
				assert.strictEqual(await second.result, true);
				assert.deepStrictEqual({ calls: [first.calls, second.calls], identities: [sourcesDiffOpenIdentity(firstInput) !== undefined, sourcesDiffOpenIdentity(secondInput) !== undefined], trace: harness.trace, listening: harness.events.hasListeners }, {
					calls: [1, 1], identities: [false, false], trace: ['pin:previous'], listening: false,
				});
			});
		}
	}

	for (const distinction of ['ordered sides', 'query', 'fragment', 'file versus diff', 'service instance'] as const) {
		test(`Sources overlap independent ${distinction} retains each accurate identity`, async () => {
			const firstHarness = observedScmHarness();
			const secondHarness = distinction === 'service instance' ? observedScmHarness() : firstHarness;
			const modified = URI.file('/independent/shared.ts');
			const original = URI.parse('git:/independent/shared.ts?base#first');
			const secondOriginal = distinction === 'query' ? original.with({ query: 'other' }) : distinction === 'fragment' ? original.with({ fragment: 'second' }) : distinction === 'ordered sides' ? modified : original;
			const secondModified = distinction === 'ordered sides' ? original : modified;
			const firstInput = diffInput(original, modified, firstHarness.editorService);
			const secondInput = distinction === 'file versus diff' ? store.add(new TestEditorInput(modified, 'test.independent-file')) : diffInput(secondOriginal, secondModified, secondHarness.editorService);
			const first = pendingScmOpen(firstHarness, { groupId: 'first', modified, original, onEnter: () => firstHarness.place(firstInput) });
			await first.entered;
			const second = pendingScmOpen(secondHarness, { kind: distinction === 'file versus diff' ? 'file' : 'diff', groupId: 'second', modified: secondModified, original: secondOriginal, onEnter: () => secondHarness.place(secondInput, secondHarness.groups[2]) });
			await second.entered;
			await first.release();
			assert.strictEqual(await first.result, true);
			await second.release();
			assert.strictEqual(await second.result, true);
			assert.deepStrictEqual({ calls: [first.calls, second.calls], first: identitySnapshot(firstInput, first.scmResource), second: identitySnapshot(secondInput, second.scmResource), trace: firstHarness.trace, secondTrace: secondHarness.trace }, {
				calls: [1, 1], first: { groupId: 'first', sameResource: true }, second: { groupId: 'second', sameResource: true }, trace: [], secondTrace: [],
			});
		});
	}

	test('Sources overlap reject finally releases the registry and listener for the next sequential open', async () => {
		const harness = observedScmHarness();
		const boom = new Error('delegate failed');
		const first = pendingScmOpen(harness, { reject: boom });
		const rejection = assert.rejects(first.result, error => error === boom);
		await first.entered;
		const second = pendingScmOpen(harness, {});
		await second.entered;
		await first.release();
		await rejection;
		await second.release();
		assert.strictEqual(await second.result, true);
		assert.strictEqual(harness.events.hasListeners, false);
		const input = diffInput(URI.parse('git:/overlap/shared.ts?index#baseline'), URI.file('/overlap/shared.ts'), harness.editorService);
		const third = pendingScmOpen(harness, { groupId: 'recovered', onEnter: () => harness.place(input) });
		await third.entered;
		await third.release();
		assert.strictEqual(await third.result, true);
		assert.deepStrictEqual({ calls: [first.calls, second.calls, third.calls], identity: identitySnapshot(input, third.scmResource), trace: harness.trace, listening: harness.events.hasListeners }, {
			calls: [1, 1, 1], identity: { groupId: 'recovered', sameResource: true }, trace: [], listening: false,
		});
	});

	for (const result of ['unopened will', 'disposed member', 'removed group', 'same-id replacement', 'two observed hosts', 'two fallback tabs', 'one inactive fallback tab', 'canonical member'] as const) {
		test(`delegated host ${result} verifies actual group members before side effects`, async () => {
			const harness = observedScmHarness();
			const original = URI.parse('git:/overlap/shared.ts?index#baseline');
			const modified = URI.file('/overlap/shared.ts');
			const input = diffInput(original, modified, harness.editorService);
			const other = result === 'canonical member'
				? store.add(new DiffEditorInput(undefined, undefined, input.original, input.modified, undefined, harness.editorService))
				: diffInput(original, modified, harness.editorService);
			const oldResource = commandResource(modified, undefined, async () => { });
			rememberSourcesDiffOpenIdentity(input, { groupId: 'old', scmResource: oldResource });
			const operation = pendingScmOpen(harness, { groupId: 'new', onEnter: () => {
				if (result === 'two fallback tabs' || result === 'one inactive fallback tab') {
					harness.groups[1].editors = result === 'two fallback tabs' ? [input, other] : [input];
				} else if (result === 'unopened will') {
					harness.events.fire({ editor: input, groupId: harness.groups[1].id });
				} else {
					harness.place(input, harness.groups[1], result === 'canonical member' ? other : input);
					if (result === 'disposed member') {
						input.dispose();
					} else if (result === 'removed group') {
						harness.editorGroupsService.groups = [harness.groups[0], harness.groups[2]];
					} else if (result === 'same-id replacement') {
						const replacement = new TestEditorGroupView(harness.groups[1].id);
						replacement.editors = [input];
						harness.editorGroupsService.groups = [harness.groups[0], replacement, harness.groups[2]];
					} else if (result === 'two observed hosts') {
						harness.place(other, harness.groups[2]);
					}
				}
			} });
			await operation.entered;
			await operation.release();
			assert.strictEqual(await operation.result, true);
			const succeeds = result === 'one inactive fallback tab' || result === 'canonical member';
			assert.deepStrictEqual({ calls: operation.calls, input: identitySnapshot(input, succeeds ? operation.scmResource : oldResource), other: sourcesDiffOpenIdentity(other) !== undefined, trace: harness.trace, listening: harness.events.hasListeners }, {
				calls: 1, input: { groupId: succeeds ? 'new' : 'old', sameResource: true }, other: false, trace: [], listening: false,
			});
		});
	}


	test('delegated host custom observed comparison records and pins only the verified new member', async () => {
		const harness = observedScmHarness();
		const input = diffInput(URI.parse('git:/overlap/shared.ts?index#baseline'), URI.file('/overlap/shared.ts'), harness.editorService);
		const operation = pendingScmOpen(harness, { kind: 'custom', slot: 'newTab', onEnter: () => harness.place(input) });
		await operation.entered;
		await operation.release();
		assert.strictEqual(await operation.result, true);
		assert.deepStrictEqual({ calls: operation.calls, identity: identitySnapshot(input, operation.scmResource), trace: harness.trace, listening: harness.events.hasListeners }, {
			calls: 1, identity: { groupId: 'index', sameResource: true }, trace: ['pin:previous', 'pin:new'], listening: false,
		});
	});

	test('delegated host cannot invent a group from a bare active editor', async () => {
		const harness = observedScmHarness();
		const resource = URI.file('/bare/shared.ts');
		const input = store.add(new TestEditorInput(resource, 'test.bare'));
		harness.editorService.activeEditor = input;
		const scmResource = commandResource(resource, { id: API_OPEN_EDITOR_COMMAND_ID, title: '', arguments: [resource, [0], undefined] }, async () => assert.fail('API must not call custom.open'));
		assert.strictEqual(await openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({ editorService: harness.editorService }), { slot: 'replace' }), true);
		assert.deepStrictEqual({ identity: sourcesDiffOpenIdentity(input) !== undefined, listening: harness.events.hasListeners }, { identity: false, listening: false });
	});

	test('delegated host uses one captured DTO for dispatch, key and matching while resource.command changes', async () => {
		const harness = observedScmHarness();
		const original = URI.parse('git:/capture/shared.ts?index');
		const modified = URI.file('/capture/shared.ts');
		const input = diffInput(original, modified, harness.editorService);
		const entered = new DeferredPromise<void>();
		const released = new DeferredPromise<void>();
		const args = [original, modified, undefined, [0, { pinned: false }]];
		let currentCommand: ISCMResource['command'] = { id: API_OPEN_DIFF_EDITOR_COMMAND_ID, title: '', arguments: args };
		let reads = 0;
		const scmResource = commandResource(modified, undefined, async () => assert.fail('captured API must not call custom.open'));
		Object.defineProperty(scmResource, 'command', { get: () => { reads++; return currentCommand; } });
		const commands: { id: string; original: string | undefined; modified: string | undefined }[] = [];
		const result = openSourcesChangeEntry({ ...createEntry(modified, scmResource), groupId: 'captured' }, createDeps({
			editorService: harness.editorService, editorGroupsService: harness.editorGroupsService,
			commandService: { ...NullCommandService, executeCommand: async (id, ...commandArgs) => {
				commands.push({ id, original: URI.isUri(commandArgs[0]) ? commandArgs[0].toString() : undefined, modified: URI.isUri(commandArgs[1]) ? commandArgs[1].toString() : undefined });
				await entered.complete();
				await released.p;
				harness.place(input);
				return undefined;
			} },
		}), { slot: 'replace' });
		await entered.p;
		args[0] = URI.parse('git:/capture/changed.ts?HEAD');
		currentCommand = { id: API_OPEN_EDITOR_COMMAND_ID, title: '', arguments: [URI.file('/capture/changed.ts')] };
		await released.complete();
		assert.strictEqual(await result, true);
		assert.deepStrictEqual({ reads, commands, identity: identitySnapshot(input, scmResource), trace: harness.trace }, {
			reads: 1, commands: [{ id: API_OPEN_DIFF_EDITOR_COMMAND_ID, original: original.toString(), modified: modified.toString() }], identity: { groupId: 'captured', sameResource: true }, trace: [],
		});
	});

	test('API file void does not claim a diff that merely contains the same modified URI', async () => {
		const resource = URI.file('/alpha/shared.ts');
		const editorService = store.add(new TestEditorService());
		const previous = diffInput(URI.parse('git:/alpha/shared.ts?HEAD'), resource, editorService);
		const group = new TestEditorGroupView(52);
		group.activeEditor = previous;
		group.editors = [previous];
		group.pinEditor = () => assert.fail('API no-op must not pin a diff');
		group.closeEditor = async () => assert.fail('API file must not replace an unrelated comparison');
		editorService.activeEditorPane = visiblePane(previous, group);
		const oldResource = commandResource(resource, undefined, async () => { });
		const oldIdentity = { groupId: 'workingTree', scmResource: oldResource };
		rememberSourcesDiffOpenIdentity(previous, oldIdentity);
		const scmResource = commandResource(resource, { id: API_OPEN_EDITOR_COMMAND_ID, title: '', arguments: [resource.toString(), [0], undefined] }, async () => assert.fail('API DTO must use commandService'));
		await openSourcesChangeEntry({ ...createEntry(resource, scmResource), groupId: 'index' }, createDeps({ editorService, editorGroupsService: new TestEditorGroupsService([group]) }), { slot: 'replace' });
		assert.deepStrictEqual(sourcesDiffOpenIdentity(previous), oldIdentity);
	});

	for (const slot of [undefined, 'newTab', 'replace'] as const) {
		for (const result of ['no-op', 'reject', 'unknown background input'] as const) {
			test(`custom SCM ${slot ?? 'no slot'} ${result} keeps only its documented preview-pin cost`, async () => {
				const resource = URI.file('/alpha/custom.ts');
				const oldOriginal = URI.parse('git:/alpha/custom.ts?HEAD');
				const newOriginal = URI.parse('git:/alpha/custom.ts?index');
				const editorService = store.add(new TestEditorService());
				const previous = diffInput(oldOriginal, resource, editorService);
				const backgroundInput = store.add(new TestEditorInput(resource, 'test.custom-background'));
				const group = new TestEditorGroupView(53);
				group.activeEditor = previous;
				group.editors = [previous];
				const background = new TestEditorGroupView(54);
				background.activeEditor = backgroundInput;
				background.editors = [backgroundInput];
				const trace: string[] = [];
				group.pinEditor = input => { assert.strictEqual(input, previous); trace.push('pin:previous'); };
				group.closeEditor = async () => { trace.push('close:previous'); return true; };
				background.pinEditor = () => { trace.push('pin:background'); };
				editorService.activeEditor = previous;
				editorService.activeEditorPane = visiblePane(previous, group);
				const oldIdentity = { groupId: 'workingTree', scmResource: commandResource(resource, undefined, async () => { }) };
				rememberSourcesDiffOpenIdentity(previous, oldIdentity);
				const boom = new Error('custom rejected');
				const scmResource = commandResource(resource, { id: 'provider.custom', title: '' }, async preserveFocus => {
					assert.strictEqual(preserveFocus, true);
					trace.push('resource.open');
					if (result === 'reject') {
						throw boom;
					}
					if (result === 'unknown background input') {
						editorService.visibleEditorPanes = [visiblePane(previous, group), visiblePane(backgroundInput, background)];
					}
				}, result === 'unknown background input' ? undefined : [newOriginal, resource]);
				const open = () => openSourcesChangeEntry({ ...createEntry(resource, scmResource), groupId: 'index' }, createDeps({
					editorService, editorGroupsService: new TestEditorGroupsService([group, background]),
					commandService: { ...NullCommandService, executeCommand: async () => { trace.push('command'); return undefined; } },
				}), { slot, preserveFocus: true });
				if (result === 'reject') {
					await assert.rejects(open, error => error === boom);
				} else {
					assert.strictEqual(await open(), true);
				}
				assert.deepStrictEqual({ trace, previousIdentity: sourcesDiffOpenIdentity(previous), backgroundIdentity: sourcesDiffOpenIdentity(backgroundInput) }, {
					trace: slot === 'newTab' ? ['pin:previous', 'resource.open'] : ['resource.open'],
					previousIdentity: oldIdentity, backgroundIdentity: undefined,
				});
			});
		}
	}

	test('custom newTab pre-pin retains the old preview when the provider really opens an unpinned comparison', async () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const model = store.add(instantiationService.createInstance(EditorGroupModel, undefined));
		const editorService = store.add(new TestEditorService());
		const previous = store.add(new TestEditorInput(URI.file('/beta/previous.ts'), 'test.custom-previous'));
		const resource = URI.file('/alpha/custom-new.ts');
		const original = URI.parse('git:/alpha/custom-new.ts?HEAD');
		const opened = diffInput(original, resource, editorService);
		model.openEditor(previous, { pinned: false, active: true });
		const group = new TestEditorGroupView(55);
		group.activeEditor = previous;
		group.editors = [previous];
		const trace: string[] = [];
		group.isPinned = input => model.isPinned(input);
		group.pinEditor = input => {
			assert.ok(input);
			trace.push(input === previous ? 'pin:previous' : 'pin:opened');
			model.pin(input);
		};
		group.closeEditor = async () => assert.fail('custom newTab must retain the previous input');
		const scmResource = commandResource(resource, undefined, async () => {
			trace.push('resource.open');
			model.openEditor(opened, { pinned: false, active: true });
			group.activeEditor = opened;
			group.editors = model.getEditors(EditorsOrder.SEQUENTIAL);
			editorService.activeEditor = opened;
		}, [original, resource]);
		await openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({ editorService, editorGroupsService: new TestEditorGroupsService([group]) }), { slot: 'newTab' });
		assert.deepStrictEqual({
			trace, editors: model.getEditors(EditorsOrder.SEQUENTIAL), previousPinned: model.isPinned(previous), openedPinned: model.isPinned(opened),
			identity: sourcesDiffOpenIdentity(opened),
		}, {
			trace: ['pin:previous', 'resource.open', 'pin:opened'], editors: [previous, opened], previousPinned: true, openedPinned: true,
			identity: { groupId: 'workingTree', scmResource },
		});
	});

	test('custom reveal can reuse an already recorded resource and group identity without guessing a URI', async () => {
		const resource = URI.file('/alpha/trusted-custom.ts');
		const input = store.add(new TestEditorInput(resource, 'test.custom-trusted'));
		const group = new TestEditorGroupView(56);
		group.activeEditor = input;
		group.editors = [input];
		group.closeEditor = async () => assert.fail('revealing the trusted input must not close it');
		const trace: boolean[] = [];
		const scmResource = commandResource(resource, undefined, async preserveFocus => { trace.push(preserveFocus); });
		const identity = { groupId: 'workingTree', scmResource };
		rememberSourcesDiffOpenIdentity(input, identity);
		await openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({
			editorService: store.add(new TestEditorService()), editorGroupsService: new TestEditorGroupsService([group]),
		}), { slot: 'replace', preserveFocus: true });
		assert.deepStrictEqual({ trace, identity: sourcesDiffOpenIdentity(input) }, { trace: [true], identity });
	});

	test('API SCM rejection propagates without a resource.open fallback or unrelated identity', async () => {
		const resource = URI.file('/alpha/shared.ts');
		const previous = store.add(new TestEditorInput(URI.file('/beta/shared.ts'), 'test.beta'));
		const group = new TestEditorGroupView(41);
		group.activeEditor = previous;
		group.editors = [previous];
		group.pinEditor = () => assert.fail('provider options must not be overwritten after a rejection');
		group.closeEditor = async () => assert.fail('a rejection must not close the previous input');
		const editorService = store.add(new TestEditorService());
		editorService.activeEditor = previous;
		let resourceOpens = 0;
		let commands = 0;
		const boom = new Error('command rejected');
		const scmResource = commandResource(resource, { id: API_OPEN_DIFF_EDITOR_COMMAND_ID, title: '', arguments: [undefined, resource, undefined, undefined] }, async () => { resourceOpens++; });
		await assert.rejects(() => openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({
			editorService,
			editorGroupsService: new TestEditorGroupsService([group]),
			commandService: { ...NullCommandService, executeCommand: async () => { commands++; throw boom; } },
		}), { slot: 'replace' }), error => error === boom);
		assert.strictEqual(commands, 1);
		assert.strictEqual(resourceOpens, 0);
		assert.strictEqual(sourcesDiffOpenIdentity(previous), undefined);
	});

	test('fulfilled API void does not relabel or close a different resource left visible', async () => {
		const resource = URI.file('/alpha/shared.ts');
		const previous = store.add(new TestEditorInput(URI.file('/beta/shared.ts'), 'test.beta'));
		const group = new TestEditorGroupView(42);
		group.activeEditor = previous;
		group.editors = [previous];
		group.pinEditor = () => assert.fail('API provider pinned:false must keep priority');
		group.closeEditor = async () => assert.fail('unmatched input must stay open');
		const editorService = store.add(new TestEditorService());
		editorService.activeEditor = previous;
		const scmResource = commandResource(resource, { id: API_OPEN_EDITOR_COMMAND_ID, title: '', arguments: [resource, [undefined, { pinned: false }], undefined] }, async () => assert.fail('API DTO must use commandService'));
		const opened = await openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({
			editorService,
			editorGroupsService: new TestEditorGroupsService([group]),
		}), { slot: 'replace', preserveFocus: true, pinned: true });
		assert.strictEqual(opened, true);
		assert.strictEqual(group.activeEditor, previous);
		assert.strictEqual(sourcesDiffOpenIdentity(previous), undefined);
	});

	test('custom SCM reveal of the same input retains delegated void and the correct identity', async () => {
		const resource = URI.file('/alpha/shared.ts');
		const original = URI.parse('git:/alpha/shared.ts?HEAD');
		const editorService = store.add(new TestEditorService());
		const input = diffInput(original, resource, editorService);
		const group = new TestEditorGroupView(43);
		group.activeEditor = input;
		group.editors = [input];
		group.closeEditor = async () => assert.fail('same input reveal must not close itself');
		let opens = 0;
		const scmResource = commandResource(resource, { id: 'provider.customOpen', title: '' }, async preserveFocus => { opens++; assert.strictEqual(preserveFocus, true); }, [original, resource]);
		const opened = await openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({
			editorService,
			editorGroupsService: new TestEditorGroupsService([group]),
			commandService: { ...NullCommandService, executeCommand: async () => assert.fail('custom resource must own its dispatch') },
		}), { slot: 'replace', preserveFocus: true });
		assert.strictEqual(opened, true);
		assert.strictEqual(opens, 1);
		assert.deepStrictEqual(sourcesDiffOpenIdentity(input), { groupId: 'workingTree', scmResource });
	});

	test('custom SCM rejection is dispatched once without executing its command DTO', async () => {
		const resource = URI.file('/alpha/custom.ts');
		let opens = 0;
		const boom = new Error('custom rejected');
		const scmResource = commandResource(resource, { id: 'provider.customOpen', title: '' }, async () => { opens++; throw boom; });
		await assert.rejects(() => openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({
			editorService: store.add(new TestEditorService()),
			commandService: { ...NullCommandService, executeCommand: async () => assert.fail('custom dispatch belongs to resource.open') },
		}), { preserveFocus: true }), error => error === boom);
		assert.strictEqual(opens, 1);
	});

	test('a provider-selected background input gets its identity without pinning or closing the focused group', async () => {
		const resource = URI.file('/alpha/background.ts');
		const previous = store.add(new TestEditorInput(URI.file('/beta/focused.ts'), 'test.focused'));
		const opened = store.add(new TestEditorInput(resource, 'test.background'));
		const group = new TestEditorGroupView(44);
		group.activeEditor = previous;
		group.editors = [previous];
		group.pinEditor = () => assert.fail('provider pinned:false must retain priority');
		group.closeEditor = async () => assert.fail('provider-selected background target must not close the focused editor');
		const editorService = store.add(new TestEditorService());
		const background = new TestEditorGroupView(57);
		background.activeEditor = opened;
		background.editors = [opened];
		editorService.activeEditor = previous;
		editorService.activeEditorPane = visiblePane(previous, group);
		const scmResource = commandResource(resource, { id: API_OPEN_EDITOR_COMMAND_ID, title: '', arguments: [resource, [2, { pinned: false, preserveFocus: true }], undefined] }, async () => assert.fail('API DTO must use commandService'));
		assert.strictEqual(await openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({
			editorService,
			editorGroupsService: new TestEditorGroupsService([group, background]),
		}), { slot: 'replace', pinned: true, preserveFocus: true }), true);
		assert.strictEqual(sourcesDiffOpenIdentity(previous), undefined);
		assert.deepStrictEqual(sourcesDiffOpenIdentity(opened), { groupId: 'workingTree', scmResource });
	});

	test('openSourcesChangeEntry uses scmResource.open for working-tree diff', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		let openedPreserveFocus: boolean | undefined;
		const scmResource = {
			open: async (preserveFocus: boolean) => {
				openedPreserveFocus = preserveFocus;
			},
		} as unknown as ISCMResource;

		await openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({
			editorService: {
				openEditor: async () => {
					assert.fail('must not open file preview when scmResource is present');
				},
			} as unknown as IEditorService,
		}), { preserveFocus: true });

		assert.strictEqual(openedPreserveFocus, true);
	});

	for (const slot of ['newTab', 'replace'] as const) {
		test(`SCM ${slot} accepts a group with no active editor`, async function () {
			const resource = toResource.call(this, '/project/src/a.ts');
			const calls: boolean[] = [];
			const scmResource = { open: async (preserveFocus: boolean) => { calls.push(preserveFocus); } } as ISCMResource;
			const editorGroupsService = {
				activeGroup: {
					activeEditor: null,
					editors: [],
					isPinned: () => assert.fail('empty group has no pinned editor'),
					pinEditor: () => assert.fail('must not pin an empty editor'),
					closeEditor: () => assert.fail('must not close an empty editor'),
				},
			} as unknown as IEditorGroupsService;
			await openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({
				editorService: { openEditor: async () => assert.fail('SCM opens its own editor') } as unknown as IEditorService,
				editorGroupsService,
			}), { slot, preserveFocus: true });

			assert.deepStrictEqual(calls, [true]);
		});

		test(`SCM ${slot} preserves editor order and records the opened identity`, async function () {
			const resource = toResource.call(this, '/project/src/a.ts');
			const original = URI.parse('git:/project/src/a.ts?HEAD');
			const editorService = store.add(new TestEditorService());
			const previous = store.add(new TestEditorInput(URI.file('/project/previous.ts'), 'test.previous'));
			const opened = diffInput(original, resource, editorService);
			const group = new TestEditorGroupView(58);
			group.activeEditor = previous;
			group.editors = [previous, opened];
			const trace: string[] = [];
			const scmResource = commandResource(resource, undefined,
				async preserveFocus => {
					trace.push(`open:${preserveFocus}`);
					group.activeEditor = opened;
				},
				[original, resource]);
			group.isPinned = () => false;
			group.pinEditor = input => trace.push(input === previous ? 'pin:previous' : 'pin:opened');
			group.closeEditor = async input => {
				assert.ok(input === previous);
				trace.push('close:previous');
				return true;
			};
			const editorGroupsService = new TestEditorGroupsService([group]);
			await openSourcesChangeEntry(createEntry(resource, scmResource), createDeps({
				editorService: { openEditor: async () => assert.fail('SCM opens its own editor') } as unknown as IEditorService,
				editorGroupsService,
			}), { slot, preserveFocus: true });

			assert.deepStrictEqual({ trace, identity: sourcesDiffOpenIdentity(opened) }, {
				trace: slot === 'newTab' ? ['pin:previous', 'open:true', 'pin:opened'] : ['open:true', 'close:previous'],
				identity: { groupId: 'workingTree', scmResource },
			});
		});
	}

	test('openSourcesChangeEntry falls back to file preview without scmResource', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		let openedResource: URI | undefined;
		let openedGroup: unknown;

		await openSourcesChangeEntry(createEntry(resource), createDeps({
			editorService: {
				openEditor: async (input: IResourceEditorInput, group?: unknown) => {
					openedResource = input.resource;
					openedGroup = group;
					return undefined;
				},
			} as unknown as IEditorService,
		}), { preserveFocus: false, pinned: true });

		assert.strictEqual(openedResource?.toString(), resource.toString());
		assert.strictEqual(openedGroup, ACTIVE_GROUP);
	});

	test('openSourcesChangeEntry passes editor options on preview fallback', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		let capturedOptions: { preserveFocus?: boolean; pinned?: boolean; source?: EditorOpenSource } | undefined;

		await openSourcesChangeEntry(createEntry(resource), createDeps({
			editorService: {
				openEditor: async (input: IResourceEditorInput) => {
					capturedOptions = input.options;
					return undefined;
				},
			} as unknown as IEditorService,
		}), { preserveFocus: true, pinned: true });

		assert.strictEqual(capturedOptions?.preserveFocus, true);
		assert.strictEqual(capturedOptions?.pinned, true);
		assert.strictEqual(capturedOptions?.source, EditorOpenSource.USER);
	});

	test('openSourcesChangeEntry opens conversation diff review input when default owner is conversation', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const original = toResource.call(this, '/project/src/a.ts.git');
		let editorOpens = 0;
		const harness = createSourcesConversationOpenHarness(store, {
			openEditor: async input => {
				store.add(input);
				return undefined;
			},
		});

		const configurationService = new TestConfigurationService({ 'sources.diff.defaultOwner': 'conversation' });

		const opened = await openSourcesChangeEntry(createEntry(resource), createDeps({
			editorService: {
				openEditor: async () => {
					editorOpens++;
					return undefined;
				},
			} as unknown as IEditorService,
			quickDiffService: {
				getQuickDiffs: async () => [{ originalResource: original, id: 'git', label: 'Git', kind: 'primary' }],
			} as unknown as IQuickDiffService,
			configurationService,
			instantiationService: {
				createInstance: (ctor: typeof ConversationDiffReviewInput, modified: URI, originalUri?: URI, groupId?: string) => store.add(new ctor(modified, originalUri, groupId)),
			} as unknown as ISourcesChangeEntryOpenDeps['instantiationService'],
			editorGroupsService: harness.editorGroupsService,
			session: harness.session,
		}), { preserveFocus: false });

		assert.strictEqual(opened, false);
		assert.strictEqual(editorOpens, 0);
		const openedInput = harness.opened[0];
		assert.ok(openedInput instanceof ConversationDiffReviewInput);
		assert.strictEqual(openedInput.modified.toString(), resource.toString());
		assert.strictEqual(openedInput.original?.toString(), original.toString());
		assert.strictEqual(openedInput.groupId, 'workingTree');
	});

	function conversationInstantiation(): ISourcesChangeEntryOpenDeps['instantiationService'] {
		return {
			createInstance: (_ctor: unknown, ...args: unknown[]) => {
				const [modified, originalUri, groupId, identity] = args as ConstructorParameters<typeof ConversationDiffReviewInput>;
				return store.add(new ConversationDiffReviewInput(modified, originalUri, groupId ?? '', identity));
			},
		} as unknown as ISourcesChangeEntryOpenDeps['instantiationService'];
	}

	test('conversation open fails when the roster session has no leaf and does not open Preview', async function () {
		const resource = toResource.call(this, '/project/src/missing-leaf.ts');
		let editorOpens = 0;
		const openedOn: string[] = [];
		const otherChat = store.add(new ConversationChatInput(getDefaultConversationChatResource('session-other')));
		const otherGroup = {
			id: 1,
			editors: [otherChat],
			openEditor: async () => {
				openedOn.push('other');
				return undefined;
			},
		};
		await assert.rejects(() => openSourcesChangeEntry(createEntry(resource), createDeps({
			editorService: {
				openEditor: async () => {
					editorOpens++;
					return undefined;
				},
			} as unknown as IEditorService,
			configurationService: new TestConfigurationService({ 'sources.diff.defaultOwner': 'conversation' }),
			editorGroupsService: {
				conversationParts: [{
					sessionKey: 'session-other',
					groups: [otherGroup],
					activeGroup: otherGroup,
					findGroup: () => otherGroup,
					isGroupHidden: () => false,
					setGroupHidden: () => { },
					addGroup: () => otherGroup,
				}],
			} as unknown as IEditorGroupsService,
			session: { getActiveSessionId: () => 'session-active' } as IAgentSessionContext,
		}), {}), (error: unknown) => {
			assert.ok(error instanceof Error);
			assert.strictEqual(error.message, sourcesConversationLeafMissingMessage());
			assert.notStrictEqual(sourcesConversationLeafMissingMessage(), conversationDiffComparisonLoadFailedMessage());
			const shown = sourcesGitDiffOpenFailureMessage(error);
			assert.ok(shown.includes(sourcesConversationLeafMissingMessage()));
			assert.ok(!shown.includes(conversationDiffComparisonLoadFailedMessage()));
			return true;
		});
		assert.strictEqual(editorOpens, 0);
		assert.deepStrictEqual(openedOn, []);
	});

	test('conversation open fails when the leaf has no default chat root', async function () {
		const resource = toResource.call(this, '/project/src/no-root.ts');
		const original = toResource.call(this, '/project/src/no-root.ts.git');
		let editorOpens = 0;
		const openedOn: string[] = [];
		const child = store.add(new ConversationChatInput(getConversationChatResource('session-active', 'child'), { isDefaultRoot: false }));
		const onlyGroup = {
			id: 1,
			editors: [child],
			openEditor: async () => {
				openedOn.push('at0');
				return undefined;
			},
		};
		const opened = await openSourcesChangeInConversation({
			modified: resource,
			original,
			groupId: 'workingTree',
		}, createDeps({
			editorService: {
				openEditor: async () => {
					editorOpens++;
					return undefined;
				},
			} as unknown as IEditorService,
			instantiationService: conversationInstantiation(),
			editorGroupsService: {
				conversationParts: [{
					sessionKey: 'session-active',
					groups: [onlyGroup],
					activeGroup: onlyGroup,
					findGroup: () => { throw new Error('no chat root must not findGroup'); },
					isGroupHidden: () => false,
					setGroupHidden: () => { },
					addGroup: () => { throw new Error('no chat root must not addGroup'); },
				}],
			} as unknown as IEditorGroupsService,
			session: { getActiveSessionId: () => 'session-active' } as IAgentSessionContext,
		}), {});

		assert.strictEqual(opened, false);
		assert.strictEqual(editorOpens, 0);
		assert.deepStrictEqual(openedOn, []);
	});

	test('conversation open lands on the roster leaf beside the default chat root', async function () {
		const resource = toResource.call(this, '/project/src/roster-leaf.ts');
		const original = toResource.call(this, '/project/src/roster-leaf.ts.git');
		const activeSession = 'session-active';
		let editorOpens = 0;
		const openedOn: string[] = [];
		let findSourceId: number | undefined;
		let findWrap: boolean | undefined;
		let capturedOptions: { preserveFocus?: boolean; pinned?: boolean } | undefined;
		const otherChat = store.add(new ConversationChatInput(getDefaultConversationChatResource('session-other')));
		const chat = store.add(new ConversationChatInput(getDefaultConversationChatResource(activeSession)));
		const otherSide = {
			id: 11,
			editors: [] as EditorInput[],
			openEditor: async (input: EditorInput) => {
				store.add(input);
				openedOn.push('other');
				return undefined;
			},
		};
		const otherPart = {
			sessionKey: 'session-other',
			groups: [{
				id: 10,
				editors: [otherChat],
				openEditor: async () => {
					openedOn.push('other-chat');
					return undefined;
				},
			}, otherSide],
			activeGroup: otherSide,
			findGroup: () => otherSide,
			isGroupHidden: () => false,
			setGroupHidden: () => { },
			addGroup: () => otherSide,
		};
		const sideDecoy = {
			id: 21,
			editors: [] as EditorInput[],
			openEditor: async (input: EditorInput) => {
				store.add(input);
				openedOn.push('at0');
				return undefined;
			},
		};
		const chatGroup = {
			id: 22,
			editors: [chat],
			openEditor: async () => {
				openedOn.push('chat-root');
				return undefined;
			},
		};
		const neighbor = {
			id: 23,
			editors: [] as EditorInput[],
			openEditor: async (input: EditorInput, options?: { preserveFocus?: boolean; pinned?: boolean }) => {
				store.add(input);
				capturedOptions = options;
				openedOn.push('neighbor');
				return undefined;
			},
		};
		const configurationService = new TestConfigurationService();
		const rightPart = {
			sessionKey: activeSession,
			groups: [sideDecoy, chatGroup],
			activeGroup: sideDecoy,
			findGroup: (scope: { direction: number }, source: { id: number }, wrap?: boolean) => {
				findSourceId = source.id;
				findWrap = wrap;
				assert.strictEqual(scope.direction, preferredSideBySideGroupDirection(configurationService));
				return source.id === chatGroup.id ? neighbor : sideDecoy;
			},
			isGroupHidden: () => false,
			setGroupHidden: () => { throw new Error('visible neighbor must stay visible'); },
			addGroup: () => { throw new Error('neighbor must be reused'); },
		};

		const opened = await openSourcesChangeInConversation({
			modified: resource,
			original,
			groupId: 'workingTree',
		}, createDeps({
			editorService: {
				openEditor: async () => {
					editorOpens++;
					return undefined;
				},
			} as unknown as IEditorService,
			configurationService,
			instantiationService: conversationInstantiation(),
			editorGroupsService: {
				conversationParts: [otherPart, rightPart],
			} as unknown as IEditorGroupsService,
			session: { getActiveSessionId: () => activeSession } as IAgentSessionContext,
		}), { preserveFocus: true, pinned: true });

		assert.strictEqual(opened, false);
		assert.strictEqual(editorOpens, 0);
		assert.deepStrictEqual(openedOn, ['neighbor']);
		assert.strictEqual(findSourceId, chatGroup.id);
		assert.strictEqual(findWrap, false);
		assert.strictEqual(capturedOptions?.preserveFocus, true);
		assert.strictEqual(capturedOptions?.pinned, true);
	});

	test('conversation open reveals the group that already has the same diff', async function () {
		const resource = toResource.call(this, '/project/src/reveal.ts');
		const original = toResource.call(this, '/project/src/reveal.ts.git');
		const openedOn: string[] = [];
		const existing = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree', { gitPath: 'src/reveal.ts' }));
		const chat = store.add(new ConversationChatInput(getDefaultConversationChatResource('session-active')));
		const sideDecoy = {
			id: 1,
			editors: [] as EditorInput[],
			openEditor: async () => {
				openedOn.push('at0');
				return undefined;
			},
		};
		const diffGroup = {
			id: 2,
			editors: [existing],
			openEditor: async (input: EditorInput) => {
				store.add(input);
				openedOn.push('reveal');
				return undefined;
			},
		};
		const chatGroup = {
			id: 3,
			editors: [chat],
			openEditor: async () => {
				openedOn.push('chat-root');
				return undefined;
			},
		};

		await openSourcesChangeInConversation({
			modified: resource,
			original,
			groupId: 'workingTree',
			gitPath: 'src/reveal.ts',
		}, createDeps({
			editorService: {
				openEditor: async () => {
					throw new Error('conversation open must not use editorService.openEditor');
				},
			} as unknown as IEditorService,
			instantiationService: conversationInstantiation(),
			editorGroupsService: {
				conversationParts: [{
					sessionKey: 'session-active',
					groups: [sideDecoy, diffGroup, chatGroup],
					activeGroup: sideDecoy,
					findGroup: () => { throw new Error('same identity must reveal before findGroup'); },
					isGroupHidden: () => false,
					setGroupHidden: () => { },
					addGroup: () => { throw new Error('same identity must reveal before addGroup'); },
				}],
			} as unknown as IEditorGroupsService,
			session: { getActiveSessionId: () => 'session-active' } as IAgentSessionContext,
		}), {});

		assert.deepStrictEqual(openedOn, ['reveal']);
	});

	test('conversation open unhides the neighbor of the chat root and does not add a group', async function () {
		const resource = toResource.call(this, '/project/src/hidden.ts');
		const original = toResource.call(this, '/project/src/hidden.ts.git');
		const openedOn: string[] = [];
		let unhidden = false;
		const chat = store.add(new ConversationChatInput(getDefaultConversationChatResource('session-active')));
		const chatGroup = {
			id: 1,
			editors: [chat],
			openEditor: async () => {
				openedOn.push('chat-root');
				return undefined;
			},
		};
		const hiddenNeighbor = {
			id: 2,
			editors: [] as EditorInput[],
			openEditor: async (input: EditorInput) => {
				assert.strictEqual(unhidden, true);
				store.add(input);
				openedOn.push('neighbor');
				return undefined;
			},
		};

		await openSourcesChangeInConversation({
			modified: resource,
			original,
			groupId: 'workingTree',
		}, createDeps({
			editorService: {
				openEditor: async () => {
					throw new Error('conversation open must not use editorService.openEditor');
				},
			} as unknown as IEditorService,
			instantiationService: conversationInstantiation(),
			editorGroupsService: {
				conversationParts: [{
					sessionKey: 'session-active',
					groups: [chatGroup],
					activeGroup: chatGroup,
					findGroup: (_scope: unknown, source: { id: number }) => source.id === chatGroup.id ? hiddenNeighbor : undefined,
					isGroupHidden: (group: { id: number }) => group.id === hiddenNeighbor.id,
					setGroupHidden: (group: { id: number }, hidden: boolean) => {
						assert.strictEqual(group.id, hiddenNeighbor.id);
						assert.strictEqual(hidden, false);
						unhidden = true;
					},
					addGroup: () => { throw new Error('hidden neighbor must be reused'); },
				}],
			} as unknown as IEditorGroupsService,
			session: { getActiveSessionId: () => 'session-active' } as IAgentSessionContext,
		}), {});

		assert.strictEqual(unhidden, true);
		assert.deepStrictEqual(openedOn, ['neighbor']);
	});

	test('conversation open adds a group beside the chat root when findGroup has no neighbor', async function () {
		const resource = toResource.call(this, '/project/src/split.ts');
		const original = toResource.call(this, '/project/src/split.ts.git');
		const openedOn: string[] = [];
		let addSourceId: number | undefined;
		let addDirection: number | undefined;
		const chat = store.add(new ConversationChatInput(getDefaultConversationChatResource('session-active')));
		const sideDecoy = {
			id: 1,
			editors: [] as EditorInput[],
			openEditor: async () => {
				openedOn.push('at0');
				return undefined;
			},
		};
		const chatGroup = {
			id: 2,
			editors: [chat],
			openEditor: async () => {
				openedOn.push('chat-root');
				return undefined;
			},
		};
		const created = {
			id: 3,
			editors: [] as EditorInput[],
			openEditor: async (input: EditorInput) => {
				store.add(input);
				openedOn.push('added');
				return undefined;
			},
		};
		const configurationService = new TestConfigurationService({ 'workbench.editor.openSideBySideDirection': 'down' });

		await openSourcesChangeInConversation({
			modified: resource,
			original,
			groupId: 'workingTree',
		}, createDeps({
			editorService: {
				openEditor: async () => {
					throw new Error('conversation open must not use editorService.openEditor');
				},
			} as unknown as IEditorService,
			configurationService,
			instantiationService: conversationInstantiation(),
			editorGroupsService: {
				conversationParts: [{
					sessionKey: 'session-active',
					groups: [sideDecoy, chatGroup],
					activeGroup: sideDecoy,
					findGroup: (_scope: { direction: number }, source: { id: number }, wrap?: boolean) => {
						assert.strictEqual(wrap, false);
						assert.strictEqual(source.id, chatGroup.id);
						assert.strictEqual(_scope.direction, preferredSideBySideGroupDirection(configurationService));
						return undefined;
					},
					isGroupHidden: () => false,
					setGroupHidden: () => { throw new Error('missing neighbor must not unhide'); },
					addGroup: (source: { id: number }, direction: number) => {
						addSourceId = source.id;
						addDirection = direction;
						return created;
					},
				}],
			} as unknown as IEditorGroupsService,
			session: { getActiveSessionId: () => 'session-active' } as IAgentSessionContext,
		}), {});

		assert.strictEqual(addSourceId, chatGroup.id);
		assert.strictEqual(addDirection, preferredSideBySideGroupDirection(configurationService));
		assert.deepStrictEqual(openedOn, ['added']);
	});

	test('ConversationDiffReviewInput matches original and groupId', function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const original = toResource.call(this, '/project/src/a.ts.git');
		const otherOriginal = toResource.call(this, '/project/src/a.ts.other');
		const working = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree'));
		const index = store.add(new ConversationDiffReviewInput(resource, original, 'index'));
		const sameWorking = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree'));
		const otherOrig = store.add(new ConversationDiffReviewInput(resource, otherOriginal, 'workingTree'));
		assert.strictEqual(working.matches(sameWorking), true);
		assert.strictEqual(working.matches(index), false);
		assert.strictEqual(working.matches(otherOrig), false);
		const pinned = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree', { origin: 'engine', sessionId: 'session-a', gitPath: 'src/a.ts' }));
		const otherSession = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree', { origin: 'engine', sessionId: 'session-b', gitPath: 'src/a.ts' }));
		const otherPath = store.add(new ConversationDiffReviewInput(resource, original, 'workingTree', { origin: 'engine', sessionId: 'session-a', gitPath: 'src/b.ts' }));
		assert.strictEqual(pinned.matches(otherSession), true);
		assert.strictEqual(pinned.matches(otherPath), false);
	});

	test('openSourcesChangeEntry reads Git file diff for git-sourced rows without local original', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const entry: ISourcesChangeEntry = {
			resource,
			name: 'a.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/a.ts',
			indexState: 'WORKTREE',
		};
		const diffCalls: { path: string; indexState: string }[] = [];
		const models = new Map<string, string>();
		let openedOriginal: string | undefined;
		let openedModified: string | undefined;

		await openSourcesChangeEntry(entry, createDeps({
			editorService: {
				openEditor: async (input: { original?: { resource?: URI }; modified?: { resource?: URI }; resource?: URI }) => {
					openedOriginal = input.original?.resource?.toString();
					openedModified = input.modified?.resource?.toString() ?? input.resource?.toString();
					return undefined;
				},
			} as unknown as IEditorService,
			modelService: {
				getModel: (uri: URI) => models.has(uri.toString()) ? { uri } : null,
				updateModel: (model: { uri: URI }, value: string) => {
					models.set(model.uri.toString(), value);
				},
				createModel: (value: string, _language: unknown, uri?: URI) => {
					if (uri) {
						models.set(uri.toString(), value);
					}
					return { uri };
				},
			} as unknown as ISourcesChangeEntryOpenDeps['modelService'],
			readGitFileDiff: async gitEntry => {
				diffCalls.push({ path: gitEntry.gitPath ?? '', indexState: gitEntry.indexState ?? '' });
				return {
					supported: true,
					reason: '',
					path: gitEntry.gitPath ?? '',
					unifiedDiff: '@@ -1 +1 @@\n-old\n+new\n',
				};
			},
		}), { preserveFocus: false });

		assert.deepStrictEqual(diffCalls, [{ path: 'src/a.ts', indexState: 'WORKTREE' }]);
		assert.ok(openedOriginal?.includes('sources-git-diff'));
		assert.ok(openedModified?.includes('sources-git-diff'));
	});

	test('openSourcesChangeEntry does not invent a git diff when hook is missing or unsupported', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const entry: ISourcesChangeEntry = {
			resource,
			name: 'a.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/a.ts',
			indexState: 'WORKTREE',
		};

		let openedWithoutHook: string | undefined;
		await openSourcesChangeEntry(entry, createDeps({
			editorService: {
				openEditor: async (input: { resource?: URI }) => {
					openedWithoutHook = input.resource?.toString();
					return undefined;
				},
			} as unknown as IEditorService,
			modelService: {
				getModel: () => null,
				updateModel: () => { },
				createModel: () => { assert.fail('must not invent a diff model when hook is missing'); },
			} as unknown as ISourcesChangeEntryOpenDeps['modelService'],
		}), { preserveFocus: false });
		assert.strictEqual(openedWithoutHook, resource.toString());

		let openedUnsupported: string | undefined;
		const diffCalls: { path: string; indexState: string }[] = [];
		await openSourcesChangeEntry(entry, createDeps({
			editorService: {
				openEditor: async (input: { resource?: URI }) => {
					openedUnsupported = input.resource?.toString();
					return undefined;
				},
			} as unknown as IEditorService,
			modelService: {
				getModel: () => null,
				updateModel: () => { },
				createModel: () => { assert.fail('must not invent a diff model when GitService is unsupported'); },
			} as unknown as ISourcesChangeEntryOpenDeps['modelService'],
			readGitFileDiff: async gitEntry => {
				diffCalls.push({ path: gitEntry.gitPath ?? '', indexState: gitEntry.indexState ?? '' });
				return { supported: false, reason: '', path: '', unifiedDiff: '@@ -1 +1 @@\n-old\n+new\n' };
			},
		}), { preserveFocus: false });
		assert.deepStrictEqual(diffCalls, [{ path: 'src/a.ts', indexState: 'WORKTREE' }]);
		assert.strictEqual(openedUnsupported, resource.toString());
	});

	test('openSourcesChangeEntry does not open supported empty unifiedDiff as a new file', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const entry: ISourcesChangeEntry = {
			resource,
			name: 'a.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/a.ts',
			indexState: 'WORKTREE',
		};
		let opened = false;

		await assert.rejects(async () => {
			await openSourcesChangeEntry(entry, createDeps({
				editorService: {
					openEditor: async () => {
						opened = true;
						return undefined;
					},
				} as unknown as IEditorService,
				modelService: {
					getModel: () => null,
					updateModel: () => { },
					createModel: () => { assert.fail('must not invent a diff model for empty unifiedDiff'); },
				} as unknown as ISourcesChangeEntryOpenDeps['modelService'],
				readGitFileDiff: async () => ({
					supported: true,
					reason: '',
					path: 'src/a.ts',
					unifiedDiff: '',
				}),
			}), { preserveFocus: false });
		}, (error: Error) => {
			assert.strictEqual(error.message, sourcesGitEmptyFileDiffMessage());
			return true;
		});
		assert.strictEqual(opened, false);
	});

	test('engine-root row opens a hunk diff and unsupported diff stays unopenable', async function () {
		const resource = URI.from({ scheme: SOURCES_GIT_UNROOTED_SCHEME, path: '/src/a.ts' });
		const entry: ISourcesChangeEntry = {
			resource,
			name: 'a.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/a.ts',
			indexState: 'WORKTREE',
		};
		const unifiedDiff = '@@ -1 +1 @@\n-old\n+new\n';
		sourcesGitDiffContentStore.resetForTests();
		let openedOriginal: string | undefined;
		let openedModified: string | undefined;
		let openedFile: string | undefined;

		await openSourcesChangeEntry(entry, createDeps({
			editorService: {
				openEditor: async (input: { original?: { resource?: URI }; modified?: { resource?: URI }; resource?: URI }) => {
					openedOriginal = input.original?.resource?.toString();
					openedModified = input.modified?.resource?.toString();
					openedFile = input.resource?.toString();
					return undefined;
				},
			} as unknown as IEditorService,
			modelService: {
				getModel: () => null,
				updateModel: () => { },
				createModel: () => { assert.fail('must not invent a full file model'); },
			} as unknown as ISourcesChangeEntryOpenDeps['modelService'],
			readGitFileDiff: async () => ({
				supported: true,
				reason: '',
				path: 'src/a.ts',
				unifiedDiff,
			}),
		}), { preserveFocus: false });

		assert.strictEqual(openedFile, undefined);
		assert.ok(openedOriginal?.startsWith('sources-git-diff:'));
		assert.ok(openedModified?.startsWith('sources-git-diff:'));
		assert.strictEqual(sourcesGitDiffContentStore.get(sourcesGitDiffModelUri('original', 'src/a.ts', 'WORKTREE', entry.sessionId ?? ''))?.text, 'old\n');
		assert.strictEqual(sourcesGitDiffContentStore.get(sourcesGitDiffModelUri('modified', 'src/a.ts', 'WORKTREE', entry.sessionId ?? ''))?.text, 'new\n');

		let openedUnsupported = false;
		await assert.rejects(async () => {
			await openSourcesChangeEntry(entry, createDeps({
				editorService: {
					openEditor: async () => {
						openedUnsupported = true;
						return undefined;
					},
				} as unknown as IEditorService,
				modelService: {
					getModel: () => null,
					updateModel: () => { },
					createModel: () => { assert.fail('unsupported diff must not invent a model'); },
				} as unknown as ISourcesChangeEntryOpenDeps['modelService'],
				readGitFileDiff: async () => ({
					supported: false,
					reason: 'Git file diff is not supported',
					path: '',
					unifiedDiff,
				}),
			}), { preserveFocus: false });
		}, (error: Error) => {
			assert.strictEqual(error.message, 'Git file diff is not supported');
			assert.ok(!error.message.includes(SOURCES_GIT_UNROOTED_SCHEME));
			return true;
		});
		assert.strictEqual(openedUnsupported, false);
	});
});

suite('Sources - Changes list leftover honesty', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createEmptyScmService(): ISCMService {
		return {
			_serviceBrand: undefined,
			get repositories() { return []; },
			get repositoryCount() { return 0; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService;
	}

	function createRoster(sessionId = 'session-1', engineSessionReady = true): IConversationRosterService {
		return {
			getActiveSessionId: () => sessionId,
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: Event.None,
			isEngineSessionReady: () => engineSessionReady,
		} as unknown as IConversationRosterService;
	}

	function createSessionContext(connection: IUniverseAgentConnection, roster: IConversationRosterService, workDir?: string, workRoot?: IAgentWorkRoot): IAgentSessionContext {
		return {
			_serviceBrand: undefined,
			getActiveSessionId: () => roster.getActiveSessionId(),
			isEngineSessionReady: () => roster.isEngineSessionReady(),
			isPairingHold: () => {
				if (typeof connection.getConnectionPhase !== 'function' || typeof connection.getConnectionSnapshot !== 'function') {
					return false;
				}
				return connection.getConnectionPhase()?.kind === 'connected' && !!connection.getConnectionSnapshot()?.pairingPending;
			},
			onDidChangeActiveSession: roster.onDidChangeActiveSession,
			onDidChangeSession: roster.onDidChangeSession,
			acquireSessionView: () => { throw new Error('not used'); },
			getSessionWorkDir: () => workDir,
			...(workRoot ? { getWorkRoot: () => workRoot } : {}),
		};
	}

	function createGitReadConnection(options: {
		readonly onDidChangeConnection?: Event<UniverseAgentConnectionSnapshot>;
		readonly readGitChanges: () => Promise<{
			supported: boolean;
			reason: string;
			branch: string;
			entries: Array<{ path: string; oldPath: string; kind: string; indexState: string }>;
		}>;
		readonly readGitFileDiff?: () => Promise<{
			supported: boolean;
			reason: string;
			path: string;
			unifiedDiff: string;
		}>;
	}): IUniverseAgentConnection {
		return {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: options.onDidChangeConnection ?? Event.None,
			readGitChanges: options.readGitChanges,
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
			readGitFileDiff: options.readGitFileDiff,
		} as unknown as IUniverseAgentConnection;
	}

	function createIndexScmService(resource: URI, groupId = 'index', includeResource = true, extras?: {
		acceptInputCommand?: { id: string; arguments?: readonly unknown[] };
		rootUri?: URI;
		label?: string;
		name?: string;
		stagedResource?: URI;
	}): ISCMService {
		const group = {
			id: groupId,
			label: groupId === 'index' ? 'Staged Changes' : 'Changes',
			resources: [] as ISCMResource[],
		};
		const scmResource = {
			sourceUri: resource,
			resourceGroup: group,
			decorations: {},
			contextValue: undefined,
			command: undefined,
			multiDiffEditorOriginalUri: undefined,
			multiDiffEditorModifiedUri: undefined,
			open: async () => { },
		} as unknown as ISCMResource;
		if (includeResource) {
			group.resources.push(scmResource);
		}
		const groups = [group];
		if (extras?.stagedResource) {
			const indexGroup = {
				id: 'index',
				label: 'Staged Changes',
				resources: [] as ISCMResource[],
			};
			indexGroup.resources.push({
				sourceUri: extras.stagedResource,
				resourceGroup: indexGroup,
				decorations: {},
				open: async () => { },
			} as unknown as ISCMResource);
			groups.push(indexGroup);
		}
		const repository = {
			provider: {
				groups,
				label: extras?.label,
				name: extras?.name,
				rootUri: extras?.rootUri,
				acceptInputCommand: extras?.acceptInputCommand,
				onDidChangeResources: Event.None,
				onDidChangeResourceGroups: Event.None,
				inputBoxTextModel: { setValue: () => { } },
			},
			input: {
				value: '',
				setValue: () => { },
				onDidChange: Event.None,
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

	function stubChangesListServices(
		connection: IUniverseAgentConnection,
		scmService: ISCMService = createEmptyScmService(),
		executeCommand?: (commandId: string, ...args: unknown[]) => Promise<unknown>,
		openEditor?: (input: unknown) => Promise<unknown>,
		roster: IConversationRosterService = createRoster(),
		workDir?: string,
		workRoot?: IAgentWorkRoot,
	) {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		instantiationService.stub(ISCMService, scmService);
		instantiationService.stub(IConversationRosterService, roster);
		const effectiveWorkRoot = workRoot ?? (workDir ? {
			sessionId: roster.getActiveSessionId(),
			engineIdentityId: undefined,
			workDir,
			source: 'session' as const,
			access: resolveAgentLocalRoot({
				workDir,
				repositoryRoots: sourcesRepositoryRootUris(scmService.repositories ?? []),
				workspaceFolders: [],
			}) ? 'local' : 'engine',
			localRoot: resolveAgentLocalRoot({
				workDir,
				repositoryRoots: sourcesRepositoryRootUris(scmService.repositories ?? []),
				workspaceFolders: [],
			}),
			projectKey: undefined,
		} : undefined);
		instantiationService.stub(IAgentSessionContext, createSessionContext(connection, roster, workDir, effectiveWorkRoot));
		instantiationService.stub(ISourcesChangesModel, store.add(instantiationService.createInstance(SourcesChangesModel)));
		instantiationService.stub(IQuickDiffService, {
			getQuickDiffs: async () => [],
		} as unknown as IQuickDiffService);
		if (openEditor) {
			instantiationService.stub(IEditorService, {
				openEditor,
				replaceEditors: async (replacements: readonly { replacement: unknown }[]) => {
					await openEditor(replacements[0]?.replacement);
				},
			} as unknown as IEditorService);
		}
		instantiationService.stub(ISourcesDiffPanelService, {
			onDidChangeRef: Event.None,
			getCurrentRef: () => undefined,
			show: async () => { },
			clear: () => { },
		} as unknown as ISourcesDiffPanelService);
		instantiationService.stub(ICommandService, {
			onWillExecuteCommand: Event.None,
			onDidExecuteCommand: Event.None,
			executeCommand: executeCommand ?? (async () => undefined),
		} as unknown as ICommandService);
		return instantiationService;
	}

	function mountHost(): HTMLElement {
		const host = document.createElement('div');
		host.style.width = '400px';
		host.style.height = '300px';
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });
		return host;
	}

	function readChangesNotice(host: HTMLElement): string {
		const block = host.querySelector('.sources-changes-status')?.textContent ?? '';
		if (block) {
			return block;
		}
		return host.querySelector('.sources-changes-provenance')?.textContent ?? '';
	}

	async function waitForStatusText(host: HTMLElement, contains?: string): Promise<string> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			const text = readChangesNotice(host);
			if (text && (!contains || text.includes(contains))) {
				return text;
			}
			await timeout(20);
		}
		throw new Error(`status stayed empty${contains ? ` (wanted ${contains})` : ''}`);
	}

	async function waitForEmptyText(host: HTMLElement, contains: string): Promise<string> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			const text = host.querySelector('.sources-changes-empty')?.textContent ?? '';
			if (text.includes(contains)) {
				return text;
			}
			await timeout(20);
		}
		throw new Error(`empty stayed without ${contains}`);
	}

	function assertChangesFailureOnlyInEmpty(host: HTMLElement): void {
		const status = host.querySelector('.sources-changes-status') as HTMLElement | null;
		assert.strictEqual(status?.textContent ?? '', '');
		assert.strictEqual(status?.style.display ?? 'none', 'none');
		assert.ok(!status?.classList.contains('is-error'));
	}

	async function waitForList(owner: { list?: WorkbenchList<ISourcesChangeEntry> }): Promise<WorkbenchList<ISourcesChangeEntry>> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			const list = (owner as { list?: WorkbenchList<ISourcesChangeEntry> }).list;
			if (list && list.length > 0) {
				list.layout(120, 400);
				return list;
			}
			await timeout(20);
		}
		throw new Error('list stayed empty');
	}

	function modelSnapshot(instantiationService: ReturnType<typeof stubChangesListServices>) {
		return instantiationService.invokeFunction(accessor => accessor.get(ISourcesChangesModel).getSnapshot());
	}

	async function openFirstListRow(owner: { list?: WorkbenchList<ISourcesChangeEntry> }): Promise<void> {
		const list = await waitForList(owner);
		list.setFocus([0]);
		list.setSelection([0], getSelectionKeyboardEvent('keydown', false, false));
	}

	test('a later changes open keeps its status when an older open finishes', async function () {
		let diffCalls = 0;
		let releaseLate: (() => void) | undefined;
		const lateGate = new Promise<void>(resolve => { releaseLate = resolve; });
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
			readGitFileDiff: async () => {
				diffCalls += 1;
				if (diffCalls === 1) {
					await lateGate;
					throw new Error('late-boom');
				}
				return { supported: false, reason: '', path: 'src/a.ts', unifiedDiff: '' };
			},
		} as unknown as IUniverseAgentConnection;
		const instantiationService = stubChangesListServices(connection);
		const configurationService = instantiationService.invokeFunction(accessor => accessor.get(IConfigurationService)) as TestConfigurationService;
		await configurationService.setUserConfiguration('sources.diff.defaultOwner', 'conversation');
		const host = mountHost();
		const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		list.setFocus([0]);
		list.setSelection([0], getSelectionKeyboardEvent('keydown', false, false));
		const started = Date.now() + 2000;
		while (diffCalls < 1 && Date.now() < started) {
			await timeout(10);
		}
		assert.strictEqual(diffCalls, 1);
		list.setSelection([]);
		list.setSelection([0], getSelectionKeyboardEvent('keydown', false, false));
		const expected = sourcesGitDiffOpenFailureMessage(new Error(sourcesConversationLeafMissingMessage()));
		const status = await waitForStatusText(host, expected);
		assert.strictEqual(status, expected);
		releaseLate!();
		await timeout(40);
		assert.strictEqual(readChangesNotice(host), status);
		assert.ok(!readChangesNotice(host).includes('late-boom'));
	});

	test('first git-read throw stays empty and paints failure', async function () {
		const host = mountHost();
		const widget = store.add(stubChangesListServices(createGitReadConnection({
			readGitChanges: async () => {
				throw new Error('boom');
			},
		})).createInstance(SourcesChangesList, host));

		const empty = await waitForEmptyText(host, 'Unable to read git changes');
		assert.strictEqual(empty, sourcesGitReadFailureMessage('boom'));
		assert.strictEqual((widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> }).list?.length ?? 0, 0);
		assert.ok(!host.querySelector('.sources-changes-list .monaco-list-row'));
		assert.ok(!empty.includes('No changes.'));
		assertChangesFailureOnlyInEmpty(host);
		assert.strictEqual((host.querySelector('.sources-changes-commit') as HTMLElement | null)?.style.display, 'none');
	});

	test('first git-read throw with an SCM repository still hides commit chrome', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const host = mountHost();
		const scm = createIndexScmService(resource, 'index', false);
		store.add(stubChangesListServices(createGitReadConnection({
			readGitChanges: async () => {
				throw new Error('boom');
			},
		}), scm).createInstance(SourcesChangesList, host));

		const empty = await waitForEmptyText(host, 'Unable to read git changes');
		assert.strictEqual(empty, sourcesGitReadFailureMessage('boom'));
		assertChangesFailureOnlyInEmpty(host);
		assert.strictEqual((host.querySelector('.sources-changes-commit') as HTMLElement | null)?.style.display, 'none');
	});

	test('success then git-read throw keeps leftover rows and paints failure', async function () {
		let readCalls = 0;
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const leftover = { path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
		const connection = createGitReadConnection({
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls++;
				if (readCalls === 1) {
					return {
						supported: true,
						reason: '',
						branch: 'main',
						entries: [leftover],
					};
				}
				throw new Error('boom');
			},
		});

		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).name, 'leftover.ts');
		assert.strictEqual(readCalls, 1);

		onDidChangeConnection.fire({} as UniverseAgentConnectionSnapshot);

		const status = await waitForStatusText(host, 'Unable to read git changes');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.strictEqual(readCalls, 2);
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).name, 'leftover.ts');
		assert.ok(host.querySelector('.sources-changes-list .monaco-list-row'));
		assert.notStrictEqual((host.querySelector('.sources-changes-status') as HTMLElement).style.display, 'none');
	});

	test('success then missing readGitChanges keeps leftover rows and does not paint local-only', async function () {
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const leftover = { path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
		const connection = createGitReadConnection({
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [leftover],
			}),
		});
		const scmStub = toResource.call(this, '/project/src/scm-stub.ts');
		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection, createIndexScmService(scmStub)).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);

		delete (connection as { readGitChanges?: unknown }).readGitChanges;
		onDidChangeConnection.fire({} as UniverseAgentConnectionSnapshot);

		const status = await waitForStatusText(host, 'unavailable');
		assert.strictEqual(status, sourcesGitReadUnavailableNoHookMessage());
		assert.ok(!status.includes('local source control'));
		assert.notStrictEqual(status, sourcesGitLocalOnlyMessage());
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);
		assert.strictEqual(list.element(0).scmResource, undefined);
	});

	test('proxy write methods with UNSUPPORTED git write capability do not offer engine stage or commit', async function () {
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({
				pairingPending: false,
				gitWriteCapability: {
					writeGitStagePaths: 'UNSUPPORTED' as const,
					writeGitCommit: 'UNSUPPORTED' as const,
					writeGitApplyHunks: 'UNSUPPORTED' as const,
				},
			}),
			onDidChangeConnection: Event.None,
			writeGitStagePaths: async () => {
				throw new Error('must not stage');
			},
			writeGitCommit: async () => {
				throw new Error('must not commit');
			},
		} as unknown as IUniverseAgentConnection;
		const scmStub = toResource.call(this, '/project/src/scm-stub.ts');
		const host = mountHost();
		const instantiationService = stubChangesListServices(connection, createIndexScmService(scmStub));
		const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
		assert.strictEqual(widget.canWriteStage(), false);
		assert.strictEqual(widget.canWriteCommit(), false);
	});

	test('proxy readGitChanges with UNSUPPORTED capability falls back to local SCM', async function () {
		let readCalls = 0;
		const capabilities = {
			...createEmptyCapabilitySnapshot(),
			readGitChanges: { support: 'UNSUPPORTED' as const, reason: 'method not advertised' },
		};
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false, capabilities }),
			getCapabilitySnapshot: () => capabilities,
			onDidChangeConnection: Event.None,
			readGitChanges: async () => {
				readCalls += 1;
				throw new Error('must not call readGitChanges when unsupported');
			},
			readGitSummary: async () => {
				readCalls += 1;
				throw new Error('must not call readGitSummary when unsupported');
			},
		} as unknown as IUniverseAgentConnection;
		const scmStub = toResource.call(this, '/project/src/scm-stub.ts');
		const host = mountHost();
		const instantiationService = stubChangesListServices(connection, createIndexScmService(scmStub));
		const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		const status = await waitForStatusText(host, 'local source control');
		assert.strictEqual(status, sourcesGitLocalOnlyMessage());
		assert.ok(!status.includes('Unable to read git changes'));
		assert.notStrictEqual(status, sourcesGitReadFailureMessage('must not call readGitChanges when unsupported'));
		assert.strictEqual(readCalls, 0);
		assert.strictEqual(list.length, 1);
		assert.ok(list.element(0).scmResource);
		const snap = modelSnapshot(instantiationService);
		assert.strictEqual(snap.state.kind, 'scm');
		assert.strictEqual(snap.failureMessage, undefined);
	});

	test('success then pairingPending keeps leftover rows and does not paint local-only', async function () {
		let connected = true;
		let pairingPending = false;
		let readCalls = 0;
		const leftover = { path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			sharedFsRootSent: false,
			pairingPending,
			channelAlive: connected,
			capabilities: {} as never,
		});
		const connection = {
			isEngineConnected: () => connected && !pairingPending,
			getConnectionPhase: () => ({ kind: connected ? 'connected' as const : 'disconnected' as const }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls += 1;
				return {
					supported: true,
					reason: '',
					branch: 'main',
					entries: [leftover],
				};
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
		} as unknown as IUniverseAgentConnection;
		const scmStub = toResource.call(this, '/project/src/scm-stub.ts');
		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection, createIndexScmService(scmStub)).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);
		assert.strictEqual(readCalls, 1);

		pairingPending = true;
		onDidChangeConnection.fire(snapshot());

		const pairingStatus = await waitForStatusText(host, 'not connected');
		assert.strictEqual(pairingStatus, sourcesGitReadPairingHoldMessage());
		assert.ok(pairingStatus.includes('pairing'));
		assert.ok(!pairingStatus.includes('local source control'));
		assert.notStrictEqual(pairingStatus, sourcesGitLocalOnlyMessage());
		assert.strictEqual(readCalls, 1);
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);
		assert.strictEqual(list.element(0).scmResource, undefined);

		connected = false;
		pairingPending = false;
		onDidChangeConnection.fire(snapshot());

		const disconnectStatus = await waitForStatusText(host, 'local source control');
		assert.strictEqual(disconnectStatus, sourcesGitLocalOnlyMessage());
		assert.strictEqual(readCalls, 1);
		assert.strictEqual(list.length, 1);
		assert.ok(list.element(0).scmResource);
		assert.ok((list.element(0).resource.path ?? '').includes('scm-stub.ts'));
	});

	test('leftover-looks-live pairing-hold keeps leftover rows and skips git-read', async function () {
		let connected = true;
		let pairingPending = false;
		let readCalls = 0;
		let diffCalls = 0;
		let openCalls = 0;
		const leftover = { path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			sharedFsRootSent: false,
			pairingPending,
			channelAlive: connected,
			capabilities: {} as never,
		});
		const connection = {
			isEngineConnected: () => connected,
			getConnectionPhase: () => ({ kind: connected ? 'connected' as const : 'disconnected' as const }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls += 1;
				return {
					supported: true,
					reason: '',
					branch: 'main',
					entries: [leftover],
				};
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
			readGitFileDiff: async () => {
				diffCalls += 1;
				throw new Error('must not readGitFileDiff while leftover-looks-live');
			},
		} as unknown as IUniverseAgentConnection;
		const scmStub = toResource.call(this, '/project/src/scm-stub.ts');
		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection, createIndexScmService(scmStub), undefined, async () => {
			openCalls += 1;
			return undefined;
		}).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);
		assert.strictEqual(isConversationPairingHold(connection), false);
		const listCallsAfterLoad = readCalls;

		pairingPending = true;
		onDidChangeConnection.fire(snapshot());

		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);
		const pairingStatus = await waitForStatusText(host, 'not connected');
		assert.strictEqual(pairingStatus, sourcesGitReadPairingHoldMessage());
		assert.ok(!pairingStatus.includes('local source control'));
		assert.notStrictEqual(pairingStatus, sourcesGitLocalOnlyMessage());
		assert.strictEqual(readCalls, listCallsAfterLoad, 'leftover-looks-live must not extra readGitChanges');
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);
		assert.strictEqual(list.element(0).scmResource, undefined);

		await openFirstListRow(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		await timeout(20);
		assert.strictEqual(diffCalls, 0, 'leftover-looks-live must not extra readGitFileDiff');
		assert.strictEqual(openCalls, 0, 'KEEP pairing-hold leftover must not fake preview');
		assert.strictEqual(host.querySelector('.sources-changes-status')?.textContent ?? '', sourcesGitReadPairingHoldMessage());
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);

		connected = false;
		pairingPending = false;
		onDidChangeConnection.fire(snapshot());

		const disconnectStatus = await waitForStatusText(host, 'local source control');
		assert.strictEqual(disconnectStatus, sourcesGitLocalOnlyMessage());
		assert.strictEqual(readCalls, listCallsAfterLoad);
		assert.strictEqual(diffCalls, 0);
		assert.strictEqual(list.length, 1);
		assert.ok(list.element(0).scmResource);
		assert.ok((list.element(0).resource.path ?? '').includes('scm-stub.ts'));
	});

	test('in-flight readGitChanges leftover-looks-live keeps leftover and does not paint fresh live', async function () {
		let connected = true;
		let pairingPending = false;
		let readCalls = 0;
		let resolveInFlight: ((value: {
			supported: boolean;
			reason: string;
			branch: string;
			entries: Array<{ path: string; oldPath: string; kind: string; indexState: string }>;
		}) => void) | undefined;
		const leftover = { path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
		const freshLive = { path: 'src/fresh-live.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			sharedFsRootSent: false,
			pairingPending,
			channelAlive: connected,
			capabilities: {} as never,
		});
		const connection = {
			isEngineConnected: () => connected,
			getConnectionPhase: () => ({ kind: connected ? 'connected' as const : 'disconnected' as const }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls += 1;
				if (readCalls === 1) {
					return {
						supported: true,
						reason: '',
						branch: 'main',
						entries: [leftover],
					};
				}
				return new Promise(resolve => {
					resolveInFlight = resolve;
				});
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
		} as unknown as IUniverseAgentConnection;
		const scmStub = toResource.call(this, '/project/src/scm-stub.ts');
		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection, createIndexScmService(scmStub)).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);
		assert.strictEqual(isConversationPairingHold(connection), false);
		assert.strictEqual(readCalls, 1);

		onDidChangeConnection.fire(snapshot());
		const inflightDeadline = Date.now() + 2000;
		while (!resolveInFlight && Date.now() < inflightDeadline) {
			await timeout(20);
		}
		assert.ok(resolveInFlight, 'in-flight readGitChanges must start while still live');
		assert.strictEqual(readCalls, 2);

		pairingPending = true;
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		resolveInFlight({
			supported: true,
			reason: '',
			branch: 'main',
			entries: [freshLive],
		});
		const pairingStatus = await waitForStatusText(host, 'not connected');
		assert.strictEqual(pairingStatus, sourcesGitReadPairingHoldMessage());
		assert.ok(!pairingStatus.includes('local source control'));
		assert.notStrictEqual(pairingStatus, sourcesGitLocalOnlyMessage());
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);
		assert.notStrictEqual(list.element(0).gitPath, freshLive.path, 'in-flight leftover-looks-live must not paint fresh live');
		assert.strictEqual(list.element(0).scmResource, undefined);
	});

	test('a slower ReadGitChanges must not replace a newer snapshot after the fast read lands', async function () {
		let readCalls = 0;
		let releaseSlow: (() => void) | undefined;
		const slowGate = new Promise<void>(resolve => { releaseSlow = resolve; });
		const oldEntry = { path: 'src/old-slow.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
		const newEntry = { path: 'src/new-fast.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
		const connection = createGitReadConnection({
			readGitChanges: async () => {
				readCalls += 1;
				if (readCalls === 1) {
					await slowGate;
					return {
						supported: true,
						reason: '',
						branch: 'main',
						entries: [oldEntry],
					};
				}
				return {
					supported: true,
					reason: '',
					branch: 'main',
					entries: [newEntry],
				};
			},
		});
		const host = mountHost();
		const instantiationService = stubChangesListServices(connection);
		const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
		const model = instantiationService.invokeFunction(accessor => accessor.get(ISourcesChangesModel));

		const slowRefresh = model.refresh();
		await timeout(0);
		assert.strictEqual(readCalls, 1);
		await model.refresh();

		const snapshotAfterFast = model.getSnapshot();
		assert.strictEqual(snapshotAfterFast.state.kind, 'engine-live');
		assert.strictEqual(snapshotAfterFast.entries.length, 1);
		assert.strictEqual(snapshotAfterFast.entries[0]?.gitPath, newEntry.path);

		releaseSlow!();
		await slowRefresh;
		await timeout(40);

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.element(0).gitPath, newEntry.path);

		const snapshotAfterSlow = model.getSnapshot();
		assert.strictEqual(snapshotAfterSlow.generation, snapshotAfterFast.generation);
		assert.strictEqual(snapshotAfterSlow.entries[0]?.gitPath, newEntry.path);
		assert.notStrictEqual(snapshotAfterSlow.entries[0]?.gitPath, oldEntry.path);
		assert.strictEqual(readCalls, 2);
	});

	test('scm snapshot with local rows keeps scm when readGitChanges throws again and Stage stays on git.stage', async function () {
		let connected = false;
		let readCalls = 0;
		const gitStageCommands: string[] = [];
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			sharedFsRootSent: false,
			pairingPending: false,
			channelAlive: connected,
			capabilities: {} as never,
		});
		const connection = {
			isEngineConnected: () => connected,
			getConnectionPhase: () => ({ kind: connected ? 'connected' as const : 'disconnected' as const }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls += 1;
				throw new Error('boom');
			},
			readGitSummary: async () => {
				throw new Error('boom');
			},
			writeGitStagePaths: async (request: UniverseAgentWriteGitStagePathsRequest) => {
				stageCalls.push(request);
				return {
					supported: true,
					reason: '',
					success: true,
					errorMessage: '',
					exitCode: 0,
					stdout: '',
				};
			},
		} as unknown as IUniverseAgentConnection;
		const stageCommand = CommandsRegistry.registerCommand('git.stage', () => { });
		try {
			const scmStub = toResource.call(this, '/project/src/scm-stage-after-read-fail.ts');
			const scmService = createIndexScmService(scmStub, 'workingTree');
			const host = mountHost();
			const instantiationService = stubChangesListServices(connection, scmService, async (commandId: string) => {
				if (commandId === 'git.stage') {
					gitStageCommands.push(commandId);
				}
			});
			const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

			const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			assert.strictEqual(readCalls, 0);
			assert.ok(list.element(0).scmResource);
			assert.strictEqual(modelSnapshot(instantiationService).state.kind, 'scm');

			connected = true;
			onDidChangeConnection.fire(snapshot());

			const status = await waitForStatusText(host, 'Unable to read git changes');
			assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
			assert.strictEqual(readCalls, 1);
			const modelSnap = modelSnapshot(instantiationService);
			assert.strictEqual(modelSnap.state.kind, 'scm');
			assert.ok(modelSnap.failureMessage?.includes('Unable to read git changes'));
			assert.strictEqual(list.length, 1);
			assert.ok(list.element(0).scmResource);
			assert.ok(!(host.querySelector('.sources-changes-empty')?.textContent ?? '').includes('No changes.'));

			list.setFocus([0]);
			list.setSelection([0]);
			await timeout(20);
			await (widget as unknown as { runOnSelected: (action: 'stage') => Promise<void> }).runOnSelected('stage');
			assert.deepStrictEqual(gitStageCommands, ['git.stage']);
			assert.strictEqual(stageCalls.length, 0);

			let emptyConnected = false;
			let emptyReadCalls = 0;
			const emptyConnectionEmitter = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
			const emptySnapshot = (): UniverseAgentConnectionSnapshot => ({
				transport: emptyConnected ? 'ok' : 'idle',
				sharedFsRootSent: false,
				pairingPending: false,
				channelAlive: emptyConnected,
				capabilities: {} as never,
			});
			const emptyScmHost = mountHost();
			const emptyInstantiation = stubChangesListServices({
				isEngineConnected: () => emptyConnected,
				getConnectionPhase: () => ({ kind: emptyConnected ? 'connected' as const : 'disconnected' as const }),
				getConnectionSnapshot: emptySnapshot,
				onDidChangeConnection: emptyConnectionEmitter.event,
				readGitChanges: async () => {
					emptyReadCalls += 1;
					throw new Error('boom');
				},
				readGitSummary: async () => {
					throw new Error('boom');
				},
			} as unknown as IUniverseAgentConnection);
			store.add(emptyInstantiation.createInstance(SourcesChangesList, emptyScmHost));
			const emptyDeadline = Date.now() + 2000;
			while (Date.now() < emptyDeadline) {
				const empty = emptyScmHost.querySelector('.sources-changes-empty')?.textContent ?? '';
				if (empty.includes('No source control repository')) {
					break;
				}
				await timeout(20);
			}
			assert.strictEqual(emptyReadCalls, 0);
			emptyConnected = true;
			emptyConnectionEmitter.fire(emptySnapshot());
			await waitForEmptyText(emptyScmHost, 'Unable to read git changes');
			assertChangesFailureOnlyInEmpty(emptyScmHost);
			assert.strictEqual(emptyReadCalls, 1);
			const emptySnap = modelSnapshot(emptyInstantiation);
			assert.strictEqual(emptySnap.state.kind, 'scm');
			assert.ok(emptySnap.failureMessage?.includes('Unable to read git changes'));
			assert.strictEqual(emptySnap.entries.length, 0);
			assert.ok(!(emptyScmHost.querySelector('.sources-changes-empty')?.textContent ?? '').includes('No changes.'));
			assert.strictEqual((emptyScmHost.querySelector('.sources-changes-commit') as HTMLElement | null)?.style.display, 'none');
		} finally {
			stageCommand.dispose();
		}
	});

	test('leftover-looks-live first-pull pairing without leftover stays SCM and skips git-read', async function () {
		let readCalls = 0;
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: true }),
			onDidChangeConnection: Event.None,
			readGitChanges: async () => {
				readCalls += 1;
				throw new Error('must not readGitChanges while leftover-looks-live first-pull');
			},
			readGitSummary: async () => {
				readCalls += 1;
				throw new Error('must not readGitSummary while leftover-looks-live first-pull');
			},
			readGitFileDiff: async () => {
				readCalls += 1;
				throw new Error('must not readGitFileDiff while leftover-looks-live first-pull');
			},
		} as unknown as IUniverseAgentConnection;
		assert.strictEqual(isConversationPairingHold(connection), true);
		const scmStub = toResource.call(this, '/project/src/scm-stub.ts');
		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection, createIndexScmService(scmStub)).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		const status = await waitForStatusText(host, 'local source control');
		assert.strictEqual(status, sourcesGitLocalOnlyMessage());
		assert.strictEqual((host.querySelector('.sources-changes-status') as HTMLElement | null)?.style.display ?? 'none', 'none');
		assert.strictEqual((host.querySelector('.sources-changes-toolbar') as HTMLElement | null)?.style.display ?? 'none', 'none');
		assert.strictEqual(host.querySelector('.sources-changes-commit-input')?.tagName, 'TEXTAREA');
		assert.strictEqual(host.querySelector('.sources-change-group-title')?.textContent, 'Staged Changes');
		assert.strictEqual(host.querySelector('.sources-change-group-count')?.textContent, '1');
		assert.strictEqual(host.querySelector('.sources-change-status-letter')?.textContent, 'M');
		const description = host.querySelector('.label-description')?.textContent ?? '';
		assert.notStrictEqual(description, 'Changes');
		assert.notStrictEqual(description, 'Staged Changes');
		assert.strictEqual(readCalls, 0);
		assert.strictEqual(list.length, 1);
		assert.ok(list.element(0).scmResource);
		assert.ok((list.element(0).resource.path ?? '').includes('scm-stub.ts'));
	});

	const acceptedWrite: UniverseAgentWriteGitWriteResult = {
		supported: true,
		reason: '',
		success: true,
		errorMessage: '',
		exitCode: 0,
		stdout: '',
	};

	function forceClick(button: HTMLElement | null): void {
		if (!button) {
			return;
		}
		button.classList.remove('disabled');
		button.removeAttribute('disabled');
		button.setAttribute('aria-disabled', 'false');
		if ('disabled' in button) {
			(button as HTMLButtonElement).disabled = false;
		}
		button.click();
	}

	async function assertWarnThenRethrowDoesNotLeak(paintBoom: Error, run: () => void | Promise<void>): Promise<void> {
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			await run();
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
				unhandledRejections: [],
				unexpectedWarns: [paintBoom, paintBoom],
			});
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	}

	async function waitForEnabledButton(host: HTMLElement, selector: string): Promise<HTMLElement> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			for (const button of host.querySelectorAll(selector)) {
				if (!button.classList.contains('disabled')) {
					return button as HTMLElement;
				}
			}
			await timeout(20);
		}
		throw new Error(`enabled button ${selector} not found`);
	}

	function stageSelectedButton(host: HTMLElement): HTMLElement | null {
		return host.querySelector('.sources-changes-toolbar .monaco-button');
	}

	function selectFirstChange(list: WorkbenchList<ISourcesChangeEntry>): void {
		list.setFocus([0]);
		list.setSelection([0]);
	}

	function assertStageChrome(host: HTMLElement, enabled: boolean): void {
		const unavailable = !enabled;
		const stage = stageSelectedButton(host);
		assert.ok(stage, 'Stage Selected is the toolbar first button');
		assert.strictEqual(stage.classList.contains('disabled'), unavailable);
		assert.strictEqual(stage.getAttribute('aria-disabled'), String(unavailable));
		for (const selector of ['.sources-change-action', '.sources-change-group-action']) {
			const button = host.querySelector(selector) as HTMLElement | null;
			assert.ok(button, selector);
			assert.strictEqual(button.style.display, '');
			assert.strictEqual(button.classList.contains('disabled'), unavailable);
			assert.strictEqual(button.getAttribute('aria-disabled'), String(unavailable));
		}
	}

	function unstageSelectedButton(host: HTMLElement): HTMLElement | null {
		return host.querySelector('.sources-changes-toolbar .monaco-button:nth-child(2)');
	}

	function commitButton(host: HTMLElement): HTMLElement | null {
		return host.querySelector('.sources-changes-commit .monaco-button');
	}

	async function waitForWriteButtonsDisabled(host: HTMLElement): Promise<void> {
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline) {
			const stage = stageSelectedButton(host);
			const commit = commitButton(host);
			if (stage?.classList.contains('disabled') && commit?.classList.contains('disabled')) {
				return;
			}
			await timeout(20);
		}
		throw new Error('Stage / Commit stayed enabled');
	}

	test('success then pairingPending disables Stage / Commit and forced click stays 0 unary', async function () {
		let connected = true;
		let pairingPending = false;
		let readCalls = 0;
		const leftover = { path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const commitCalls: UniverseAgentWriteGitCommitRequest[] = [];
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			sharedFsRootSent: false,
			pairingPending,
			channelAlive: connected,
			capabilities: {} as never,
		});
		const connection = {
			isEngineConnected: () => connected && !pairingPending,
			getConnectionPhase: () => ({ kind: connected ? 'connected' as const : 'disconnected' as const }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls += 1;
				return {
					supported: true,
					reason: '',
					branch: 'main',
					entries: [leftover],
				};
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
			writeGitStagePaths: async (request: UniverseAgentWriteGitStagePathsRequest) => {
				stageCalls.push(request);
				return acceptedWrite;
			},
			writeGitCommit: async (request: UniverseAgentWriteGitCommitRequest) => {
				commitCalls.push(request);
				return acceptedWrite;
			},
		} as unknown as IUniverseAgentConnection;
		const scmStub = toResource.call(this, '/project/src/scm-stub.ts');
		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection, createIndexScmService(scmStub)).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.element(0).gitPath, leftover.path);
		list.setFocus([0]);
		list.setSelection([0]);
		const commitInput = host.querySelector('.sources-changes-commit-input') as HTMLInputElement;
		commitInput.value = 'fix leftover';
		commitInput.dispatchEvent(new mainWindow.Event('input', { bubbles: true }));
		await timeout(20);
		assert.strictEqual(stageSelectedButton(host)?.classList.contains('disabled'), false);
		assert.strictEqual(commitButton(host)?.classList.contains('disabled'), false);

		pairingPending = true;
		onDidChangeConnection.fire(snapshot());

		const pairingStatus = await waitForStatusText(host, 'not connected');
		assert.strictEqual(pairingStatus, sourcesGitReadPairingHoldMessage());
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);
		assert.strictEqual(readCalls, 1);
		list.setFocus([0]);
		list.setSelection([0]);
		commitInput.value = 'fix leftover';
		commitInput.dispatchEvent(new mainWindow.Event('input', { bubbles: true }));
		await waitForWriteButtonsDisabled(host);

		forceClick(stageSelectedButton(host));
		forceClick(commitButton(host));
		await timeout(20);
		assert.deepStrictEqual(stageCalls, []);
		assert.deepStrictEqual(commitCalls, []);
	});

	test('leftover-looks-live pairing-hold Stage / Commit stay 0 unary', async function () {
		let pairingPending = false;
		let readCalls = 0;
		const leftover = { path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const commitCalls: UniverseAgentWriteGitCommitRequest[] = [];
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: 'ok',
			sharedFsRootSent: false,
			pairingPending,
			channelAlive: true,
			capabilities: {} as never,
		});
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls += 1;
				return {
					supported: true,
					reason: '',
					branch: 'main',
					entries: [leftover],
				};
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
			writeGitStagePaths: async (request: UniverseAgentWriteGitStagePathsRequest) => {
				stageCalls.push(request);
				return acceptedWrite;
			},
			writeGitCommit: async (request: UniverseAgentWriteGitCommitRequest) => {
				commitCalls.push(request);
				return acceptedWrite;
			},
		} as unknown as IUniverseAgentConnection;
		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.element(0).gitPath, leftover.path);
		const listCallsAfterLoad = readCalls;
		list.setFocus([0]);
		list.setSelection([0]);
		const commitInput = host.querySelector('.sources-changes-commit-input') as HTMLInputElement;
		commitInput.value = 'looks live';
		commitInput.dispatchEvent(new mainWindow.Event('input', { bubbles: true }));
		await timeout(20);

		pairingPending = true;
		onDidChangeConnection.fire(snapshot());

		list.setFocus([0]);
		list.setSelection([0]);
		commitInput.value = 'looks live';
		commitInput.dispatchEvent(new mainWindow.Event('input', { bubbles: true }));
		await waitForWriteButtonsDisabled(host);
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);
		assert.strictEqual(readCalls, listCallsAfterLoad);

		forceClick(stageSelectedButton(host));
		forceClick(commitButton(host));
		await timeout(20);
		assert.deepStrictEqual(stageCalls, []);
		assert.deepStrictEqual(commitCalls, []);
	});

	test('list-fail leftover closes Stage / Commit and forced click stays 0 unary', async function () {
		let readCalls = 0;
		let diffCalls = 0;
		const leftover = { path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const commitCalls: UniverseAgentWriteGitCommitRequest[] = [];
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls += 1;
				if (readCalls === 1) {
					return {
						supported: true,
						reason: '',
						branch: 'main',
						entries: [leftover],
					};
				}
				throw new Error('boom');
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
			readGitFileDiff: async () => {
				diffCalls += 1;
				return {
					supported: true,
					reason: '',
					path: leftover.path,
					unifiedDiff: '@@ -1 +1 @@\n-old\n+new\n',
				};
			},
			writeGitStagePaths: async (request: UniverseAgentWriteGitStagePathsRequest) => {
				stageCalls.push(request);
				return acceptedWrite;
			},
			writeGitCommit: async (request: UniverseAgentWriteGitCommitRequest) => {
				commitCalls.push(request);
				return acceptedWrite;
			},
		} as unknown as IUniverseAgentConnection;
		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		onDidChangeConnection.fire({} as UniverseAgentConnectionSnapshot);
		const status = await waitForStatusText(host, 'Unable to read git changes');
		assert.ok(status.includes('boom'));
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);

		list.setFocus([0]);
		list.setSelection([0]);
		const commitInput = host.querySelector('.sources-changes-commit-input') as HTMLInputElement;
		commitInput.value = 'keep leftover';
		commitInput.dispatchEvent(new mainWindow.Event('input', { bubbles: true }));
		await waitForWriteButtonsDisabled(host);

		const stage = stageSelectedButton(host);
		const commit = commitButton(host);
		assert.ok(stage);
		assert.ok(commit);
		assert.strictEqual(stage.classList.contains('disabled'), true);
		assert.strictEqual(commit.classList.contains('disabled'), true);
		assert.strictEqual(stage.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(commit.getAttribute('aria-disabled'), 'true');
		const rowAction = host.querySelector('.sources-change-action') as HTMLElement | null;
		assert.ok(!rowAction || rowAction.style.display === 'none' || rowAction.classList.contains('disabled'));

		forceClick(stage);
		forceClick(commit);
		forceClick(rowAction);
		await timeout(20);
		assert.deepStrictEqual(stageCalls, []);
		assert.deepStrictEqual(commitCalls, []);

		await openFirstListRow(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		await timeout(20);
		assert.strictEqual(diffCalls, 0, 'list-fail leftover must not readGitFileDiff');
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);
		const statusAfterOpen = host.querySelector('.sources-changes-status')?.textContent ?? '';
		assert.strictEqual(statusAfterOpen, sourcesGitReadFailureMessage('boom'));
	});

	test('list-fail leftover closes Unstage and forced click stays 0 git.unstage', async function () {
		let readCalls = 0;
		const gitUnstageCommands: string[] = [];
		const leftover = { path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'INDEX' };
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => {
				readCalls += 1;
				if (readCalls === 1) {
					return {
						supported: true,
						reason: '',
						branch: 'main',
						entries: [leftover],
					};
				}
				throw new Error('boom');
			},
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
		} as unknown as IUniverseAgentConnection;
		const unstageCommand = CommandsRegistry.registerCommand('git.unstage', () => { });
		try {
			const scmStub = toResource.call(this, '/project/src/leftover-unstage.ts');
			const scmService = createIndexScmService(scmStub);
			const scmResource = [...scmService.repositories][0].provider.groups[0].resources[0];
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, scmService, async (commandId: string) => {
				if (commandId === 'git.unstage') {
					gitUnstageCommands.push(commandId);
				}
			}).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

			const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			onDidChangeConnection.fire({} as UniverseAgentConnectionSnapshot);
			const status = await waitForStatusText(host, 'Unable to read git changes');
			assert.ok(status.includes('boom'));
			assert.strictEqual(list.length, 1);
			assert.strictEqual(list.element(0).gitPath, leftover.path);

			list.setFocus([0]);
			list.setSelection([0]);
			await timeout(20);

			const unstage = unstageSelectedButton(host);
			assert.ok(unstage, 'Unstage Selected is the toolbar second button');
			assert.strictEqual(unstage.classList.contains('disabled'), true);
			assert.strictEqual(unstage.getAttribute('aria-disabled'), 'true');
			const rowAction = host.querySelector('.sources-change-action') as HTMLElement | null;
			assert.ok(!rowAction || rowAction.style.display === 'none' || rowAction.classList.contains('disabled'));

			forceClick(unstage);
			forceClick(rowAction);
			await (widget as unknown as { runOnSelected: (action: 'unstage') => Promise<void> }).runOnSelected('unstage');
			await (widget as unknown as { runResourceAction: (entry: ISourcesChangeEntry, action: 'unstage') => Promise<void> }).runResourceAction({
				resource: scmStub,
				name: 'leftover-unstage.ts',
				description: 'Staged Changes',
				groupId: 'index',
				scmResource,
			}, 'unstage');
			await timeout(20);
			assert.strictEqual(gitUnstageCommands.length, 0);
			assert.strictEqual(list.length, 1);
			assert.strictEqual(list.element(0).gitPath, leftover.path);
		} finally {
			unstageCommand.dispose();
		}
	});

	test('leftover-looks-live pairing-hold Stage with local SCM stays hidden and 0 git.stage', async function () {
		const gitStageCommands: string[] = [];
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: true }),
			onDidChangeConnection: Event.None,
			writeGitStagePaths: async (request: UniverseAgentWriteGitStagePathsRequest) => {
				stageCalls.push(request);
				return acceptedWrite;
			},
		} as unknown as IUniverseAgentConnection;
		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);

		const stageCommand = CommandsRegistry.registerCommand('git.stage', () => { });
		try {
			const scmStub = toResource.call(this, '/project/src/leftover-stage.ts');
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, createIndexScmService(scmStub, 'workingTree'), async (commandId: string) => {
				if (commandId === 'git.stage') {
					gitStageCommands.push(commandId);
				}
			}).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

			const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			assert.ok(list.element(0).scmResource);
			list.setFocus([0]);
			list.setSelection([0]);
			await timeout(20);

			const stage = stageSelectedButton(host);
			assert.ok(stage, 'Stage Selected is the toolbar first button');
			assert.strictEqual(stage.classList.contains('disabled'), true);
			const rowAction = host.querySelector('.sources-change-action') as HTMLElement | null;
			assert.ok(!rowAction || rowAction.style.display === 'none' || rowAction.classList.contains('disabled'));

			forceClick(stage);
			forceClick(rowAction);
			await (widget as unknown as { runOnSelected: (action: 'stage') => Promise<void> }).runOnSelected('stage');
			await timeout(20);
			assert.strictEqual(gitStageCommands.length, 0);
			assert.deepStrictEqual(stageCalls, []);
		} finally {
			stageCommand.dispose();
		}
	});

	test('leftover-looks-live pairing-hold Unstage stays disabled and 0 git.unstage', async function () {
		const gitUnstageCommands: string[] = [];
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: true }),
			onDidChangeConnection: Event.None,
		} as unknown as IUniverseAgentConnection;
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);

		const unstageCommand = CommandsRegistry.registerCommand('git.unstage', () => { });
		try {
			const scmStub = toResource.call(this, '/project/src/leftover-unstage.ts');
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, createIndexScmService(scmStub), async (commandId: string) => {
				if (commandId === 'git.unstage') {
					gitUnstageCommands.push(commandId);
				}
			}).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

			const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			assert.ok(list.element(0).scmResource);
			list.setFocus([0]);
			list.setSelection([0]);
			await timeout(20);

			const unstage = unstageSelectedButton(host);
			assert.ok(unstage, 'Unstage Selected is the toolbar second button');
			assert.strictEqual(unstage.classList.contains('disabled'), true);
			const rowAction = host.querySelector('.sources-change-action') as HTMLElement | null;
			assert.ok(!rowAction || rowAction.style.display === 'none' || rowAction.classList.contains('disabled'));

			forceClick(unstage);
			forceClick(rowAction);
			await (widget as unknown as { runOnSelected: (action: 'unstage') => Promise<void> }).runOnSelected('unstage');
			await timeout(20);
			assert.strictEqual(gitUnstageCommands.length, 0);
		} finally {
			unstageCommand.dispose();
		}
	});

	test('KEEP leftover list-fail closes Stage / Commit while git-read still succeeds and forced click stays 0 unary', async function () {
		const leftover = { path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const commitCalls: UniverseAgentWriteGitCommitRequest[] = [];
		const roster = createRoster('session-1', false);
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [leftover],
			}),
			readGitSummary: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				changeCount: 1,
			}),
			writeGitStagePaths: async (request: UniverseAgentWriteGitStagePathsRequest) => {
				stageCalls.push(request);
				return acceptedWrite;
			},
			writeGitCommit: async (request: UniverseAgentWriteGitCommitRequest) => {
				commitCalls.push(request);
				return acceptedWrite;
			},
		} as unknown as IUniverseAgentConnection;
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, false);
		assert.strictEqual(roster.isEngineSessionReady(), false);

		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection, createEmptyScmService(), undefined, undefined, roster).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, leftover.path);
		assert.strictEqual(widget.isSourcesGitWriteListFailed(), false);
		assert.strictEqual(widget.isSourcesKeepLeftoverWrite(), true);

		list.setFocus([0]);
		list.setSelection([0]);
		const commitInput = host.querySelector('.sources-changes-commit-input') as HTMLInputElement;
		commitInput.value = 'keep leftover';
		commitInput.dispatchEvent(new mainWindow.Event('input', { bubbles: true }));
		await waitForWriteButtonsDisabled(host);

		const stage = stageSelectedButton(host);
		const commit = commitButton(host);
		assert.ok(stage);
		assert.ok(commit);
		assert.strictEqual(stage.classList.contains('disabled'), true);
		assert.strictEqual(commit.classList.contains('disabled'), true);
		const rowAction = host.querySelector('.sources-change-action') as HTMLElement | null;
		assert.ok(!rowAction || rowAction.style.display === 'none' || rowAction.classList.contains('disabled'));

		forceClick(stage);
		forceClick(commit);
		forceClick(rowAction);
		await timeout(20);
		assert.deepStrictEqual(stageCalls, []);
		assert.deepStrictEqual(commitCalls, []);
	});

	test('KEEP leftover list-fail closes Unstage while leftoverListFailed stays false and forced click stays 0 git.unstage', async function () {
		const gitUnstageCommands: string[] = [];
		const roster = createRoster('session-1', false);
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
		} as unknown as IUniverseAgentConnection;
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, false);
		assert.strictEqual(roster.isEngineSessionReady(), false);

		const unstageCommand = CommandsRegistry.registerCommand('git.unstage', () => { });
		try {
			const scmStub = toResource.call(this, '/project/src/leftover-keep-unstage.ts');
			const scmService = createIndexScmService(scmStub);
			const scmResource = [...scmService.repositories][0].provider.groups[0].resources[0];
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, scmService, async (commandId: string) => {
				if (commandId === 'git.unstage') {
					gitUnstageCommands.push(commandId);
				}
			}, undefined, roster).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

			const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			assert.ok(list.element(0).scmResource);
			assert.strictEqual(widget.isSourcesGitWriteListFailed(), false);
			assert.strictEqual(widget.isSourcesKeepLeftoverWrite(), true);
			list.setFocus([0]);
			list.setSelection([0]);
			await timeout(20);

			const unstage = unstageSelectedButton(host);
			assert.ok(unstage, 'Unstage Selected is the toolbar second button');
			assert.strictEqual(unstage.classList.contains('disabled'), true);
			assert.strictEqual(unstage.getAttribute('aria-disabled'), 'true');
			const rowAction = host.querySelector('.sources-change-action') as HTMLElement | null;
			assert.ok(!rowAction || rowAction.style.display === 'none' || rowAction.classList.contains('disabled'));

			forceClick(unstage);
			forceClick(rowAction);
			await (widget as unknown as { runOnSelected: (action: 'unstage') => Promise<void> }).runOnSelected('unstage');
			await (widget as unknown as { runResourceAction: (entry: ISourcesChangeEntry, action: 'unstage') => Promise<void> }).runResourceAction({
				resource: scmStub,
				name: 'leftover-keep-unstage.ts',
				description: 'Staged Changes',
				groupId: 'index',
				scmResource,
			}, 'unstage');
			await timeout(20);
			assert.strictEqual(gitUnstageCommands.length, 0);
		} finally {
			unstageCommand.dispose();
		}
	});

	test('connected leftover without pairing Unstage still runs git.unstage', async function () {
		const gitUnstageCommands: string[] = [];
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
		} as unknown as IUniverseAgentConnection;
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, false);

		const unstageCommand = CommandsRegistry.registerCommand('git.unstage', () => { });
		try {
			const scmStub = toResource.call(this, '/project/src/leftover-live-unstage.ts');
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, createIndexScmService(scmStub), async (commandId: string) => {
				if (commandId === 'git.unstage') {
					gitUnstageCommands.push(commandId);
				}
			}).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

			const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			assert.ok(list.element(0).scmResource);
			list.setFocus([0]);
			list.setSelection([0]);
			await timeout(20);

			const unstage = unstageSelectedButton(host);
			assert.ok(unstage, 'Unstage Selected is the toolbar second button');
			assert.strictEqual(unstage.classList.contains('disabled'), false);

			await (widget as unknown as { runOnSelected: (action: 'unstage') => Promise<void> }).runOnSelected('unstage');
			await timeout(20);
			assert.deepStrictEqual(gitUnstageCommands, ['git.unstage']);
		} finally {
			unstageCommand.dispose();
		}
	});

	test('does not leak unhandled rejection when Stage Selected button click catch-path paint throws and onUnexpectedError warn-then-rethrows', async function () {
		// runOnSelected / tryStagePaths already catch write throw; a lone inner reject does not leak.
		// The Stage Selected button click site still needs `.catch` when the catch-path paint throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
			const leftover = { path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
			const connection = {
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected' as const }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
				onDidChangeConnection: Event.None,
				readGitChanges: async () => ({
					supported: true,
					reason: '',
					branch: 'main',
					entries: [leftover],
				}),
				readGitSummary: async () => ({
					supported: true,
					reason: '',
					branch: 'main',
					changeCount: 1,
				}),
				writeGitStagePaths: async () => {
					throw new Error('boom');
				},
			} as unknown as IUniverseAgentConnection;
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
			const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			list.setFocus([0]);
			list.setSelection([0]);
			await waitForEnabledButton(host, '.sources-changes-toolbar .monaco-button');
			(widget as unknown as { setStatusMessage(message: string | undefined): void }).setStatusMessage = message => {
				if (message) {
					throw paintBoom;
				}
			};
			forceClick(stageSelectedButton(host));
		});
	});

	test('does not leak unhandled rejection when Unstage Selected button click catch-path paint throws and onUnexpectedError warn-then-rethrows', async function () {
		// runOnSelected / runResourceAction already catch git.unstage throw; a lone inner reject does not leak.
		// The Unstage Selected button click site still needs `.catch` when the catch-path paint throws.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		const unstageCommand = CommandsRegistry.registerCommand('git.unstage', () => { });
		try {
			await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
				const connection = {
					isEngineConnected: () => true,
					getConnectionPhase: () => ({ kind: 'connected' as const }),
					getConnectionSnapshot: () => ({ pairingPending: false }),
					onDidChangeConnection: Event.None,
				} as unknown as IUniverseAgentConnection;
				const scmStub = toResource.call(this, '/project/src/leftover-unstage.ts');
				const host = mountHost();
				const widget = store.add(stubChangesListServices(connection, createIndexScmService(scmStub), async () => {
					throw new Error('boom');
				}).createInstance(SourcesChangesList, host));
				(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
				const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
				assert.ok(list.element(0).scmResource);
				list.setFocus([0]);
				list.setSelection([0]);
				await waitForEnabledButton(host, '.sources-changes-toolbar .monaco-button:nth-child(2)');
				(widget as unknown as { setStatusMessage(message: string | undefined): void }).setStatusMessage = message => {
					if (message) {
						throw paintBoom;
					}
				};
				forceClick(unstageSelectedButton(host));
			});
		} finally {
			unstageCommand.dispose();
		}
	});

	test('local git.stage success schedules refresh; failure does not', async function () {
		let refreshCalls = 0;
		const connection = {
			isEngineConnected: () => false,
			getConnectionPhase: () => ({ kind: 'disconnected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
		} as unknown as IUniverseAgentConnection;
		const stageCommand = CommandsRegistry.registerCommand('git.stage', () => { });
		try {
			const scmStub = toResource.call(this, '/project/src/local-stage-refresh.ts');
			const scmService = createIndexScmService(scmStub, 'workingTree');
			const scmResource = [...scmService.repositories][0].provider.groups[0].resources[0];
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, scmService).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

			const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			const widgetWithRefresh = widget as unknown as { scheduleRefresh(): void; runResourceAction(entry: ISourcesChangeEntry, action: 'stage'): Promise<void> };
			const baseScheduleRefresh = widgetWithRefresh.scheduleRefresh.bind(widget);
			widgetWithRefresh.scheduleRefresh = () => {
				refreshCalls += 1;
				baseScheduleRefresh();
			};

			const entry: ISourcesChangeEntry = {
				resource: scmStub,
				name: 'local-stage-refresh.ts',
				description: 'Changes',
				groupId: 'workingTree',
				scmResource,
			};
			refreshCalls = 0;
			await widgetWithRefresh.runResourceAction(entry, 'stage');
			assert.strictEqual(refreshCalls, 1);

			refreshCalls = 0;
			const failingWidget = store.add(stubChangesListServices(connection, scmService, async () => {
				throw new Error('boom');
			}).createInstance(SourcesChangesList, host));
			const failingWithRefresh = failingWidget as unknown as { scheduleRefresh(): void; runResourceAction(entry: ISourcesChangeEntry, action: 'stage'): Promise<void> };
			const failingBaseScheduleRefresh = failingWithRefresh.scheduleRefresh.bind(failingWidget);
			failingWithRefresh.scheduleRefresh = () => {
				refreshCalls += 1;
				failingBaseScheduleRefresh();
			};
			await failingWithRefresh.runResourceAction(entry, 'stage');
			assert.strictEqual(refreshCalls, 0);
			assert.strictEqual(list.length, 1);
		} finally {
			stageCommand.dispose();
		}
	});

	test('local git.unstage success schedules refresh; failure does not', async function () {
		let refreshCalls = 0;
		const connection = {
			isEngineConnected: () => false,
			getConnectionPhase: () => ({ kind: 'disconnected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
		} as unknown as IUniverseAgentConnection;
		const unstageCommand = CommandsRegistry.registerCommand('git.unstage', () => { });
		try {
			const scmStub = toResource.call(this, '/project/src/local-unstage-refresh.ts');
			const scmService = createIndexScmService(scmStub);
			const scmResource = [...scmService.repositories][0].provider.groups[0].resources[0];
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, scmService).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';

			await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			const widgetWithRefresh = widget as unknown as { scheduleRefresh(): void; runResourceAction(entry: ISourcesChangeEntry, action: 'unstage'): Promise<void> };
			const baseScheduleRefresh = widgetWithRefresh.scheduleRefresh.bind(widget);
			widgetWithRefresh.scheduleRefresh = () => {
				refreshCalls += 1;
				baseScheduleRefresh();
			};

			const entry: ISourcesChangeEntry = {
				resource: scmStub,
				name: 'local-unstage-refresh.ts',
				description: 'Staged Changes',
				groupId: 'index',
				scmResource,
			};
			refreshCalls = 0;
			await widgetWithRefresh.runResourceAction(entry, 'unstage');
			assert.strictEqual(refreshCalls, 1);

			refreshCalls = 0;
			const failingWidget = store.add(stubChangesListServices(connection, scmService, async () => {
				throw new Error('boom');
			}).createInstance(SourcesChangesList, host));
			const failingWithRefresh = failingWidget as unknown as { scheduleRefresh(): void; runResourceAction(entry: ISourcesChangeEntry, action: 'unstage'): Promise<void> };
			const failingBaseScheduleRefresh = failingWithRefresh.scheduleRefresh.bind(failingWidget);
			failingWithRefresh.scheduleRefresh = () => {
				refreshCalls += 1;
				failingBaseScheduleRefresh();
			};
			await failingWithRefresh.runResourceAction(entry, 'unstage');
			assert.strictEqual(refreshCalls, 0);
		} finally {
			unstageCommand.dispose();
		}
	});

	test('does not leak unhandled rejection when Commit button click catch-path paint throws and onUnexpectedError warn-then-rethrows', async function () {
		// runCommit() already catches writeGitCommit throw; a lone inner reject does not leak.
		// The Commit button click site still needs `.catch` when the catch-path paint throws.
		// Enter-key leftover is already locked in sourcesReviewList.test.ts; this locks the button.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const paintBoom = new Error('paint boom');
		await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
			const leftover = { path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' };
			const connection = {
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected' as const }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
				onDidChangeConnection: Event.None,
				readGitChanges: async () => ({
					supported: true,
					reason: '',
					branch: 'main',
					entries: [leftover],
				}),
				readGitSummary: async () => ({
					supported: true,
					reason: '',
					branch: 'main',
					changeCount: 1,
				}),
				writeGitCommit: async () => {
					throw new Error('boom');
				},
			} as unknown as IUniverseAgentConnection;
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
			await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			const input = host.querySelector('.sources-changes-commit-input') as HTMLInputElement;
			assert.ok(input);
			input.value = 'fix';
			input.dispatchEvent(new mainWindow.Event('input', { bubbles: true }));
			await waitForEnabledButton(host, '.sources-changes-commit .monaco-button');
			(widget as unknown as { setStatusMessage(message: string | undefined): void }).setStatusMessage = message => {
				if (message) {
					throw paintBoom;
				}
			};
			forceClick(commitButton(host));
		});
	});

	test("renders group header with title and count on first row of group, subsequent rows do not show header", async function () {
		const leftover1 = { path: "src/a.ts", oldPath: "", kind: "MODIFIED", indexState: "WORKTREE" };
		const leftover2 = { path: "src/b.ts", oldPath: "", kind: "MODIFIED", indexState: "WORKTREE" };
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: "connected" as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitChanges: async () => ({
				supported: true,
				reason: "",
				branch: "main",
				entries: [leftover1, leftover2],
			}),
			readGitSummary: async () => ({
				supported: true,
				reason: "",
				branch: "main",
				changeCount: 2,
			}),
		} as unknown as IUniverseAgentConnection;

		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection).createInstance(SourcesChangesList, host));
		(host.querySelector(".sources-changes-list") as HTMLElement).style.height = "120px";
		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.length, 2);

		const rows = host.querySelectorAll(".sources-changes-list .monaco-list-row");
		assert.strictEqual(rows.length, 2);

		// First row is group start
		assert.ok(rows[0].classList.contains("is-group-start"));
		const group0 = rows[0].querySelector(".sources-change-group");
		assert.ok(group0);
		assert.strictEqual(rows[0].querySelector(".sources-change-group-title")?.textContent, "Unstaged Changes");
		assert.strictEqual(rows[0].querySelector(".sources-change-group-count")?.textContent, "2");
		assert.ok(rows[0].querySelector(".sources-change-file"));

		// Second row in same group is NOT group start
		assert.ok(!rows[1].classList.contains("is-group-start"));
		assert.ok(rows[1].querySelector(".sources-change-file"));
	});

	function acceptedEngineWrite(): UniverseAgentWriteGitWriteResult {
		return { supported: true, reason: '', success: true, errorMessage: '', exitCode: 0, stdout: '' };
	}

	test('engine stage uses gitPath and the entry session when the active session still matches', async function () {
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const gitCommands: string[] = [];
		const root = URI.file('/work/repo');
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
			readGitSummary: async () => ({ supported: true, reason: '', branch: 'main', changeCount: 1 }),
			writeGitStagePaths: async (request: UniverseAgentWriteGitStagePathsRequest) => {
				stageCalls.push(request);
				return acceptedEngineWrite();
			},
		} as unknown as IUniverseAgentConnection;
		const stageCommand = CommandsRegistry.registerCommand('git.stage', () => { });
		try {
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, createIndexScmService(root, 'workingTree', false, { rootUri: root }), async (commandId: string) => {
				gitCommands.push(commandId);
			}).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
			const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			const entry = list.element(0);
			assert.notStrictEqual(entry.resource.fsPath, 'src/a.ts');
			selectFirstChange(list);
			await timeout(20);
			assertStageChrome(host, true);
			await (widget as unknown as { runResourceAction(entry: ISourcesChangeEntry, action: 'stage'): Promise<void> }).runResourceAction(entry, 'stage');
			assert.strictEqual(stageCalls.length, 1);
			assert.strictEqual(stageCalls[0]?.sessionId, 'session-1');
			assert.deepStrictEqual(stageCalls[0]?.commands?.[0]?.argv, ['src/a.ts']);
			assert.deepStrictEqual(gitCommands, []);
		} finally {
			stageCommand.dispose();
		}
	});

	test('engine stage refuses when the active session changed and does not git.stage', async function () {
		let active = 'session-old';
		const onDidChangeActiveSession = store.add(new Emitter<string>());
		const roster = {
			getActiveSessionId: () => active,
			onDidChangeActiveSession: onDidChangeActiveSession.event,
			onDidChangeSession: Event.None,
			isEngineSessionReady: () => true,
		} as unknown as IConversationRosterService;
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const gitCommands: string[] = [];
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
			readGitSummary: async () => ({ supported: true, reason: '', branch: 'main', changeCount: 1 }),
			writeGitStagePaths: async (request: UniverseAgentWriteGitStagePathsRequest) => {
				stageCalls.push(request);
				return acceptedEngineWrite();
			},
		} as unknown as IUniverseAgentConnection;
		const stageCommand = CommandsRegistry.registerCommand('git.stage', () => { });
		try {
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, createEmptyScmService(), async (commandId: string) => {
				gitCommands.push(commandId);
			}, undefined, roster).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
			const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			const entry = list.element(0);
			assert.strictEqual(entry.sessionId, 'session-old');
			selectFirstChange(list);
			await timeout(20);
			assertStageChrome(host, true);
			active = 'session-new';
			onDidChangeActiveSession.fire(active);
			assert.strictEqual(list.element(0).sessionId, 'session-old');
			assertStageChrome(host, false);
			forceClick(stageSelectedButton(host));
			forceClick(host.querySelector('.sources-change-action'));
			forceClick(host.querySelector('.sources-change-group-action'));
			await (widget as unknown as { runResourceAction(entry: ISourcesChangeEntry, action: 'stage'): Promise<void> }).runResourceAction(entry, 'stage');
			assert.strictEqual(stageCalls.length, 0);
			assert.deepStrictEqual(gitCommands, []);
			assert.strictEqual(readChangesNotice(host), sourcesGitSessionChangedMessage());
		} finally {
			stageCommand.dispose();
		}
	});

	test('engine stage with an empty gitPath does not send and does not substitute fsPath', async function () {
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const gitCommands: string[] = [];
		const root = URI.file('/work/repo');
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: '', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
			readGitSummary: async () => ({ supported: true, reason: '', branch: 'main', changeCount: 1 }),
			writeGitStagePaths: async (request: UniverseAgentWriteGitStagePathsRequest) => {
				stageCalls.push(request);
				return acceptedEngineWrite();
			},
		} as unknown as IUniverseAgentConnection;
		const stageCommand = CommandsRegistry.registerCommand('git.stage', () => { });
		try {
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, createIndexScmService(root, 'workingTree', false, { rootUri: root }), async (commandId: string) => {
				gitCommands.push(commandId);
			}).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
			const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			const entry = list.element(0);
			assert.strictEqual(entry.gitPath, '');
			assert.notStrictEqual(entry.resource.fsPath, '');
			selectFirstChange(list);
			await timeout(20);
			assertStageChrome(host, false);
			forceClick(stageSelectedButton(host));
			forceClick(host.querySelector('.sources-change-action'));
			forceClick(host.querySelector('.sources-change-group-action'));
			await (widget as unknown as { runResourceAction(entry: ISourcesChangeEntry, action: 'stage'): Promise<void> }).runResourceAction(entry, 'stage');
			assert.strictEqual(stageCalls.length, 0);
			assert.deepStrictEqual(gitCommands, []);
			assert.strictEqual(readChangesNotice(host), sourcesGitEmptyStagePathMessage());
		} finally {
			stageCommand.dispose();
		}
	});

	test('engine unstage is only git.unstage and sends nothing without scmResource', async function () {
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const gitCommands: string[] = [];
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'INDEX' }],
			}),
			readGitSummary: async () => ({ supported: true, reason: '', branch: 'main', changeCount: 1 }),
			writeGitStagePaths: async (request: UniverseAgentWriteGitStagePathsRequest) => {
				stageCalls.push(request);
				return acceptedEngineWrite();
			},
		} as unknown as IUniverseAgentConnection;
		const unstageCommand = CommandsRegistry.registerCommand('git.unstage', () => { });
		try {
			const scmStub = toResource.call(this, '/work/repo/src/a.ts');
			const scmService = createIndexScmService(scmStub);
			const scmResource = [...scmService.repositories][0].provider.groups[0].resources[0];
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, scmService, async (commandId: string) => {
				gitCommands.push(commandId);
			}).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
			const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			const entry = list.element(0);
			assert.strictEqual(entry.origin, 'engine');
			assert.strictEqual(entry.scmResource, undefined);
			const run = (widget as unknown as { runResourceAction(entry: ISourcesChangeEntry, action: 'unstage'): Promise<void> }).runResourceAction.bind(widget);
			await run(entry, 'unstage');
			assert.strictEqual(stageCalls.length, 0);
			assert.deepStrictEqual(gitCommands, []);

			await run({ ...entry, scmResource }, 'unstage');
			assert.strictEqual(stageCalls.length, 0);
			assert.deepStrictEqual(gitCommands, ['git.unstage']);
		} finally {
			unstageCommand.dispose();
		}
	});

	test('empty engine list stages and commits the SCM row locally', async function () {
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const commitCalls: UniverseAgentWriteGitCommitRequest[] = [];
		const gitCommands: string[] = [];
		const scmStub = toResource.call(this, '/project/src/local.ts');
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitChanges: async () => ({ supported: true, reason: '', branch: 'main', entries: [] }),
			readGitSummary: async () => ({ supported: true, reason: '', branch: 'main', changeCount: 0 }),
			writeGitStagePaths: async (request: UniverseAgentWriteGitStagePathsRequest) => {
				stageCalls.push(request);
				return acceptedEngineWrite();
			},
			writeGitCommit: async (request: UniverseAgentWriteGitCommitRequest) => {
				commitCalls.push(request);
				return acceptedEngineWrite();
			},
		} as unknown as IUniverseAgentConnection;
		const stageCommand = CommandsRegistry.registerCommand('git.stage', () => { });
		const acceptCommand = CommandsRegistry.registerCommand('scm.acceptInput', () => { });
		const commitCommand = CommandsRegistry.registerCommand('git.commit', () => { });
		try {
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, createIndexScmService(scmStub, 'workingTree', true, {
				acceptInputCommand: { id: 'scm.acceptInput' },
				stagedResource: scmStub,
			}), async (commandId: string) => {
				gitCommands.push(commandId);
			}).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
			const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			const entry = list.element(0);
			assert.strictEqual(entry.origin, 'scm');
			selectFirstChange(list);
			await timeout(20);
			assertStageChrome(host, true);
			await (widget as unknown as { runResourceAction(entry: ISourcesChangeEntry, action: 'stage'): Promise<void> }).runResourceAction(entry, 'stage');
			assert.strictEqual(stageCalls.length, 0);
			assert.deepStrictEqual(gitCommands, ['git.stage']);

			(host.querySelector('.sources-changes-commit-input') as HTMLTextAreaElement).value = 'fix';
			await (widget as unknown as { runCommit(): Promise<void> }).runCommit();
			assert.strictEqual(commitCalls.length, 0);
			assert.deepStrictEqual(gitCommands, ['git.stage', 'scm.acceptInput']);
		} finally {
			stageCommand.dispose();
			acceptCommand.dispose();
			commitCommand.dispose();
		}
	});

	test('engine-live commit does not fall back to acceptInputCommand when the engine does not accept', async function () {
		const cases: UniverseAgentWriteGitWriteResult[] = [
			{ supported: true, reason: '', success: false, errorMessage: 'rejected', exitCode: 1, stdout: '' },
			{ supported: false, reason: 'unsupported', success: false, errorMessage: '', exitCode: 0, stdout: '' },
		];
		for (const written of cases) {
			const commitCalls: UniverseAgentWriteGitCommitRequest[] = [];
			const gitCommands: string[] = [];
			const connection = {
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected' as const }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
				onDidChangeConnection: Event.None,
				readGitChanges: async () => ({
					supported: true,
					reason: '',
					branch: 'main',
					entries: [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
				}),
				readGitSummary: async () => ({ supported: true, reason: '', branch: 'main', changeCount: 1 }),
				writeGitCommit: async (request: UniverseAgentWriteGitCommitRequest) => {
					commitCalls.push(request);
					return written;
				},
			} as unknown as IUniverseAgentConnection;
			const acceptCommand = CommandsRegistry.registerCommand('scm.acceptInput', () => { });
			const commitCommand = CommandsRegistry.registerCommand('git.commit', () => { });
			try {
				const scmStub = toResource.call(this, '/project/src/commit.ts');
				const host = mountHost();
				const widget = store.add(stubChangesListServices(connection, createIndexScmService(scmStub, 'workingTree', true, {
					acceptInputCommand: { id: 'scm.acceptInput' },
				}), async (commandId: string) => {
					gitCommands.push(commandId);
				}).createInstance(SourcesChangesList, host));
				(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
				await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
				(host.querySelector('.sources-changes-commit-input') as HTMLTextAreaElement).value = 'fix';
				await (widget as unknown as { runCommit(): Promise<void> }).runCommit();
				assert.strictEqual(commitCalls.length, 1);
				assert.strictEqual(commitCalls[0]?.sessionId, 'session-1');
				assert.deepStrictEqual(gitCommands, []);
				const status = readChangesNotice(host);
				if (written.supported) {
					assert.ok(status.includes('Unable to commit'));
					assert.ok(status.includes('rejected'));
				} else {
					assert.strictEqual(status, localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
				}
			} finally {
				acceptCommand.dispose();
				commitCommand.dispose();
			}
		}
	});

	test('no-hook commit is blocked after the active session changes', async function () {
		let active = 'session-old';
		const roster = {
			getActiveSessionId: () => active,
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: Event.None,
			isEngineSessionReady: () => true,
		} as unknown as IConversationRosterService;
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const commitCalls: UniverseAgentWriteGitCommitRequest[] = [];
		const gitCommands: string[] = [];
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: onDidChangeConnection.event,
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: 'src/leftover.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
			readGitSummary: async () => ({ supported: true, reason: '', branch: 'main', changeCount: 1 }),
			writeGitCommit: async (request: UniverseAgentWriteGitCommitRequest) => {
				commitCalls.push(request);
				return acceptedEngineWrite();
			},
		} as unknown as IUniverseAgentConnection;
		const acceptCommand = CommandsRegistry.registerCommand('scm.acceptInput', () => { });
		const commitCommand = CommandsRegistry.registerCommand('git.commit', () => { });
		try {
			const scmStub = toResource.call(this, '/project/src/scm-stub.ts');
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, createIndexScmService(scmStub, 'workingTree', true, {
				acceptInputCommand: { id: 'scm.acceptInput' },
			}), async (commandId: string) => {
				gitCommands.push(commandId);
			}, undefined, roster).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
			const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			assert.strictEqual(list.element(0).sessionId, 'session-old');
			delete (connection as { readGitChanges?: unknown }).readGitChanges;
			onDidChangeConnection.fire({} as UniverseAgentConnectionSnapshot);
			await waitForStatusText(host, 'unavailable');
			active = 'session-new';
			(host.querySelector('.sources-changes-commit-input') as HTMLTextAreaElement).value = 'fix';
			await (widget as unknown as { runCommit(): Promise<void> }).runCommit();
			assert.strictEqual(commitCalls.length, 0);
			assert.deepStrictEqual(gitCommands, []);
			assert.strictEqual(readChangesNotice(host), sourcesGitSessionChangedMessage());
		} finally {
			acceptCommand.dispose();
			commitCommand.dispose();
		}
	});

	test('an accepted commit from the previous session does not clear the new status line', async function () {
		let active = 'session-old';
		let releaseCommit: (() => void) | undefined;
		const roster = {
			getActiveSessionId: () => active,
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: Event.None,
			isEngineSessionReady: () => true,
		} as unknown as IConversationRosterService;
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			onDidChangeConnection: Event.None,
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: 'src/inflight.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
			readGitSummary: async () => ({ supported: true, reason: '', branch: 'main', changeCount: 1 }),
			writeGitCommit: async () => new Promise(resolve => {
				releaseCommit = () => resolve(acceptedEngineWrite());
			}),
		} as unknown as IUniverseAgentConnection;
		const acceptCommand = CommandsRegistry.registerCommand('scm.acceptInput', () => { });
		const commitCommand = CommandsRegistry.registerCommand('git.commit', () => { });
		try {
			const scmStub = toResource.call(this, '/project/src/inflight.ts');
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, createIndexScmService(scmStub, 'workingTree', true, {
				acceptInputCommand: { id: 'scm.acceptInput' },
			}), async () => { }, undefined, roster).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
			await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			(host.querySelector('.sources-changes-commit-input') as HTMLTextAreaElement).value = 'fix';
			const commit = (widget as unknown as { runCommit(): Promise<void> }).runCommit();
			const deadline = Date.now() + 2000;
			while (Date.now() < deadline && !releaseCommit) {
				await timeout(20);
			}
			assert.ok(releaseCommit);
			active = 'session-new';
			(widget as unknown as { setWriteStatusMessage(message: string | undefined): void }).setWriteStatusMessage('status-for-new-session');
			const statusBefore = readChangesNotice(host);
			assert.strictEqual(statusBefore, 'status-for-new-session');
			releaseCommit!();
			await commit;
			assert.strictEqual(readChangesNotice(host), statusBefore);
		} finally {
			acceptCommand.dispose();
			commitCommand.dispose();
		}
	});

	function createRepo(options: {
		rootUri?: URI;
		label?: string;
		acceptInputCommand?: { id: string; arguments?: readonly unknown[] };
		groups: ReadonlyArray<{ id: string; label: string; resource?: URI }>;
	}) {
		const groups = options.groups.map(spec => {
			const group = {
				id: spec.id,
				label: spec.label,
				resources: [] as ISCMResource[],
			};
			if (spec.resource) {
				group.resources.push({
					sourceUri: spec.resource,
					resourceGroup: group,
					decorations: {},
					open: async () => { },
				} as unknown as ISCMResource);
			}
			return group;
		});
		return {
			provider: {
				groups,
				rootUri: options.rootUri,
				label: options.label,
				acceptInputCommand: options.acceptInputCommand,
				onDidChangeResources: Event.None,
				onDidChangeResourceGroups: Event.None,
				inputBoxTextModel: { setValue: () => { } },
			},
			input: {
				value: '',
				setValue: () => { },
				onDidChange: Event.None,
			},
		};
	}

	function createScmService(repositories: readonly object[]): ISCMService {
		return {
			_serviceBrand: undefined,
			get repositories() { return repositories; },
			get repositoryCount() { return repositories.length; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService;
	}

	function commitMessage(host: HTMLElement, value: string): void {
		const input = host.querySelector('.sources-changes-commit-input') as HTMLTextAreaElement;
		input.value = value;
		input.dispatchEvent(new mainWindow.Event('input', { bubbles: true }));
	}

	test('engine commit does not write the message into SCM inputs when two repositories exist', async function () {
		const commitCalls: UniverseAgentWriteGitCommitRequest[] = [];
		const repoA = URI.file('/repo-a');
		const repoB = URI.file('/repo-b');
		const trackedA = { input: '', box: '' };
		const trackedB = { input: '', box: '' };
		const trackedRepo = (rootUri: URI, label: string, resource: URI, tracked: { input: string; box: string }) => {
			const base = createRepo({
				rootUri,
				label,
				acceptInputCommand: { id: 'scm.acceptInput', arguments: [label] },
				groups: [{ id: 'workingTree', label: 'Changes', resource }],
			});
			return {
				...base,
				input: {
					value: '',
					setValue: (value: string) => { tracked.input = value; },
					onDidChange: Event.None,
				},
				provider: {
					...base.provider,
					inputBoxTextModel: { setValue: (value: string) => { tracked.box = value; } },
				},
			};
		};
		const scm = createScmService([
			trackedRepo(repoA, 'repo-a', URI.joinPath(repoA, 'src/a.ts'), trackedA),
			trackedRepo(repoB, 'repo-b', URI.joinPath(repoB, 'src/b.ts'), trackedB),
		]);
		const connection = {
			...createGitReadConnection({
				readGitChanges: async () => ({
					supported: true,
					reason: '',
					branch: 'main',
					entries: [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
				}),
			}),
			writeGitCommit: async (request: UniverseAgentWriteGitCommitRequest) => {
				commitCalls.push(request);
				return acceptedEngineWrite();
			},
		} as unknown as IUniverseAgentConnection;
		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection, scm).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.element(0).origin, 'engine');
		commitMessage(host, 'engine-only');
		await (widget as unknown as { runCommit(): Promise<void> }).runCommit();
		assert.strictEqual(commitCalls.length, 1);
		assert.strictEqual(commitCalls[0]?.message, 'engine-only');
		assert.strictEqual(trackedA.input, '');
		assert.strictEqual(trackedB.input, '');
		assert.strictEqual(trackedA.box, '');
		assert.strictEqual(trackedB.box, '');
	});

	test('commit uses the only repository that already has staged changes', async function () {
		const gitCommands: unknown[][] = [];
		const repoA = URI.file('/repo-a');
		const repoB = URI.file('/repo-b');
		const connection = {
			isEngineConnected: () => false,
			onDidChangeConnection: Event.None,
		} as unknown as IUniverseAgentConnection;
		const acceptCommand = CommandsRegistry.registerCommand('scm.acceptInput', () => { });
		const commitCommand = CommandsRegistry.registerCommand('git.commit', () => { });
		try {
			const scm = createScmService([
				createRepo({
					rootUri: repoA,
					label: 'repo-a',
					acceptInputCommand: { id: 'scm.acceptInput', arguments: ['repo-a'] },
					groups: [{ id: 'workingTree', label: 'Changes', resource: URI.joinPath(repoA, 'src/a.ts') }],
				}),
				createRepo({
					rootUri: repoB,
					label: 'repo-b',
					acceptInputCommand: { id: 'scm.acceptInput', arguments: ['repo-b'] },
					groups: [{ id: 'index', label: 'Staged Changes', resource: URI.joinPath(repoB, 'src/b.ts') }],
				}),
			]);
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, scm, async (commandId: string, ...args: unknown[]) => {
				gitCommands.push([commandId, ...args]);
			}).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
			await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			commitMessage(host, 'fix');
			const button = commitButton(host);
			assert.ok(button?.textContent?.includes('repo-b'));
			assert.ok(!button?.classList.contains('disabled'));
			await (widget as unknown as { runCommit(): Promise<void> }).runCommit();
			assert.deepStrictEqual(gitCommands, [['scm.acceptInput', 'repo-b']]);
		} finally {
			acceptCommand.dispose();
			commitCommand.dispose();
		}
	});

	test('commit stays disabled when no repository or more than one has staged changes', async function () {
		const gitCommands: string[] = [];
		const connection = {
			isEngineConnected: () => false,
			onDidChangeConnection: Event.None,
		} as unknown as IUniverseAgentConnection;
		const acceptCommand = CommandsRegistry.registerCommand('scm.acceptInput', () => { });
		const commitCommand = CommandsRegistry.registerCommand('git.commit', () => { });
		try {
			const workingOnly = createScmService([
				createRepo({
					rootUri: URI.file('/repo-a'),
					label: 'repo-a',
					acceptInputCommand: { id: 'scm.acceptInput', arguments: ['repo-a'] },
					groups: [{ id: 'workingTree', label: 'Changes', resource: URI.file('/repo-a/src/a.ts') }],
				}),
			]);
			const host = mountHost();
			const widget = store.add(stubChangesListServices(connection, workingOnly, async (commandId: string) => {
				gitCommands.push(commandId);
			}).createInstance(SourcesChangesList, host));
			(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
			await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			commitMessage(host, 'fix');
			assert.ok(commitButton(host)?.classList.contains('disabled'));
			await (widget as unknown as { runCommit(): Promise<void> }).runCommit();
			assert.strictEqual(gitCommands.length, 0);

			const bothStaged = createScmService([
				createRepo({
					rootUri: URI.file('/repo-a'),
					label: 'repo-a',
					acceptInputCommand: { id: 'scm.acceptInput', arguments: ['repo-a'] },
					groups: [{ id: 'index', label: 'Staged Changes', resource: URI.file('/repo-a/src/a.ts') }],
				}),
				createRepo({
					rootUri: URI.file('/repo-b'),
					label: 'repo-b',
					acceptInputCommand: { id: 'scm.acceptInput', arguments: ['repo-b'] },
					groups: [{ id: 'index', label: 'Staged Changes', resource: URI.file('/repo-b/src/b.ts') }],
				}),
			]);
			const hostBoth = mountHost();
			const widgetBoth = store.add(stubChangesListServices(connection, bothStaged, async (commandId: string) => {
				gitCommands.push(commandId);
			}).createInstance(SourcesChangesList, hostBoth));
			(hostBoth.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
			await waitForList(widgetBoth as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
			commitMessage(hostBoth, 'fix');
			assert.ok(commitButton(hostBoth)?.classList.contains('disabled'));
			assert.strictEqual(commitButton(hostBoth)?.textContent, 'Commit');
			await (widgetBoth as unknown as { runCommit(): Promise<void> }).runCommit();
			assert.deepStrictEqual(gitCommands, []);
		} finally {
			acceptCommand.dispose();
			commitCommand.dispose();
		}
	});

	test('engine paths join the workDir repository and drop paths outside that root', async function () {
		const repoA = URI.file('/repo-a');
		const repoB = URI.file('/repo-b');
		const connection = createGitReadConnection({
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [
					{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' },
					{ path: '../outside.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' },
				],
			}),
		});
		const scm = createScmService([
			createRepo({ rootUri: repoA, label: 'repo-a', groups: [{ id: 'workingTree', label: 'Changes' }] }),
			createRepo({ rootUri: repoB, label: 'repo-b', groups: [{ id: 'workingTree', label: 'Changes' }] }),
		]);
		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection, scm, undefined, undefined, createRoster(), '/repo-b').createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, 'src/a.ts');
		assert.strictEqual(list.element(0).resource.fsPath, URI.joinPath(repoB, 'src/a.ts').fsPath);
		assert.strictEqual(commitButton(host)?.textContent, 'Commit');
	});

	test('engine row resolves repository root from connection workRoot fallback when session has no workDir', async function () {
		const repoA = URI.file('/repo-a');
		const repoB = URI.file('/repo-b');
		const connection = createGitReadConnection({
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
		});
		const scm = createScmService([
			createRepo({ rootUri: repoA, label: 'repo-a', groups: [{ id: 'workingTree', label: 'Changes' }] }),
			createRepo({ rootUri: repoB, label: 'repo-b', groups: [{ id: 'workingTree', label: 'Changes' }] }),
		]);
		const host = mountHost();
		const workRoot: IAgentWorkRoot = {
			sessionId: 'sess-fallback',
			engineIdentityId: 'engine-1',
			workDir: '/repo-b',
			source: 'connection',
			access: 'local',
			localRoot: repoB,
			projectKey: 'engine-1\n/repo-b',
		};
		const widget = store.add(stubChangesListServices(connection, scm, undefined, undefined, createRoster('sess-fallback'), undefined, workRoot).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).gitPath, 'src/a.ts');
		assert.strictEqual(list.element(0).resource.fsPath, URI.joinPath(repoB, 'src/a.ts').fsPath);
	});

	test('engine row whose workDir matches no root is listed and does not open a file', async function () {
		let openCalls = 0;
		const connection = createGitReadConnection({
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
		});
		const scm = createScmService([
			createRepo({ rootUri: URI.file('/repo-a'), label: 'repo-a', groups: [{ id: 'workingTree', label: 'Changes' }] }),
			createRepo({ rootUri: URI.file('/repo-b'), label: 'repo-b', groups: [{ id: 'workingTree', label: 'Changes' }] }),
		]);
		const host = mountHost();
		const widget = store.add(stubChangesListServices(connection, scm, undefined, async () => {
			openCalls += 1;
		}, createRoster(), '/not-a-repo').createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.length, 1);
		assert.strictEqual(list.element(0).resource.scheme, SOURCES_GIT_UNROOTED_SCHEME);
		assert.strictEqual(list.element(0).gitPath, 'src/a.ts');
		await openFirstListRow(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		const status = await waitForStatusText(host, 'unavailable');
		assert.ok(status.includes(sourcesGitReadUnavailableNoHookMessage()));
		assert.ok(!status.includes(SOURCES_GIT_UNROOTED_SCHEME));
		assert.strictEqual(openCalls, 0);
	});

	test('engine-root row can open a diff; unsupported diff stays unopenable', async function () {
		const repoA = URI.file('/repo-a');
		const repoB = URI.file('/repo-b');
		const workRoot: IAgentWorkRoot = {
			sessionId: 'session-1',
			engineIdentityId: 'eng',
			workDir: '/remote/project',
			source: 'session',
			access: 'engine',
			localRoot: undefined,
			projectKey: 'eng\n/remote/project',
		};
		const scm = createScmService([
			createRepo({ rootUri: repoA, label: 'repo-a', groups: [{ id: 'workingTree', label: 'Changes' }] }),
			createRepo({ rootUri: repoB, label: 'repo-b', groups: [{ id: 'workingTree', label: 'Changes' }] }),
		]);
		const unifiedDiff = '@@ -1 +1 @@\n-old\n+new\n';
		sourcesGitDiffContentStore.resetForTests();

		const opened: { original?: string; modified?: string; resource?: string }[] = [];
		const supported = createGitReadConnection({
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
			readGitFileDiff: async () => ({
				supported: true,
				reason: '',
				path: 'src/a.ts',
				unifiedDiff,
			}),
		});
		const host = mountHost();
		const widget = store.add(stubChangesListServices(supported, scm, undefined, async (raw: unknown) => {
			const input = raw as { original?: { resource?: URI }; modified?: { resource?: URI }; resource?: URI };
			opened.push({
				original: input?.original?.resource?.toString(),
				modified: input?.modified?.resource?.toString(),
				resource: input?.resource?.toString(),
			});
			return undefined;
		}, createRoster(), repoA.fsPath, workRoot).createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
		const list = await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		assert.strictEqual(list.element(0).resource.scheme, SOURCES_GIT_UNROOTED_SCHEME);
		assert.strictEqual(list.element(0).gitPath, 'src/a.ts');
		await openFirstListRow(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		const deadline = Date.now() + 2000;
		while (Date.now() < deadline && opened.length === 0) {
			await timeout(20);
		}
		assert.strictEqual(opened.length, 1);
		assert.ok(opened[0]?.original?.startsWith('sources-git-diff:'));
		assert.ok(opened[0]?.modified?.startsWith('sources-git-diff:'));
		assert.ok(!opened[0]?.original?.startsWith(`${SOURCES_GIT_UNROOTED_SCHEME}:`));
		assert.ok(!opened[0]?.modified?.startsWith(`${SOURCES_GIT_UNROOTED_SCHEME}:`));
		assert.strictEqual(sourcesGitDiffContentStore.get(sourcesGitDiffModelUri('original', 'src/a.ts', 'WORKTREE', list.element(0).sessionId ?? ''))?.text, 'old\n');
		assert.strictEqual(sourcesGitDiffContentStore.get(sourcesGitDiffModelUri('modified', 'src/a.ts', 'WORKTREE', list.element(0).sessionId ?? ''))?.text, 'new\n');

		const unsupportedOpened: string[] = [];
		const unsupported = createGitReadConnection({
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
			readGitFileDiff: async () => ({
				supported: false,
				reason: 'Git file diff is not supported',
				path: '',
				unifiedDiff,
			}),
		});
		const unsupportedHost = mountHost();
		const unsupportedWidget = store.add(stubChangesListServices(unsupported, scm, undefined, async (raw: unknown) => {
			const input = raw as { resource?: URI; original?: { resource?: URI }; modified?: { resource?: URI } };
			unsupportedOpened.push(input?.resource?.toString() ?? input?.modified?.resource?.toString() ?? '');
			return undefined;
		}, createRoster(), repoA.fsPath, workRoot).createInstance(SourcesChangesList, unsupportedHost));
		(unsupportedHost.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
		await waitForList(unsupportedWidget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		await openFirstListRow(unsupportedWidget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });
		const status = await waitForStatusText(unsupportedHost, 'Git file diff is not supported');
		assert.ok(status.includes(sourcesGitDiffOpenFailureMessage(new Error('Git file diff is not supported'))));
		assert.strictEqual(unsupportedOpened.length, 0);
		assert.ok(!status.includes(`${SOURCES_GIT_UNROOTED_SCHEME}:`));
	});

	test('settled non-SCM repaint keeps a typed commit message', async function () {
		const connection = createGitReadConnection({
			readGitChanges: async () => ({
				supported: true,
				reason: '',
				branch: 'main',
				entries: [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
			}),
		});
		const host = mountHost();
		const instantiationService = stubChangesListServices(connection);
		const widget = store.add(instantiationService.createInstance(SourcesChangesList, host));
		(host.querySelector('.sources-changes-list') as HTMLElement).style.height = '120px';
		await waitForList(widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> });

		const model = instantiationService.invokeFunction(accessor => accessor.get(ISourcesChangesModel));
		const before = model.getSnapshot();
		assert.strictEqual(before.settled, true);
		assert.strictEqual(before.state.kind, 'engine-live');

		commitMessage(host, 'keep typed message');
		const input = host.querySelector('.sources-changes-commit-input') as HTMLTextAreaElement;
		assert.strictEqual(input.value, 'keep typed message');

		await model.refresh();
		const after = model.getSnapshot();
		assert.strictEqual(after.settled, true);
		assert.notStrictEqual(after.state.kind, 'scm');
		assert.ok(after.generation > before.generation);
		assert.strictEqual(input.value, 'keep typed message');
	});
});
