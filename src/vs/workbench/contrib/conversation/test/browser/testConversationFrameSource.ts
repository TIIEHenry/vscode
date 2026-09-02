/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { SyncChrome } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { ConversationSessionViewProjection } from '../../browser/conversationSessionView.js';
import { ConversationStubFrameSource } from '../../browser/conversationStubFrameSource.js';
import { ConversationStubModel } from '../../browser/conversationStubModel.js';

/**
 * Test-only frame source (stream-timeline §3.6 / S3).
 *
 * Extends the product stub source so browser tests can opt into non-idle
 * `SyncChrome` (e.g. `live`) without teaching the product stub to lie.
 */
export class TestConversationFrameSource extends ConversationStubFrameSource {

	private readonly syncOverrides = new Map<string, SyncChrome>();

	constructor(
		model: ConversationStubModel,
		onSessionChanged: (sessionId: string) => void,
	) {
		super(model, onSessionChanged);
	}

	setSessionSync(sessionId: string, sync: SyncChrome): void {
		this.syncOverrides.set(sessionId, sync);
		this.refresh(sessionId);
	}

	clearSessionSync(sessionId: string): void {
		this.syncOverrides.delete(sessionId);
		this.refresh(sessionId);
	}

	override project(sessionId: string): ConversationSessionViewProjection {
		const base = super.project(sessionId);
		const sync = this.syncOverrides.get(sessionId);
		if (!sync) {
			return base;
		}
		return {
			...base,
			snapshot: {
				...base.snapshot,
				sync,
			},
		};
	}
}
