/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import type { ConversationViewFrameApplied } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { ViewEffect } from '../../../../platform/universeAgent/common/sessionView/index.js';

const FRAME_COALESCE_MS = 16;

/**
 * Merges same-frame session view applies before the timeline consumes them (plan §3.4).
 */
export class ConversationSessionViewFrameCoalescer extends Disposable {

	private pending: ConversationViewFrameApplied[] = [];
	private handle: ReturnType<typeof setTimeout> | undefined;

	constructor(private readonly flush: (merged: ConversationViewFrameApplied) => void) {
		super();
	}

	push(applied: ConversationViewFrameApplied): void {
		if (applied.kind === 'baseline') {
			if (this.handle !== undefined) {
				clearTimeout(this.handle);
				this.handle = undefined;
			}
			this.pending = [];
			this.flush(applied);
			return;
		}
		this.pending.push(applied);
		if (this.handle !== undefined) {
			return;
		}
		this.handle = setTimeout(() => {
			this.handle = undefined;
			const batch = this.pending;
			this.pending = [];
			this.flush(mergeSessionViewFrames(batch));
		}, FRAME_COALESCE_MS);
	}

	override dispose(): void {
		if (this.handle !== undefined) {
			clearTimeout(this.handle);
			this.handle = undefined;
		}
		this.pending = [];
		super.dispose();
	}
}

export function mergeSessionViewFrames(frames: readonly ConversationViewFrameApplied[]): ConversationViewFrameApplied {
	if (frames.length === 0) {
		return { kind: 'patches', changedIds: new Set() };
	}
	if (frames.some(frame => frame.kind === 'baseline')) {
		return { kind: 'baseline' };
	}

	const effects: ViewEffect[] = [];
	const changedIds = new Set<string>();
	for (const frame of frames) {
		if (frame.kind === 'effects') {
			effects.push(...frame.effects);
		} else if (frame.kind === 'patches') {
			for (const id of frame.changedIds) {
				changedIds.add(id);
			}
		}
	}

	if (effects.length > 0) {
		return { kind: 'effects', effects };
	}
	return { kind: 'patches', changedIds };
}
