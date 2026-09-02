/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { EditorInputCapabilities, IUntypedEditorInput, isEditorInput, isResourceEditorInput } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import {
	ConversationDiffReviewInputTypeId,
	getConversationDiffReviewResource,
	parseConversationDiffReviewResource,
} from '../common/conversationDiffReviewInput.js';

export class ConversationDiffReviewInput extends EditorInput {

	static readonly TypeID = ConversationDiffReviewInputTypeId;

	private readonly _resource: URI;
	private readonly _modified: URI;
	private readonly _original: URI | undefined;

	constructor(modified: URI, original?: URI) {
		super();
		this._modified = modified;
		this._original = original;
		this._resource = getConversationDiffReviewResource(modified, original);
	}

	get modified(): URI {
		return this._modified;
	}

	get original(): URI | undefined {
		return this._original;
	}

	override get typeId(): string {
		return ConversationDiffReviewInputTypeId;
	}

	override get editorId(): string | undefined {
		return ConversationDiffReviewInputTypeId;
	}

	override get resource(): URI {
		return this._resource;
	}

	override get capabilities(): EditorInputCapabilities {
		return super.capabilities | EditorInputCapabilities.Readonly;
	}

	override getName(): string {
		return basename(this._modified) || localize('conversationDiffReviewInputName', "Diff Review");
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}

		if (other instanceof ConversationDiffReviewInput) {
			return this._modified.toString() === other._modified.toString();
		}

		if (!isEditorInput(other) && isResourceEditorInput(other) && other.resource) {
			const parsed = parseConversationDiffReviewResource(other.resource);
			return parsed?.modified.toString() === this._modified.toString();
		}

		return false;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: this._resource,
			options: {
				override: ConversationDiffReviewInputTypeId,
			},
		};
	}
}
