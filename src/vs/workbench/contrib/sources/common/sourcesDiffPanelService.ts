/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ISourcesChangeRef } from './sourcesChangeRef.js';

export const ISourcesDiffPanelService = createDecorator<ISourcesDiffPanelService>('sourcesDiffPanelService');

export interface ISourcesDiffPanelService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeRef: Event<ISourcesChangeRef | undefined>;

	getCurrentRef(): ISourcesChangeRef | undefined;
	show(ref: ISourcesChangeRef): Promise<boolean>;
	/** Generation for the `show()` that is waiting on this paint, if any. */
	getPendingRenderGeneration(): number | undefined;
	attachPendingRender(generation: number, render: Promise<void>): void;
	clear(): void;
}
