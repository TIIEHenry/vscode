/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const IProductWindowProfile = createDecorator<IProductWindowProfile>('productWindowProfile');

/**
 * What the product window looks like to Settings and Customizations. Registered by
 * `productShell.contribution.ts`, which both window entries load, so the Agents
 * window can resolve it too.
 */
export interface IProductWindowProfile {
	readonly _serviceBrand: undefined;

	/** `IWorkbenchEnvironmentService.isSessionsWindow`; not inferred from loaded contributions. */
	readonly isSessionsWindow: boolean;

	/** Only UA Client categories or exclusive ID filters can use the compact Client layout. */
	isClientSettingsView(query: string, categoryId: string | undefined): boolean;
}
