/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorOpenSource } from '../../../../platform/editor/common/editor.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ACTIVE_GROUP, CONVERSATION_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { IQuickDiffService } from '../../scm/common/quickDiff.js';
import { resolveSourcesChangeRef, ISourcesChangeRef } from '../common/sourcesChangeRef.js';
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
}

/** Open a Changes/Review row via default diff owner dispatch. */
export async function openSourcesChangeEntry(
	entry: ISourcesChangeEntry,
	deps: ISourcesChangeEntryOpenDeps,
	options: ISourcesChangeEntryOpenOptions,
): Promise<void> {
	const ref = await resolveSourcesChangeRef(entry, deps.quickDiffService);
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
	);
	await deps.editorService.openEditor(input, {
		preserveFocus: options.preserveFocus,
		pinned: options.pinned,
	}, CONVERSATION_GROUP);
}
