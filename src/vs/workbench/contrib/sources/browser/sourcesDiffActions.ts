/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { Schemas } from '../../../../base/common/network.js';
import { localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ActiveEditorContext, ResourceContextKey } from '../../../common/contextkeys.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { IQuickDiffService } from '../../scm/common/quickDiff.js';
import { ISCMService } from '../../scm/common/scm.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { ConversationDiffReviewEditorId } from '../common/conversationDiffReviewInput.js';
import { SourcesDiffPanelService } from './sourcesDiffPanelService.js';
import { SOURCES_DIFF_PANEL_VIEW_ID } from './sourcesDiffPanelIds.js';
import { ISourcesChangeEntryOpenDeps } from './sourcesChangeEntryOpen.js';
import { moveActiveDiffToConversation, moveActiveDiffToPanel, moveActiveDiffToPreview } from './sourcesDiffRefHelpers.js';

function sourcesChangeEntryOpenDeps(accessor: ServicesAccessor): ISourcesChangeEntryOpenDeps {
	return {
		editorService: accessor.get(IEditorService),
		quickDiffService: accessor.get(IQuickDiffService),
		configurationService: accessor.get(IConfigurationService),
		instantiationService: accessor.get(IInstantiationService),
		sourcesDiffPanelService: accessor.get(ISourcesDiffPanelService),
		editorGroupsService: accessor.get(IEditorGroupsService),
		session: accessor.get(IAgentSessionContext),
	};
}

export const SOURCES_DIFF_MOVE_TO_CONVERSATION_COMMAND = 'sources.diff.moveToConversation';
export const SOURCES_DIFF_MOVE_TO_PANEL_COMMAND = 'sources.diff.moveToPanel';
export const SOURCES_DIFF_MOVE_TO_PREVIEW_COMMAND = 'sources.diff.moveToPreview';

const previewDiffTitleWhen = ContextKeyExpr.and(
	ResourceContextKey.Scheme.isEqualTo(Schemas.file),
	ContextKeyExpr.has('isInDiffEditor'),
);

const panelDiffTitleWhen = ContextKeyExpr.and(
	ContextKeyExpr.equals('view', SOURCES_DIFF_PANEL_VIEW_ID),
	SourcesDiffPanelService.ctxHasChange,
);

registerAction2(class SourcesDiffMoveToConversationAction extends Action2 {
	constructor() {
		super({
			id: SOURCES_DIFF_MOVE_TO_CONVERSATION_COMMAND,
			title: localize2('sourcesDiffMoveToConversation', "Move Diff to Conversation"),
			icon: Codicon.commentDiscussion,
			menu: [{
				id: MenuId.EditorTitle,
				group: '1_sourcesDiff',
				order: 10,
				when: previewDiffTitleWhen,
			}, {
				id: MenuId.EditorTitleContext,
				group: '6_sourcesDiff',
				order: 10,
				when: previewDiffTitleWhen,
			}, {
				id: MenuId.ViewTitle,
				group: '1_sourcesDiff',
				order: 10,
				when: panelDiffTitleWhen,
			}],
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		await moveActiveDiffToConversation(sourcesChangeEntryOpenDeps(accessor), accessor.get(ISCMService));
	}
});

registerAction2(class SourcesDiffMoveToPanelAction extends Action2 {
	constructor() {
		super({
			id: SOURCES_DIFF_MOVE_TO_PANEL_COMMAND,
			title: localize2('sourcesDiffMoveToPanel', "Move Diff to Panel"),
			icon: Codicon.layoutPanel,
			menu: [{
				id: MenuId.EditorTitle,
				group: '1_sourcesDiff',
				order: 11,
				when: previewDiffTitleWhen,
			}, {
				id: MenuId.EditorTitleContext,
				group: '6_sourcesDiff',
				order: 11,
				when: previewDiffTitleWhen,
			}],
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		await moveActiveDiffToPanel(sourcesChangeEntryOpenDeps(accessor), accessor.get(ISCMService));
	}
});

registerAction2(class SourcesDiffMoveToPreviewAction extends Action2 {
	constructor() {
		super({
			id: SOURCES_DIFF_MOVE_TO_PREVIEW_COMMAND,
			title: localize2('sourcesDiffMoveToPreview', "Open Diff in Preview"),
			icon: Codicon.openPreview,
			f1: false,
			menu: [{
				id: MenuId.EditorTitle,
				group: '1_sourcesDiff',
				order: 11,
				when: ActiveEditorContext.isEqualTo(ConversationDiffReviewEditorId),
			}, {
				id: MenuId.EditorTitleContext,
				group: '6_sourcesDiff',
				order: 11,
				when: ActiveEditorContext.isEqualTo(ConversationDiffReviewEditorId),
			}, {
				id: MenuId.ViewTitle,
				group: '1_sourcesDiff',
				order: 11,
				when: panelDiffTitleWhen,
			}],
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		await moveActiveDiffToPreview(sourcesChangeEntryOpenDeps(accessor), accessor.get(ISCMService));
	}
});
