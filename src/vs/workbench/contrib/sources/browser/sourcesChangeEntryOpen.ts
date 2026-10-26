/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IModelService } from '../../../../editor/common/services/model.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { EditorOpenSource } from '../../../../platform/editor/common/editor.js';
import { isUriComponents, URI } from '../../../../base/common/uri.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import type { UniverseAgentReadGitFileDiffResult } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { EditorResourceAccessor, isDiffEditorInput, isSideBySideEditorInput } from '../../../common/editor.js';
import { isEqual } from '../../../../base/common/resources.js';
import { API_OPEN_DIFF_EDITOR_COMMAND_ID, API_OPEN_EDITOR_COMMAND_ID } from '../../../browser/parts/editor/editorCommands.js';
import { ACTIVE_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { IEditorGroup, IEditorGroupsService, preferredSideBySideGroupDirection } from '../../../services/editor/common/editorGroupsService.js';
import { openEditorInSlot } from '../../../services/editor/browser/editorOpenSlot.js';
import { EditorOpenSlot } from '../../../services/editor/common/editorOpenSlot.js';
import { runSuppressingExplorerAutoReveal } from '../../../services/editor/common/explorerAutoRevealGate.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { ConversationChatInput } from '../../conversation/common/conversationChatInput.js';
import { IQuickDiffService } from '../../scm/common/quickDiff.js';
import { ISCMResource } from '../../scm/common/scm.js';
import { resolveSourcesChangeRef, ISourcesChangeRef, sourcesChangeIdentity, sourcesChangeRefWithEntryIdentity } from '../common/sourcesChangeRef.js';
import {
	isSourcesGitUnrootedResource,
	needsSourcesGitFileDiff,
	parseSourcesGitUnifiedDiff,
	sourcesGitEmptyFileDiffMessage,
	sourcesGitReadUnavailableNoHookMessage,
} from '../common/sourcesChangesGitRead.js';
import { ISourcesChangeEntry } from '../common/sourcesChangesModel.js';
import { SOURCES_DIFF_DEFAULT_OWNER_SETTING, SourcesDiffDefaultOwner } from '../common/sourcesDiffConfiguration.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { readOpenedSourcesConversationComparison } from './conversationDiffReviewPane.js';
import { ConversationDiffReviewInput } from './conversationDiffReviewInput.js';
import { sourcesGitDiffContentStore, sourcesGitDiffModelUri } from './sourcesGitDiffContent.js';
import { rememberSourcesDiffOpenIdentity, sourcesDiffOpenIdentity } from './sourcesDiffOpenIdentity.js';
import { allocateSourcesDiffLoadGeneration, onDidSourcesDiffLoad } from './sourcesDiffLoadSignal.js';

export interface ISourcesChangeEntryOpenOptions {
	readonly preserveFocus?: boolean;
	readonly pinned?: boolean;
	/**
	 * Row click sets this from `sources.editorOpenMode`.
	 * Omitted calls keep the previous open (move actions, existing callers).
	 */
	readonly slot?: EditorOpenSlot;
	/** Move passes the destination. Row click uses `sources.diff.defaultOwner`. */
	readonly owner?: SourcesDiffDefaultOwner;
	/** Move-only. Skips quickDiff rebuild; the diff-text algebra still runs. */
	readonly changeRef?: ISourcesChangeRef;
}

export interface ISourcesChangeEntryOpenDeps {
	readonly commandService: ICommandService;
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
 * Direct editors and comparison hosts report their observable result.
 * SCM commands retain their delegated void completion contract.
 */
export async function openSourcesChangeEntry(
	entry: ISourcesChangeEntry,
	deps: ISourcesChangeEntryOpenDeps,
	options: ISourcesChangeEntryOpenOptions,
): Promise<boolean | 'stale'> {
	return runSuppressingExplorerAutoReveal(() => dispatchSourcesChangeEntry(entry, deps, options));
}

async function dispatchSourcesChangeEntry(
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
			return deps.sourcesDiffPanelService.show(ref);
		case 'preview':
		default:
			return openSourcesChangeInPreview(ref, deps, options);
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

	const originalUri = sourcesGitDiffModelUri('original', entry.gitPath ?? '', entry.indexState ?? '', entry.sessionId ?? '');
	const modifiedUri = sourcesGitDiffModelUri('modified', entry.gitPath ?? '', entry.indexState ?? '', entry.sessionId ?? '');
	const generation = sourcesGitDiffContentStore.begin([originalUri, modifiedUri]);
	const result = await deps.readGitFileDiff(entry);
	if (sourcesGitDiffContentStore.generation(originalUri) !== generation) {
		return 'stale';
	}
	if (!result || !result.supported) {
		if (isSourcesGitUnrootedResource(entry.resource)) {
			const reason = result && !result.supported ? result.reason.trim() : '';
			throw new Error(reason || sourcesGitReadUnavailableNoHookMessage());
		}
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
): Promise<boolean> {
	if (ref.scmResource) {
		const group = deps.editorGroupsService?.activeGroup;
		const previous = group?.activeEditor ?? undefined;
		// Custom open cannot receive a pinned option, so preserving its old preview needs this pre-pin.
		// API commands pin the new input through their context, with provider options winning instead.
		if (!isApiScmOpenCommand(ref.scmResource) && options.slot === 'newTab' && previous && group && !group.isPinned(previous)) {
			group.pinEditor(previous);
		}

		await dispatchScmResource(ref.scmResource, deps.commandService, options);
		const opened = findOpenedScmResource(ref, deps, group);
		if (opened) {
			rememberSourcesDiffOpenIdentity(opened.input, { groupId: ref.groupId, scmResource: ref.scmResource });
			// API commands apply context options themselves, with provider options winning.
			if (!isApiScmOpenCommand(ref.scmResource) && (options.slot === 'newTab' || options.pinned)) {
				opened.group?.pinEditor(opened.input);
			}
			if (options.slot === 'replace' && group && opened.group === group && previous && !previous.matches(opened.input) && group.editors.includes(previous)) {
				await group.closeEditor(previous);
			}
		}
		// Neither the API command nor custom resource.open returns a pane.
		return true;
	}

	if (ref.original) {
		const input = {
			original: { resource: ref.original },
			modified: { resource: ref.modified },
			options: {
				preserveFocus: options.preserveFocus,
				pinned: options.pinned,
				source: EditorOpenSource.USER,
			},
		};
		const pane = options.slot && deps.editorGroupsService
			? await openEditorInSlot(deps.editorService, deps.editorGroupsService, input, options.slot, {
				preserveFocus: options.preserveFocus,
				source: EditorOpenSource.USER,
			}, ACTIVE_GROUP)
			: await deps.editorService.openEditor(input, ACTIVE_GROUP);
		rememberSourcesDiffOpenIdentity(pane?.input, { groupId: ref.groupId, scmResource: ref.scmResource });
		return pane !== undefined;
	}

	const fileInput = {
		resource: ref.modified,
		options: {
			preserveFocus: options.preserveFocus,
			pinned: options.pinned,
			source: EditorOpenSource.USER,
		},
	};
	const pane = options.slot && deps.editorGroupsService
		? await openEditorInSlot(deps.editorService, deps.editorGroupsService, fileInput, options.slot, {
			preserveFocus: options.preserveFocus,
			source: EditorOpenSource.USER,
		}, ACTIVE_GROUP)
		: await deps.editorService.openEditor(fileInput, ACTIVE_GROUP);
	return pane !== undefined;
}

function isApiScmOpenCommand(resource: ISCMResource): boolean {
	return resource.command?.id === API_OPEN_EDITOR_COMMAND_ID || resource.command?.id === API_OPEN_DIFF_EDITOR_COMMAND_ID;
}

async function dispatchScmResource(resource: ISCMResource, commandService: ICommandService, options: ISourcesChangeEntryOpenOptions): Promise<void> {
	const command = resource.command;
	if (command && isApiScmOpenCommand(resource)) {
		const args = [...(command.arguments ?? [])];
		const contextIndex = command.id === API_OPEN_EDITOR_COMMAND_ID ? 3 : 4;
		args[contextIndex] = {
			editorOptions: {
				preserveFocus: options.preserveFocus,
				pinned: options.slot ? true : options.pinned,
				source: EditorOpenSource.USER,
			},
			sideBySide: false,
		};
		await commandService.executeCommand(command.id, ...args);
		return;
	}
	await resource.open(!!options.preserveFocus);
}

/** Match public resource identities before pin/close or remembering a delegated open. */
function findOpenedScmResource(ref: ISourcesChangeRef, deps: ISourcesChangeEntryOpenDeps, requestedGroup: IEditorGroup | undefined): { input: EditorInput; group: IEditorGroup | undefined } | undefined {
	const resource = ref.scmResource;
	const command = resource?.command;
	const firstArgument = command?.arguments?.[0];
	const secondArgument = command?.arguments?.[1];
	let apiOpenResource: URI | undefined;
	if (command?.id === API_OPEN_EDITOR_COMMAND_ID) {
		if (typeof firstArgument === 'string') {
			apiOpenResource = URI.parse(firstArgument);
		} else if (isUriComponents(firstArgument)) {
			apiOpenResource = URI.revive(firstArgument);
		}
	}
	const apiOriginal = command?.id === API_OPEN_DIFF_EDITOR_COMMAND_ID && isUriComponents(firstArgument) ? URI.revive(firstArgument) : undefined;
	const apiModified = command?.id === API_OPEN_DIFF_EDITOR_COMMAND_ID && isUriComponents(secondArgument) ? URI.revive(secondArgument) : undefined;
	const matches = (input: EditorInput | undefined): input is EditorInput => {
		if (!input) {
			return false;
		}
		if (command?.id === API_OPEN_EDITOR_COMMAND_ID) {
			return !!apiOpenResource && !isDiffEditorInput(input) && !isSideBySideEditorInput(input)
				&& isEqual(EditorResourceAccessor.getOriginalUri(input), apiOpenResource);
		}
		if (command?.id === API_OPEN_DIFF_EDITOR_COMMAND_ID) {
			return !!apiOriginal && !!apiModified && isDiffEditorInput(input)
				&& isEqual(EditorResourceAccessor.getOriginalUri(input.original), apiOriginal)
				&& isEqual(EditorResourceAccessor.getOriginalUri(input.modified), apiModified);
		}
		if (resource?.multiDiffEditorOriginalUri && resource.multiDiffEditorModifiedUri) {
			return isDiffEditorInput(input)
				&& isEqual(EditorResourceAccessor.getOriginalUri(input.original), resource.multiDiffEditorOriginalUri)
				&& isEqual(EditorResourceAccessor.getOriginalUri(input.modified), resource.multiDiffEditorModifiedUri);
		}
		const identity = sourcesDiffOpenIdentity(input);
		return !!resource && identity?.scmResource === resource && identity.groupId === ref.groupId;
	};
	const activePane = deps.editorService.activeEditorPane;
	if (activePane && matches(activePane.input)) {
		return { input: activePane.input, group: activePane.group };
	}
	const requested = requestedGroup?.activeEditor ?? undefined;
	if (matches(requested)) {
		return { input: requested, group: requestedGroup };
	}
	for (const pane of deps.editorService.visibleEditorPanes ?? []) {
		if (matches(pane.input)) {
			return { input: pane.input, group: pane.group };
		}
	}
	const active = deps.editorService.activeEditor;
	return matches(active) ? { input: active, group: requestedGroup?.editors.includes(active) ? requestedGroup : undefined } : undefined;
}

/** Shared false-result detail; it also applies to direct Preview editor opens. */
export function sourcesChangeOpenIncompleteMessage(): string {
	return localize('sourcesChangeEntryOpen.incomplete', "The requested change could not be opened.");
}

/** Active session has no conversation leaf. */
export function sourcesConversationLeafMissingMessage(): string {
	return localize('sourcesChangeEntryOpen.leafMissing', "No conversation window is open for the active session.");
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
		throw new Error(sourcesConversationLeafMissingMessage());
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
		const pane = options.slot && deps.editorGroupsService
			? await openEditorInSlot(deps.editorService, deps.editorGroupsService, input, options.slot, {
				preserveFocus: options.preserveFocus,
			}, targetGroup)
			: await targetGroup.openEditor(input, {
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
