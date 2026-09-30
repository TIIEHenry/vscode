/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { EditorOpenSource, IResourceEditorInput } from '../../../../../platform/editor/common/editor.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { getSelectionKeyboardEvent, WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentConnectionSnapshot,
	UniverseAgentWriteGitCommitRequest,
	UniverseAgentWriteGitStagePathsRequest,
	UniverseAgentWriteGitWriteResult,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { isConversationPairingHold } from '../../../conversation/browser/conversationSessionStatus.js';
import { IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';
import { ISCMResource, ISCMService } from '../../../scm/common/scm.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { ACTIVE_GROUP, IEditorService } from '../../../../services/editor/common/editorService.js';
import { IEditorGroupsService, preferredSideBySideGroupDirection } from '../../../../services/editor/common/editorGroupsService.js';
import { ConversationChatInput, getConversationChatResource, getDefaultConversationChatResource } from '../../../conversation/common/conversationChatInput.js';
import { createSourcesConversationOpenHarness } from './sourcesConversationOpenHarness.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import { SourcesChangesList } from '../../browser/sourcesChangesList.js';
import { conversationDiffComparisonLoadFailedMessage } from '../../browser/conversationDiffReviewPane.js';
import { openSourcesChangeEntry, openSourcesChangeInConversation, ISourcesChangeEntryOpenDeps, sourcesConversationLeafMissingMessage } from '../../browser/sourcesChangeEntryOpen.js';
import { SOURCES_GIT_UNROOTED_SCHEME, sourcesGitChangeOutsideRootMessage, sourcesGitDiffOpenFailureMessage, sourcesGitEmptyFileDiffMessage, sourcesGitLocalOnlyMessage, sourcesGitReadFailureMessage, sourcesGitReadPairingHoldMessage, sourcesGitReadUnavailableNoHookMessage } from '../../common/sourcesChangesGitRead.js';
import { sourcesGitCommitNotAcceptedMessage, sourcesGitEmptyStagePathMessage, sourcesGitSessionChangedMessage } from '../../common/sourcesChangesGitWrite.js';
import { ConversationDiffReviewInput } from '../../browser/conversationDiffReviewInput.js';
import { ISourcesChangeEntry, ISourcesChangesModel } from '../../common/sourcesChangesModel.js';
import { SourcesChangesModel } from '../../common/sourcesChangesReadModel.js';
import { ISourcesDiffPanelService } from '../../common/sourcesDiffPanelService.js';

suite('Sources - Changes list open', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

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

	function createSessionContext(connection: IUniverseAgentConnection, roster: IConversationRosterService, workDir?: string): IAgentSessionContext {
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
	) {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		instantiationService.stub(ISCMService, scmService);
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IAgentSessionContext, createSessionContext(connection, roster, workDir));
		instantiationService.stub(ISourcesChangesModel, store.add(instantiationService.createInstance(SourcesChangesModel)));
		instantiationService.stub(IQuickDiffService, {
			getQuickDiffs: async () => [],
		} as unknown as IQuickDiffService);
		if (openEditor) {
			instantiationService.stub(IEditorService, {
				openEditor,
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

		const status = await waitForStatusText(host, 'Unable to read git changes');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.strictEqual((widget as unknown as { list?: WorkbenchList<ISourcesChangeEntry> }).list?.length ?? 0, 0);
		assert.ok(!host.querySelector('.sources-changes-list .monaco-list-row'));
		assert.ok(!(host.querySelector('.sources-changes-empty')?.textContent ?? '').includes('No changes.'));
		assert.ok((host.querySelector('.sources-changes-empty')?.textContent ?? '').includes('Unable to read git changes'));
		assert.ok(host.querySelector('.sources-changes-status')?.classList.contains('is-error'));
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

		const status = await waitForStatusText(host, 'Unable to read git changes');
		assert.strictEqual(status, sourcesGitReadFailureMessage('boom'));
		assert.ok(host.querySelector('.sources-changes-status')?.classList.contains('is-error'));
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
		const roster = {
			getActiveSessionId: () => active,
			onDidChangeActiveSession: Event.None,
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
			active = 'session-new';
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
				assert.ok(status.includes('Unable to commit'));
				if (!written.supported) {
					assert.ok(status.includes(sourcesGitCommitNotAcceptedMessage()));
				}
			} finally {
				acceptCommand.dispose();
				commitCommand.dispose();
			}
		}
	});

	test('no-hook commit still calls writeGitCommit with the leftover session', async function () {
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
			assert.strictEqual(commitCalls.length, 1);
			assert.strictEqual(commitCalls[0]?.sessionId, 'session-old');
			assert.deepStrictEqual(gitCommands, []);
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
		const status = await waitForStatusText(host, 'not inside');
		assert.ok(status.includes(sourcesGitChangeOutsideRootMessage()));
		assert.strictEqual(openCalls, 0);
	});
});
