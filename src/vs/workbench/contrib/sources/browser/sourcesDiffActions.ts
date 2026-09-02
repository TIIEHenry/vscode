/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { Schemas } from '../../../../base/common/network.js';
import { localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ResourceContextKey } from '../../../common/contextkeys.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ISCMService } from '../../scm/common/scm.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { SourcesDiffPanelService } from './sourcesDiffPanelService.js';
import { SOURCES_DIFF_PANEL_VIEW_ID } from './sourcesDiffPanelIds.js';
import { moveActiveDiffToConversation, moveActiveDiffToPanel, moveActiveDiffToPreview } from './sourcesDiffRefHelpers.js';

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
				id: MenuId.ViewTitle,
				group: '1_sourcesDiff',
				order: 10,
				when: panelDiffTitleWhen,
			}],
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		await moveActiveDiffToConversation(
			accessor.get(IEditorService),
			accessor.get(ISCMService),
			accessor.get(IInstantiationService),
			accessor.get(ISourcesDiffPanelService),
		);
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
			}],
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		await moveActiveDiffToPanel(
			accessor.get(IEditorService),
			accessor.get(ISCMService),
			accessor.get(ISourcesDiffPanelService),
		);
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
				id: MenuId.ViewTitle,
				group: '1_sourcesDiff',
				order: 11,
				when: panelDiffTitleWhen,
			}],
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		await moveActiveDiffToPreview(
			accessor.get(IEditorService),
			accessor.get(ISCMService),
			accessor.get(ISourcesDiffPanelService),
		);
	}
});
