/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { IDisposable } from '../../../base/common/lifecycle.js';
import type { SessionViewSnapshot, ViewEffect, ViewFrame } from './sessionView/index.js';

export interface IConversationSessionViewLease extends IDisposable {
	readonly sessionId: string;
	readonly snapshot: SessionViewSnapshot;
	readonly attribution: ReadonlyMap<string, ItemAttribution>;
	readonly onDidApplyFrame: Event<ConversationViewFrameApplied>;
	post(msg: ConversationWriteMessage): PostOutcome;
	requestResync(): void;
}

export interface ItemAttribution {
	readonly role: 'user' | 'assistant' | 'system' | 'tool';
	readonly agentId?: string;
	readonly agentPath?: readonly string[];
}

export type AttributionPatch =
	| { readonly op: 'upsertAttribution'; readonly itemId: string; readonly attribution: ItemAttribution }
	| { readonly op: 'removeAttribution'; readonly itemId: string };

export interface ConversationViewFrame {
	readonly frame: ViewFrame;
	readonly attribution?: readonly AttributionPatch[];
}

export type ConversationViewFrameApplied =
	| { readonly kind: 'baseline' }
	| { readonly kind: 'patches'; readonly changedIds: ReadonlySet<string> }
	| { readonly kind: 'effects'; readonly effects: readonly ViewEffect[] };

export type ConversationWriteMessage =
	| { readonly kind: 'submitInput'; readonly text: string }
	| { readonly kind: 'permissionRespond'; readonly requestId: string; readonly decision: 'allow' | 'deny' }
	| { readonly kind: 'questionRespond'; readonly requestId: string; readonly answers: Readonly<Record<string, string>> }
	| { readonly kind: 'clientToolRespond'; readonly requestId: string; readonly resultJson: string };

export type PostOutcome =
	| { readonly accepted: true; readonly correlation: { readonly id: string } }
	| {
		readonly accepted: false;
		readonly reason: 'mailbox_full' | 'no_such_session' | 'not_authenticated';
	};
