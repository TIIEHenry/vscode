/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IModelService } from '../../../../editor/common/services/model.js';
import { EditorOpenSource } from '../../../../platform/editor/common/editor.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import type { UniverseAgentReadGitFileDiffResult } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ACTIVE_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { IEditorGroup, IEditorGroupsService, preferredSideBySideGroupDirection } from '../../../services/editor/common/editorGroupsService.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { ConversationChatInput } from '../../conversation/common/conversationChatInput.js';
import { IQuickDiffService } from '../../scm/common/quickDiff.js';
import { resolveSourcesChangeRef, ISourcesChangeRef, sourcesChangeIdentity, sourcesChangeRefWithEntryIdentity } from '../common/sourcesChangeRef.js';
import {
	needsSourcesGitFileDiff,
	parseSourcesGitUnifiedDiff,
	sourcesGitEmptyFileDiffMessage,
} from '../common/sourcesChangesGitRead.js';
import { ISourcesChangeEntry } from '../common/sourcesChangesModel.js';
import { SOURCES_DIFF_DEFAULT_OWNER_SETTING, SourcesDiffDefaultOwner } from '../common/sourcesDiffConfiguration.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { readOpenedSourcesConversationComparison } from './conversationDiffReviewPane.js';
import { ConversationDiffReviewInput } from './conversationDiffReviewInput.js';
import { sourcesGitDiffContentStore, sourcesGitDiffModelUri } from './sourcesGitDiffContent.js';
import { allocateSourcesDiffLoadGeneration, onDidSourcesDiffLoad } from './sourcesDiffLoadSignal.js';

export interface ISourcesChangeEntryOpenOptions {
	readonly preserveFocus?: boolean;
	readonly pinned?: boolean;
	/** Move passes the destination. Row click uses `sources.diff.defaultOwner`. */
	readonly owner?: SourcesDiffDefaultOwner;
	/** Move-only. Skips quickDiff rebuild; the diff-text algebra still runs. */
	readonly changeRef?: ISourcesChangeRef;
}

export interface ISourcesChangeEntryOpenDeps {
	readonly editorService: IEditorService;
	readonly quickDiffService: IQuickDiffService;
	readonly configurationService: IConfigurationService;
	readonly instantiationService: IInstantiationService;
	readonly sourcesDiffPanelService: ISourcesDiffPanelService;
	readonly modelService?: IModelService;
	readonly readGitFileDiff?: (entry: ISourcesChangeEntry) => Promise<UniverseAgentReadGitFileDiffResult | undefined>;
	readonly editorGroupsService?: IEditorGroupsService;
	readonly session?: IAgentSessionContext;
}

/**
 * Open a Changes/Review row via default diff owner dispatch.
 * `'stale'` means a newer `ReadGitFileDiff` won; nothing was opened and this is not a failure.
 * Boolean results come only from `openSourcesChangeInConversation` and Panel `show()`.
 */
export async function openSourcesChangeEntry(
	entry: ISourcesChangeEntry,
	deps: ISourcesChangeEntryOpenDeps,
	options: ISourcesChangeEntryOpenOptions,
): Promise<boolean | 'stale'> {
	let ref = options.changeRef ?? await resolveSourcesChangeRef(entry, deps.quickDiffService);
	const applied = await applySourcesGitFileDiffIfNeeded(entry, ref, deps);
	if (applied === 'stale') {
		return 'stale';
	}
	ref = applied;
	const owner = options.owner
		?? deps.configurationService.getValue<SourcesDiffDefaultOwner>(SOURCES_DIFF_DEFAULT_OWNER_SETTING)
		?? 'preview';

	switch (owner) {
		case 'conversation':
			return openSourcesChangeInConversation(ref, deps, options);
		case 'panel':
			return (await deps.sourcesDiffPanelService.show(ref)) === true;
		case 'preview':
		default:
			await openSourcesChangeInPreview(ref, deps, options);
			return true;
	}
}

async function applySourcesGitFileDiffIfNeeded(
	entry: ISourcesChangeEntry,
	ref: ISourcesChangeRef,
	deps: ISourcesChangeEntryOpenDeps,
): Promise<ISourcesChangeRef | 'stale'> {
	if (!needsSourcesGitFileDiff(entry, !!ref.original) || !deps.readGitFileDiff || !deps.modelService) {
		return ref;
	}

	const originalUri = sourcesGitDiffModelUri('original', entry.gitPath ?? '', entry.indexState ?? '');
	const modifiedUri = sourcesGitDiffModelUri('modified', entry.gitPath ?? '', entry.indexState ?? '');
	const generation = sourcesGitDiffContentStore.begin([originalUri, modifiedUri]);
	const result = await deps.readGitFileDiff(entry);
	if (sourcesGitDiffContentStore.generation(originalUri) !== generation) {
		return 'stale';
	}
	if (!result || !result.supported) {
		return ref;
	}
	if (result.unifiedDiff === '') {
		throw new Error(sourcesGitEmptyFileDiffMessage());
	}

	const sides = parseSourcesGitUnifiedDiff(result.unifiedDiff);
	const wroteOriginal = sourcesGitDiffContentStore.put(originalUri, sides.original, generation, deps.modelService);
	const wroteModified = sourcesGitDiffContentStore.put(modifiedUri, sides.modified, generation, deps.modelService);
	if (!wroteOriginal || !wroteModified) {
		return 'stale';
	}

	return sourcesChangeRefWithEntryIdentity(entry, {
		modified: modifiedUri,
		original: originalUri,
		groupId: ref.groupId,
		scmResource: ref.scmResource,
	});
}

async function openSourcesChangeInPreview(
	ref: ISourcesChangeRef,
	deps: ISourcesChangeEntryOpenDeps,
	options: ISourcesChangeEntryOpenOptions,
): Promise<void> {
	if (ref.scmResource) {
		await ref.scmResource.open(!!options.preserveFocus);
		if (options.pinned) {
			const activeEditorPane = deps.editorService.activeEditorPane;
			activeEditorPane?.group.pinEditor(activeEditorPane.input);
		}
		return;
	}

	if (ref.original) {
		await deps.editorService.openEditor({
			original: { resource: ref.original },
			modified: { resource: ref.modified },
			options: {
				preserveFocus: options.preserveFocus,
				pinned: options.pinned,
				source: EditorOpenSource.USER,
			},
		}, ACTIVE_GROUP);
		return;
	}

	await deps.editorService.openEditor({
		resource: ref.modified,
		options: {
			preserveFocus: options.preserveFocus,
			pinned: options.pinned,
			source: EditorOpenSource.USER,
		},
	}, ACTIVE_GROUP);
}

export async function openSourcesChangeInConversation(
	ref: ISourcesChangeRef,
	deps: ISourcesChangeEntryOpenDeps,
	options: ISourcesChangeEntryOpenOptions,
): Promise<boolean> {
	const sessionId = deps.session?.getActiveSessionId();
	const part = sessionId === undefined
		? undefined
		: deps.editorGroupsService?.conversationParts.find(candidate => candidate.sessionKey === sessionId);
	if (!part) {
		return false;
	}

	const input = deps.instantiationService.createInstance(
		ConversationDiffReviewInput,
		ref.modified,
		ref.original,
		ref.groupId,
		sourcesChangeIdentity(ref),
	);
	const generation = allocateSourcesDiffLoadGeneration();
	input.assignLoadGeneration(generation);

	let loaded: { ok: boolean } | undefined;
	const listener = onDidSourcesDiffLoad(event => {
		if (event.generation === generation) {
			loaded = { ok: event.ok };
		}
	});
	try {
		const targetGroup = findConversationDiffGroup(part, input, deps.configurationService);
		if (!targetGroup) {
			return false;
		}
		const pane = await targetGroup.openEditor(input, {
			preserveFocus: options.preserveFocus,
			pinned: options.pinned,
		});
		if (pane === undefined) {
			return false;
		}
		if (loaded) {
			return loaded.ok === true;
		}
		const opened = readOpenedSourcesConversationComparison(pane);
		if (opened?.matches(input) && opened.state === 'ok') {
			return true;
		}
		return false;
	} finally {
		listener.dispose();
	}
}

function findConversationDiffGroup(
	part: IEditorGroupsService['conversationParts'][number],
	input: ConversationDiffReviewInput,
	configurationService: IConfigurationService,
): IEditorGroup | undefined {
	for (const group of part.groups) {
		for (const editor of group.editors) {
			if (editor instanceof ConversationDiffReviewInput && input.matches(editor)) {
				return group;
			}
		}
	}

	const chatRoot = findDefaultConversationChatRoot(part);
	if (!chatRoot) {
		return undefined;
	}

	const direction = preferredSideBySideGroupDirection(configurationService);
	const candidate = part.findGroup({ direction }, chatRoot, false);
	if (candidate) {
		if (part.isGroupHidden(candidate)) {
			part.setGroupHidden(candidate, false);
		}
		return candidate;
	}

	return part.addGroup(chatRoot, direction);
}

function findDefaultConversationChatRoot(part: IEditorGroupsService['conversationParts'][number]): IEditorGroup | undefined {
	for (const group of part.groups) {
		for (const editor of group.editors) {
			if (editor instanceof ConversationChatInput && editor.isDefaultRoot) {
				return group;
			}
		}
	}
	return undefined;
}
