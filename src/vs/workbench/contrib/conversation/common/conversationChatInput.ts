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
	readonly title?: string;
}

export function getDefaultConversationChatResource(sessionKey: string): URI {
	return getConversationChatResource(sessionKey, 'default');
}

export function getConversationChatResource(sessionKey: string, chatId: string): URI {
	return URI.from({
		scheme: ConversationChatInputScheme,
		path: `/session/${encodeURIComponent(sessionKey)}/chat/${encodeURIComponent(chatId)}`,
	});
}

export function parseConversationChatResource(resource: URI): { sessionKey: string; chatId: string; isDefaultRoot: boolean } | undefined {
	if (resource.scheme !== ConversationChatInputScheme) {
		return undefined;
	}
	const match = /^\/session\/([^/]+)\/chat\/([^/]+)$/.exec(resource.path);
	if (!match) {
		return undefined;
	}
	const sessionKey = decodeURIComponent(match[1]);
	const chatId = decodeURIComponent(match[2]);
	return {
		sessionKey,
		chatId,
		isDefaultRoot: chatId === 'default',
	};
}

export function deriveConversationChatIdFromForkResource(forkedResource: URI): string {
	if (forkedResource.fragment) {
		return forkedResource.fragment;
	}
	const segments = forkedResource.path.split('/').filter(Boolean);
	return segments.at(-1) ?? forkedResource.toString();
}

export class ConversationChatInput extends EditorInput implements IEditorCloseHandler {

	static readonly TypeID = ConversationChatInputTypeId;

	private readonly _resource: URI;
	private readonly _isDefaultRoot: boolean;
	private readonly _title: string | undefined;

	constructor(resource: URI, options?: IConversationChatInputOptions) {
		super();
		this._resource = resource;
		const parsed = parseConversationChatResource(resource);
		this._isDefaultRoot = options?.isDefaultRoot ?? parsed?.isDefaultRoot ?? false;
		this._title = options?.title;
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
		return ConversationChatInputTypeId;
	}

	override get editorId(): string | undefined {
		return ConversationChatInputTypeId;
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
		return this._title ?? localize('conversationChatInputName', "Conversation");
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
				override: ConversationChatInputTypeId,
			}
		};
	}
}
