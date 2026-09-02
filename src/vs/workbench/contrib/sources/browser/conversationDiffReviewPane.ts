/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { localize } from '../../../../nls.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { ConversationDiffReviewInput } from './conversationDiffReviewInput.js';

export class ConversationDiffReviewPane extends EditorPane {

	static readonly ID = 'workbench.editor.conversationDiffReview';

	private container: HTMLElement | undefined;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
	) {
		super(ConversationDiffReviewPane.ID, group, telemetryService, themeService, storageService);
	}

	protected override createEditor(parent: HTMLElement): void {
		this.container = append(parent, $('.conversation-diff-review-pane'));
		this.container.setAttribute('role', 'document');
		this.container.setAttribute('aria-label', localize('conversationDiffReviewPane.ariaLabel', "Diff review"));
	}

	override async setInput(input: ConversationDiffReviewInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		if (this.container) {
			clearNode(this.container);
			append(this.container, $('span.conversation-diff-review-pane-stub'));
			this.container.lastElementChild!.textContent = input.getName();
		}
	}

	override layout(_dimension: { width: number; height: number }): void {
		// Stub pane: no embedded diff widget until a later slice wires content.
	}
}
