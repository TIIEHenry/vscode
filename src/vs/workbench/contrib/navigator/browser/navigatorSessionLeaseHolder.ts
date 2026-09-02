/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import type { IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { IConversationRosterService } from '../../conversation/browser/conversationStubService.js';

export class NavigatorSessionLeaseHolder extends Disposable {

	private readonly leaseStore = this._register(new DisposableStore());
	private lease: IConversationSessionViewLease | undefined;
	private sessionId: string | undefined;
	private visible = false;

	constructor(
		private readonly rosterService: IConversationRosterService,
		private readonly onLeaseChanged: () => void,
	) {
		super();
		this._register(rosterService.onDidChangeActiveSession(() => this.refreshLease()));
	}

	setVisible(visible: boolean): void {
		if (this.visible === visible) {
			return;
		}
		this.visible = visible;
		this.refreshLease();
	}

	getLease(): IConversationSessionViewLease | undefined {
		return this.lease;
	}

	getActiveSessionId(): string | undefined {
		return this.sessionId;
	}

	private refreshLease(): void {
		if (!this.visible) {
			this.clearLease();
			return;
		}
		const sessionId = this.rosterService.getActiveSessionId();
		if (this.lease && this.sessionId === sessionId) {
			return;
		}
		this.clearLease();
		this.sessionId = sessionId;
		const lease = this.rosterService.acquireSessionView(sessionId);
		this.lease = lease;
		this.leaseStore.add(lease);
		this.leaseStore.add(lease.onDidApplyFrame(() => this.onLeaseChanged()));
		this.onLeaseChanged();
	}

	private clearLease(): void {
		this.leaseStore.clear();
		this.lease = undefined;
		this.sessionId = undefined;
	}
}
