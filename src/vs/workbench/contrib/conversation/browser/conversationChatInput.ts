/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { EditorInputCapabilities, IEditorIdentifier, IUntypedEditorInput, isEditorInput, isResourceEditorInput } from '../../../common/editor.js';
import { EditorInput, IEditorCloseHandler } from '../../../common/editor/editorInput.js';
import { ConfirmResult } from '../../../../platform/dialogs/common/dialogs.js';

export const ConversationChatInputScheme = 'conversation-chat';
export const ConversationChatInputTypeId = 'workbench.editors.conversationChatInput';

export interface IConversationChatInputOptions {
	readonly isDefaultRoot?: boolean;
}

export function getDefaultConversationChatResource(sessionKey: string): URI {
	return URI.from({
		scheme: ConversationChatInputScheme,
		path: `/session/${sessionKey}/chat/default`,
	});
}

export class ConversationChatInput extends EditorInput implements IEditorCloseHandler {

	static readonly TypeID = ConversationChatInputTypeId;

	private readonly _resource: URI;
	private readonly _isDefaultRoot: boolean;

	constructor(resource: URI, options?: IConversationChatInputOptions) {
		super();
		this._resource = resource;
		this._isDefaultRoot = options?.isDefaultRoot ?? false;
	}

	override closeHandler = this;

	get isDefaultRoot(): boolean {
		return this._isDefaultRoot;
	}

	showConfirm(): boolean {
		return this._isDefaultRoot;
	}

	async confirm(_editors: ReadonlyArray<IEditorIdentifier>): Promise<ConfirmResult> {
		return ConfirmResult.CANCEL;
	}

	override get typeId(): string {
		return ConversationChatInput.TypeID;
	}

	override get editorId(): string | undefined {
		return ConversationChatInput.TypeID;
	}

	override get resource(): URI {
		return this._resource;
	}

	override get capabilities(): EditorInputCapabilities {
		let capabilities = super.capabilities;
		if (this._isDefaultRoot) {
			capabilities |= EditorInputCapabilities.CannotClose;
		}
		return capabilities;
	}

	override getName(): string {
		return localize('conversationChatInputName', "Conversation");
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}

		if (other instanceof ConversationChatInput) {
			return this._resource.toString() === other._resource.toString();
		}

		if (!isEditorInput(other) && isResourceEditorInput(other) && other.resource) {
			return this._resource.toString() === other.resource.toString();
		}

		return false;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: this._resource,
			options: {
				override: ConversationChatInput.TypeID,
			}
		};
	}
}
