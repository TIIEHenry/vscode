/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { EditorOpenSource } from '../../../../platform/editor/common/editor.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import type { UniverseAgentReadGitFileDiffResult } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ACTIVE_GROUP, CONVERSATION_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { IQuickDiffService } from '../../scm/common/quickDiff.js';
import { resolveSourcesChangeRef, ISourcesChangeRef } from '../common/sourcesChangeRef.js';
import {
	needsSourcesGitFileDiff,
	parseSourcesGitUnifiedDiff,
	sourcesGitEmptyFileDiffMessage,
} from '../common/sourcesChangesGitRead.js';
import { ISourcesChangeEntry } from '../common/sourcesChangesModel.js';
import { SOURCES_DIFF_DEFAULT_OWNER_SETTING, SourcesDiffDefaultOwner } from '../common/sourcesDiffConfiguration.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { ConversationDiffReviewInput } from './conversationDiffReviewInput.js';

export interface ISourcesChangeEntryOpenOptions {
	readonly preserveFocus?: boolean;
	readonly pinned?: boolean;
}

export interface ISourcesChangeEntryOpenDeps {
	readonly editorService: IEditorService;
	readonly quickDiffService: IQuickDiffService;
	readonly configurationService: IConfigurationService;
	readonly instantiationService: IInstantiationService;
	readonly sourcesDiffPanelService: ISourcesDiffPanelService;
	readonly modelService?: IModelService;
	readonly readGitFileDiff?: (entry: ISourcesChangeEntry) => Promise<UniverseAgentReadGitFileDiffResult | undefined>;
}

/** Open a Changes/Review row via default diff owner dispatch. */
export async function openSourcesChangeEntry(
	entry: ISourcesChangeEntry,
	deps: ISourcesChangeEntryOpenDeps,
	options: ISourcesChangeEntryOpenOptions,
): Promise<void> {
	let ref = await resolveSourcesChangeRef(entry, deps.quickDiffService);
	ref = await applySourcesGitFileDiffIfNeeded(entry, ref, deps);
	const defaultOwner = deps.configurationService.getValue<SourcesDiffDefaultOwner>(SOURCES_DIFF_DEFAULT_OWNER_SETTING) ?? 'preview';

	switch (defaultOwner) {
		case 'conversation':
			await openSourcesChangeInConversation(ref, deps, options);
			break;
		case 'panel':
			await deps.sourcesDiffPanelService.show(ref);
			break;
		case 'preview':
		default:
			await openSourcesChangeInPreview(ref, deps, options);
			break;
	}
}

async function applySourcesGitFileDiffIfNeeded(
	entry: ISourcesChangeEntry,
	ref: ISourcesChangeRef,
	deps: ISourcesChangeEntryOpenDeps,
): Promise<ISourcesChangeRef> {
	if (!needsSourcesGitFileDiff(entry, !!ref.original) || !deps.readGitFileDiff || !deps.modelService) {
		return ref;
	}

	const result = await deps.readGitFileDiff(entry);
	if (!result || !result.supported) {
		return ref;
	}
	if (result.unifiedDiff === '') {
		throw new Error(sourcesGitEmptyFileDiffMessage());
	}

	const sides = parseSourcesGitUnifiedDiff(result.unifiedDiff);
	const originalUri = sourcesGitDiffModelUri('original', entry.gitPath ?? '', entry.indexState ?? '');
	const modifiedUri = sourcesGitDiffModelUri('modified', entry.gitPath ?? '', entry.indexState ?? '');
	writeSourcesGitDiffModel(deps.modelService, originalUri, sides.original);
	writeSourcesGitDiffModel(deps.modelService, modifiedUri, sides.modified);

	return {
		modified: modifiedUri,
		original: originalUri,
		groupId: ref.groupId,
		scmResource: ref.scmResource,
	};
}

function sourcesGitDiffModelUri(side: 'original' | 'modified', path: string, indexState: string): URI {
	return URI.from({
		scheme: 'sources-git-diff',
		path: `/${side}/${encodeURIComponent(path)}/${encodeURIComponent(indexState)}`,
	});
}

function writeSourcesGitDiffModel(modelService: IModelService, resource: URI, value: string): void {
	const existing = modelService.getModel(resource);
	if (existing) {
		modelService.updateModel(existing, value);
		return;
	}
	modelService.createModel(value, null, resource);
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

async function openSourcesChangeInConversation(
	ref: ISourcesChangeRef,
	deps: ISourcesChangeEntryOpenDeps,
	options: ISourcesChangeEntryOpenOptions,
): Promise<void> {
	const input = deps.instantiationService.createInstance(
		ConversationDiffReviewInput,
		ref.modified,
		ref.original,
		ref.groupId,
	);
	await deps.editorService.openEditor(input, {
		preserveFocus: options.preserveFocus,
		pinned: options.pinned,
	}, CONVERSATION_GROUP);
}
