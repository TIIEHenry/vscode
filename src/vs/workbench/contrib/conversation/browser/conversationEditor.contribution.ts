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
import { ConversationChatInput, ConversationChatInputTypeId } from './conversationChatInput.js';
import { ConversationEditorPane } from './conversationEditorPane.js';

class ConversationChatInputSerializer implements IEditorSerializer {

	canSerialize(input: EditorInput): input is ConversationChatInput {
		return input instanceof ConversationChatInput;
	}

	serialize(input: ConversationChatInput): string | undefined {
		return JSON.stringify({
			resource: input.resource.toString(),
			isDefaultRoot: input.isDefaultRoot,
		});
	}

	deserialize(instantiationService: IInstantiationService, serialized: string): ConversationChatInput | undefined {
		try {
			const parsed = JSON.parse(serialized) as { resource: string; isDefaultRoot?: boolean };
			return instantiationService.createInstance(ConversationChatInput, URI.parse(parsed.resource), { isDefaultRoot: parsed.isDefaultRoot });
		} catch {
			return undefined;
		}
	}
}

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		ConversationEditorPane,
		ConversationEditorPane.ID,
		'Conversation',
	),
	[new SyncDescriptor(ConversationChatInput)],
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(
	ConversationChatInputTypeId,
	ConversationChatInputSerializer,
);
