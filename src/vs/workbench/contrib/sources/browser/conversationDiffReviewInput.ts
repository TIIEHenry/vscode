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
import { ISourcesChangeIdentity } from '../common/sourcesChangeRef.js';

export class ConversationDiffReviewInput extends EditorInput {

	static readonly TypeID = ConversationDiffReviewInputTypeId;

	private readonly _resource: URI;
	private readonly _modified: URI;
	private readonly _original: URI | undefined;
	private readonly _groupId: string;
	private readonly _origin: ISourcesChangeIdentity['origin'];
	private readonly _sessionId: string | undefined;
	private readonly _gitPath: string | undefined;
	private readonly _indexState: string | undefined;
	private readonly _kind: string | undefined;
	/** S1 load generation for this instance. Not part of `matches()`. */
	private _loadGeneration = 0;

	constructor(modified: URI, original?: URI, groupId: string = '', identity?: ISourcesChangeIdentity) {
		super();
		this._modified = modified;
		this._original = original;
		this._groupId = groupId;
		this._origin = identity?.origin;
		this._sessionId = identity?.sessionId;
		this._gitPath = identity?.gitPath;
		this._indexState = identity?.indexState;
		this._kind = identity?.kind;
		this._resource = getConversationDiffReviewResource(modified, original, groupId);
	}

	get modified(): URI {
		return this._modified;
	}

	get original(): URI | undefined {
		return this._original;
	}

	get groupId(): string {
		return this._groupId;
	}

	get origin(): ISourcesChangeIdentity['origin'] {
		return this._origin;
	}

	get sessionId(): string | undefined {
		return this._sessionId;
	}

	get gitPath(): string | undefined {
		return this._gitPath;
	}

	get indexState(): string | undefined {
		return this._indexState;
	}

	get kind(): string | undefined {
		return this._kind;
	}

	get loadGeneration(): number {
		return this._loadGeneration;
	}

	assignLoadGeneration(generation: number): void {
		this._loadGeneration = generation;
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
			return this._modified.toString() === other._modified.toString()
				&& (this._original?.toString() ?? '') === (other._original?.toString() ?? '')
				&& this._groupId === other._groupId
				&& (this._gitPath ?? '') === (other._gitPath ?? '');
		}

		if (!isEditorInput(other) && isResourceEditorInput(other) && other.resource) {
			const parsed = parseConversationDiffReviewResource(other.resource);
			return parsed?.modified.toString() === this._modified.toString()
				&& (parsed.original?.toString() ?? '') === (this._original?.toString() ?? '')
				&& parsed.groupId === this._groupId;
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
