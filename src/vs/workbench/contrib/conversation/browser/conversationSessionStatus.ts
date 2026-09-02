/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { ConversationStubSession } from './conversationStubModel.js';

/** Pure mapping from stub session metadata to StatusBar label text. */
export function getConversationSessionStatusText(session: ConversationStubSession | undefined): string {
	const title = session?.title?.trim();
	if (!title) {
		return localize('conversationStatus.noSession', "No session");
	}
	return title;
}

/** Honest engine StatusBar copy — no Copilot setup; connected state from roster `isEngineConnected()`. */
export function getConversationEngineStatusText(isConnected = false): string {
	if (isConnected) {
		return localize('conversationStatus.engineConnected', "Engine connected");
	}
	return localize('conversationStatus.engineNotConnected', "Engine not connected");
}

/** Honest session-model echo when Conversation seat is hidden (matches Dock phrasing). */
export function getConversationModelEchoStatusText(): string {
	return localize('conversationStatus.noModel', "No model");
}

/**
 * UI-INV-14: StatusBar `session-model` echo only when Conversation part is hidden;
 * Dock owns model while the seat is visible.
 */
export function shouldShowConversationModelEchoInStatusBar(isConversationPartVisible: boolean): boolean {
	return !isConversationPartVisible;
}

/** Show and focus the center ConversationPart (default Code window shell). */
export function showConversationPart(accessor: ServicesAccessor): void {
	const layoutService = accessor.get(IWorkbenchLayoutService);
	const conversationPartService = accessor.get(IConversationPartService);
	if (!layoutService.isVisible(Parts.CONVERSATION_PART)) {
		layoutService.setPartHidden(false, Parts.CONVERSATION_PART);
	}
	conversationPartService.focus();
}
