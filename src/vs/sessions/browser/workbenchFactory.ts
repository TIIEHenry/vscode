/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isFullscreen } from '../../base/browser/browser.js';
import { mainWindow } from '../../base/browser/window.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { SyncDescriptor } from '../../platform/instantiation/common/descriptors.js';
import { ServiceCollection } from '../../platform/instantiation/common/serviceCollection.js';
import { ILogService } from '../../platform/log/common/log.js';
import { DOCK_DETAIL_PANEL_SETTING } from '../common/sessionConfig.js';
import { isSessionsPhoneViewport, measureSessionsWorkbenchHost } from './layoutPolicy.js';
import { SinglePaneWorkbench } from './singlePaneWorkbench.js';
import { IWorkbenchOptions, Workbench } from './workbench.js';

/**
 * Creates the Agents window workbench, choosing the single-pane variant when the
 * detail-panel setting is enabled on a non-phone viewport. Fixed at construction —
 * toggling the setting requires a window reload.
 */
export function createSessionsWorkbench(parent: HTMLElement, options: IWorkbenchOptions | undefined, serviceCollection: ServiceCollection, logService: ILogService): Workbench {
	const configurationService = serviceCollection.get(IConfigurationService);
	const { width } = measureSessionsWorkbenchHost(parent, isFullscreen(mainWindow));
	const isPhoneLayout = isSessionsPhoneViewport(width);
	const singlePane = !(configurationService instanceof SyncDescriptor)
		&& !isPhoneLayout
		&& configurationService.getValue<boolean>(DOCK_DETAIL_PANEL_SETTING) === true;
	return singlePane
		? new SinglePaneWorkbench(parent, options, serviceCollection, logService)
		: new Workbench(parent, options, serviceCollection, logService);
}
