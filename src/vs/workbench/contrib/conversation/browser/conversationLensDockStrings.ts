/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';

/** Honest Input Dock copy — no engine, no Copilot entitlement CTAs. */
export const conversationLensDockEngineNotConnected = localize('conversationLens.dockEngineNotConnected', "Engine not connected");
export const conversationLensDockInboxNoQueue = localize('conversationLens.inboxNoQueue', "No queue");
export const conversationLensDockGoal = localize('conversationLens.dockGoal', "Goal");
export const conversationLensDockNoGoal = localize('conversationLens.dockNoGoal', "No goal");
export const conversationLensDockNoModel = localize('conversationLens.dockNoModel', "No model");
export const conversationLensDockAddTitle = localize('conversationLens.dockAddTitle', "Add");
export const conversationLensDockNoAttachments = localize('conversationLens.dockNoAttachments', "No attachments");
export const conversationLensDockTuneTitle = localize('conversationLens.dockTuneTitle', "Tool options");
export const conversationLensDockNoTools = localize('conversationLens.dockNoTools', "No tools configured");
export const conversationLensDockPermissionLabel = localize('conversationLens.dockPermissionLabel', "Permission");
export const conversationLensDockPermissionAsk = localize('conversationLens.dockPermissionAsk', "Ask");
export const conversationLensDockAgentLabel = localize('conversationLens.dockAgentLabel', "Agent");
export const conversationLensDockNoAgent = localize('conversationLens.dockNoAgent', "No agent");
export const conversationLensDockStubAgent = localize('conversationLens.dockStubAgent', "Stub agent");
export const conversationLensDockRouteLabel = localize('conversationLens.dockRouteLabel', "Route");
export const conversationLensDockNoRoute = localize('conversationLens.dockNoRoute', "No route");
export const conversationLensDockRouteBalanced = localize('conversationLens.dockRouteBalanced', "Balanced");
export const conversationLensDockRouteSpeed = localize('conversationLens.dockRouteSpeed', "Speed");
export const conversationLensDockRouteQuality = localize('conversationLens.dockRouteQuality', "Quality");
export const conversationLensDockMoreTitle = localize('conversationLens.dockMoreTitle', "More");
export const conversationLensDockTemplatesTitle = localize('conversationLens.dockTemplatesTitle', "Templates");
export const conversationLensDockNoTemplates = localize('conversationLens.dockNoTemplates', "No templates");
export const conversationLensDockMaximizeInput = localize('conversationLens.dockMaximizeInput', "Maximize input");
export const conversationLensDockMicTitle = localize('conversationLens.dockMicTitle', "Voice input");
export const conversationLensDockMicNotAvailable = localize('conversationLens.dockMicNotAvailable', "Voice input unavailable without engine");
/** Composer bottom-bar control hit height (px). */
export const conversationLensDockControlHeightPx = 32;
export const conversationLensDockRestoreTimeline = localize('conversationLens.dockRestoreTimeline', "Restore timeline");
export const conversationLensDockStop = localize('conversationLens.dockStop', "Stop");
export const conversationLensDockStopNotGenerating = localize('conversationLens.dockStopNotGenerating', "Not generating");
export const conversationLensDockPlaceholder = localize('conversationLens.dockPlaceholder', "Message");

/** Toggled on ConversationPart slot hosts when Input Maximize is active (Desktop §8.3.11). */
export const conversationLensInputMaximizedClass = 'conversation-lens-input-maximized';

/** PreFirst (no visible messages): centered composer cluster in the reading column. */
export const conversationLensPhasePreFirstClass = 'conversation-lens-phase-prefirst';
export const conversationLensPrefirstHeroClass = 'conversation-lens-prefirst-hero';
/** Hides the dock slot while PreFirst composer lives in the reading column. */
export const conversationLensPhasePreFirstDockHiddenClass = 'conversation-lens-phase-prefirst-dock-hidden';
