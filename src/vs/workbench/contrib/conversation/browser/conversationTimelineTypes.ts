/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from '../../../../base/common/lifecycle.js';
import type { ConversationQuestionRespondAnswers } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { ProcessFoldSpan } from './conversationProcessFoldModel.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import { IConversationTurnContentAdapter } from './conversationTurnContentAdapter.js';

export type ConversationTimelineItemVariant = 'turn' | 'process-fold';

export interface ConversationTimelineItem {
	readonly turn: ConversationStubTurn;
	readonly variant: ConversationTimelineItemVariant;
	readonly processFoldSpan?: ProcessFoldSpan;
}

export interface IConversationTimelineTreeOptions {
	readonly onResolveConfirmation?: (turnId: string, status: 'allowed' | 'skipped') => void;
	readonly onQuestionRespond?: (turnId: string, requestId: string, answers: ConversationQuestionRespondAnswers, customText?: string) => void;
	readonly onCopyTurn?: (turnId: string, text: string) => void;
	readonly onDeleteTurn?: (turnId: string) => void;
	readonly onEditUserTurn?: (turnId: string) => void;
	readonly onViewInTrajectory?: (turnId: string) => void;
	readonly onCancelToolCall?: (turn: ConversationStubTurn) => void;
	readonly onReviewNavClick?: (paths: readonly string[]) => void;
	readonly onOpenVisualizeFullscreen?: (source: string, title?: string) => void;
	readonly contentAdapter?: IConversationTurnContentAdapter;
	readonly paddingBottom?: number;
	readonly showLiveChrome?: () => boolean;
	readonly showToolInvocationDetails?: () => boolean;
}

export interface ITurnTemplateData {
	readonly container: HTMLElement;
	readonly disposables: DisposableStore;
}
