/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { editorBackground, registerColor } from '../../../../platform/theme/common/colorRegistry.js';

/** Canvas behind the reading column. The composer dock uses the same color so the input box sits on it. */
export const conversationBackground = registerColor(
	'conversation.background',
	{ dark: editorBackground, light: editorBackground, hcDark: editorBackground, hcLight: editorBackground },
	localize('conversationBackground', "Background of the conversation canvas and composer dock.")
);
