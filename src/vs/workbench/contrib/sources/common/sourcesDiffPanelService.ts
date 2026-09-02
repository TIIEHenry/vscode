/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ISourcesChangeRef } from './sourcesChangeRef.js';

export const ISourcesDiffPanelService = createDecorator<ISourcesDiffPanelService>('sourcesDiffPanelService');

export interface ISourcesDiffPanelService {
	readonly _serviceBrand: undefined;

	show(ref: ISourcesChangeRef): Promise<void>;
	clear(): void;
}
