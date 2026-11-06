/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IProductChatOpenRoute } from '../../../services/chat/common/productChatOpenRoute.js';

/** The default window opens Conversation instead of a chat editor; the Agents window never loads this. */
export class ProductChatOpenRoute implements IProductChatOpenRoute {

	declare readonly _serviceBrand: undefined;

	constructor(
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
	) { }

	openInstead(): boolean {
		return !this.environmentService.isSessionsWindow;
	}
}
