/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const IProductChatOpenRoute = createDecorator<IProductChatOpenRoute>('productChatOpenRoute');

/**
 * Where the product sends "open Chat". Only the default window registers an
 * implementation (from the conversation contribution); the Agents window does
 * not, so its chat opening keeps the upstream path.
 */
export interface IProductChatOpenRoute {
	readonly _serviceBrand: undefined;

	/**
	 * `true` when opening a chat editor or session must show and focus the
	 * Conversation part instead of opening the chat. Callers then stop.
	 */
	openInstead(): boolean;
}
