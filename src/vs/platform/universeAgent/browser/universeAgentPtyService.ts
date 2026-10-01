/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../instantiation/common/extensions.js';
import { IUniverseAgentPty, type UniverseAgentPtyClientFrame, type UniverseAgentPtyServerFrame } from '../common/universeAgentPty.js';

/**
 * Web has no electron-main Pty bridge. `isBridgeAvailable()` is false so
 * Preview keeps `workbench.action.createTerminalEditor`.
 */
export class WebUniverseAgentPty implements IUniverseAgentPty {

	declare readonly _serviceBrand: undefined;

	isBridgeAvailable(): Promise<boolean> {
		return Promise.resolve(false);
	}

	openStream(): Promise<string> {
		return Promise.reject(new Error('Pty bridge is unavailable'));
	}

	sendClientMessage(_streamId: string, _frame: UniverseAgentPtyClientFrame): Promise<void> {
		return Promise.reject(new Error('Pty bridge is unavailable'));
	}

	onDynamicPtyServerMessage(_streamId: string): Event<UniverseAgentPtyServerFrame> {
		return Event.None;
	}

	disposeStream(_streamId: string): Promise<void> {
		return Promise.resolve();
	}
}

registerSingleton(IUniverseAgentPty, WebUniverseAgentPty, InstantiationType.Delayed);
