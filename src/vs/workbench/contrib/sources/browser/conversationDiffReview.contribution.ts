/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { IEditorSerializer, IEditorFactoryRegistry, EditorExtensions } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ConversationDiffReviewInputTypeId } from '../common/conversationDiffReviewInput.js';
import { ConversationDiffReviewInput } from './conversationDiffReviewInput.js';
import { ConversationDiffReviewPane } from './conversationDiffReviewPane.js';

class ConversationDiffReviewInputSerializer implements IEditorSerializer {

	canSerialize(input: EditorInput): input is ConversationDiffReviewInput {
		return input instanceof ConversationDiffReviewInput;
	}

	serialize(input: ConversationDiffReviewInput): string | undefined {
		return JSON.stringify({
			modified: input.modified.toString(),
			original: input.original?.toString(),
		});
	}

	deserialize(instantiationService: IInstantiationService, serialized: string): ConversationDiffReviewInput | undefined {
		try {
			const parsed = JSON.parse(serialized) as { modified: string; original?: string };
			return instantiationService.createInstance(
				ConversationDiffReviewInput,
				URI.parse(parsed.modified),
				parsed.original ? URI.parse(parsed.original) : undefined,
			);
		} catch {
			return undefined;
		}
	}
}

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		ConversationDiffReviewPane,
		ConversationDiffReviewPane.ID,
		'Diff Review',
	),
	[new SyncDescriptor(ConversationDiffReviewInput)],
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(
	ConversationDiffReviewInputTypeId,
	ConversationDiffReviewInputSerializer,
);
