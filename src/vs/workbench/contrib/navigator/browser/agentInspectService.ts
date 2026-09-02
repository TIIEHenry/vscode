/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { AgentInspectTarget, IAgentInspectService } from '../common/agentInspect.js';

export class AgentInspectService extends Disposable implements IAgentInspectService {

	declare readonly _serviceBrand: undefined;

	private target: AgentInspectTarget | undefined;

	private readonly _onDidChangeTarget = this._register(new Emitter<AgentInspectTarget | undefined>());
	readonly onDidChangeTarget = this._onDidChangeTarget.event;

	getTarget(): AgentInspectTarget | undefined {
		return this.target;
	}

	setTarget(target: AgentInspectTarget | undefined): void {
		if (this.target === target) {
			return;
		}
		this.target = target;
		this._onDidChangeTarget.fire(this.target);
	}
}

registerSingleton(IAgentInspectService, AgentInspectService, InstantiationType.Delayed);
