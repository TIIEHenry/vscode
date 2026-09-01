/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationEditorPane.css';
import { $, append } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { ConversationLens } from './conversationLens.js';
import { ConversationChatInput } from './conversationChatInput.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';

export class ConversationEditorPane extends EditorPane {

	static readonly ID = 'workbench.editor.conversationChat';

	private lens: ConversationLens | undefined;
	private readonly lensDisposables = this._register(new DisposableStore());

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly paneInstantiationService: IInstantiationService,
		@IConversationPartService private readonly conversationPartService: IConversationPartService,
	) {
		super(ConversationEditorPane.ID, group, telemetryService, themeService, storageService);
	}

	protected override createEditor(parent: HTMLElement): void {
		const timeline = append(parent, $('.conversation-timeline'));
		timeline.setAttribute('data-conversation-slot', 'timeline');
		const dock = append(parent, $('.conversation-dock'));
		dock.setAttribute('data-conversation-slot', 'dock');

		const sessionBar = this.conversationPartService.getSlots()?.sessionBar;
		if (!sessionBar) {
			throw new Error('ConversationPart session bar is not available');
		}
		this.lens = this.lensDisposables.add(this.paneInstantiationService.createInstance(ConversationLens, { sessionBar, timeline, dock }));
	}

	override async setInput(input: ConversationChatInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
	}

	override layout(dimension: { width: number; height: number }): void {
		// Conversation lens lays out from DOM; editor pane supplies the bounds.
	}

	override focus(): void {
		this.lens?.focusDockInput();
	}
}
