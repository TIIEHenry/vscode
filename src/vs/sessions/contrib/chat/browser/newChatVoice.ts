/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getActiveWindow } from '../../../../base/browser/dom.js';
import { ActionRunner, IAction } from '../../../../base/common/actions.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { IObservable, autorun, derived, derivedOpts, observableFromEvent, observableValue } from '../../../../base/common/observable.js';
import { isEqual } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { MenuId, MenuItemAction, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { HiddenItemStrategy, MenuWorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { SegmentedVoiceInputModePillInactive } from '../../../../workbench/contrib/chat/browser/voiceInputMode/voiceInputModeContextKeys.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService, createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { IMicCaptureService } from '../../../../workbench/contrib/chat/browser/voiceClient/micCaptureService.js';
import { ITtsPlaybackService } from '../../../../workbench/contrib/chat/browser/voiceClient/ttsPlaybackService.js';
import { IVoiceSessionController } from '../../../../workbench/contrib/chat/browser/voiceClient/voiceSessionController.js';
import { AgentsVoiceSettingId, AGENTS_VOICE_ENABLED } from '../../../../workbench/contrib/agentsVoice/common/agentsVoice.js';
import { IChatWidgetService } from '../../../../workbench/contrib/chat/browser/chat.js';
import { VoiceModeActionViewItem } from '../../../../workbench/contrib/chat/browser/voiceClient/voiceModeActionViewItem.js';
import { ILanguageModelChatMetadataAndIdentifier } from '../../../../workbench/contrib/chat/common/languageModels.js';
import { ISessionsService } from '../../../services/sessions/browser/sessionsService.js';
import { setupVoiceInputDecorations } from './voiceInputDecorations.js';

/**
 * Stable resource for targeting the new-session composer before a session exists.
 * This keeps dictation on the composer so it creates a configured session.
 */
export const NEW_CHAT_VOICE_SENTINEL = URI.from({ scheme: 'sessions-voice', authority: 'new-chat', path: '/composer' });

/** Whether the shared voice transport belongs to the new-session composer. */
export function isNewChatVoiceSessionActive(connected: boolean, connecting: boolean, targetSession: URI | undefined, hasDraftTarget: boolean): boolean {
	return (connected || connecting) && targetSession === undefined && hasDraftTarget;
}

/** New-session composer APIs used by voice mode. */
export interface INewChatVoiceComposer {
	/** Fires when the composer input gains focus. */
	readonly onDidFocus: Event<void>;
	/**
	 * When true, this remains a voice target even with an active session.
	 * Otherwise, it targets only before any session exists.
	 */
	readonly routesWhileSessionActive?: boolean;
	/** Append `text` to the current draft and submit, creating the session. */
	sendQuery(text: string): void;
	/** Set `text` without submitting. */
	prefillInput(text: string): void;
	/** Focus the composer input. */
	focus(): void;
	/** Models currently offered by the composer. */
	getVoiceModels(): readonly ILanguageModelChatMetadataAndIdentifier[];
	/** Select a model by its exact frontend identifier. */
	selectVoiceModel(identifier: string): boolean;
}

export const INewChatVoiceTargetService = createDecorator<INewChatVoiceTargetService>('newChatVoiceTargetService');

/**
 * Tracks the active new-session composer for voice command routing.
 */
export interface INewChatVoiceTargetService {
	readonly _serviceBrand: undefined;
	/** The most recent focused/registered mounted composer. */
	readonly activeComposer: IObservable<INewChatVoiceComposer | undefined>;
	/** The input resource currently selected for voice decorations. */
	readonly currentVoiceInputResource: IObservable<URI | undefined>;
	/** Register a composer as a voice target; dispose to remove it. */
	registerComposer(composer: INewChatVoiceComposer): IDisposable;
	/** Promote `composer` to the active voice target. */
	setActive(composer: INewChatVoiceComposer): void;
}

export class NewChatVoiceTargetService extends Disposable implements INewChatVoiceTargetService {
	declare readonly _serviceBrand: undefined;

	private readonly _composers = new Set<INewChatVoiceComposer>();
	private readonly _activeComposer = observableValue<INewChatVoiceComposer | undefined>(this, undefined);
	readonly activeComposer: IObservable<INewChatVoiceComposer | undefined> = this._activeComposer;

	/** Session resource of the last-focused chat widget (the last-focused input). */
	private readonly _focusedSessionResource: IObservable<URI | undefined>;

	readonly currentVoiceInputResource: IObservable<URI | undefined>;

	constructor(
		@ISessionsService private readonly sessionsService: ISessionsService,
		@IChatWidgetService private readonly chatWidgetService: IChatWidgetService,
	) {
		super();

		this._focusedSessionResource = observableFromEvent(this,
			this.chatWidgetService.onDidChangeFocusedSession,
			() => this.chatWidgetService.lastFocusedWidget?.viewModel?.sessionResource);

		this.currentVoiceInputResource = derivedOpts({ owner: this, equalsFn: isEqual }, reader => {
			const composer = this._activeComposer.read(reader);
			const active = this.sessionsService.activeSession.read(reader);
			const created = active?.isCreated.read(reader) ? active.activeChat.read(reader)?.resource : undefined;
			// The composer wins while it opts in (or before a session exists),
			// matching `_chat.voice.getCurrentSession` routing.
			if (composer && (composer.routesWhileSessionActive || !created)) {
				return NEW_CHAT_VOICE_SENTINEL;
			}
			if (created) {
				return created;
			}
			return this._focusedSessionResource.read(reader);
		});
	}

	registerComposer(composer: INewChatVoiceComposer): IDisposable {
		this._composers.add(composer);
		this._activeComposer.set(composer, undefined);
		return toDisposable(() => {
			this._composers.delete(composer);
			if (this._activeComposer.get() === composer) {
				// Fall back to the last remaining composer.
				const remaining = [...this._composers];
				this._activeComposer.set(remaining.length ? remaining[remaining.length - 1] : undefined, undefined);
			}
		});
	}

	setActive(composer: INewChatVoiceComposer): void {
		if (this._composers.has(composer)) {
			this._activeComposer.set(composer, undefined);
		}
	}
}

registerSingleton(INewChatVoiceTargetService, NewChatVoiceTargetService, InstantiationType.Delayed);

// --- Voice toolbar menu for the new-session composer ---
// The composer has a custom toolbar, so `MenuId.ChatExecute` voice actions do
// not appear here. Re-surface them with composer-scoped visibility.

export const SessionsNewChatVoiceMenu = new MenuId('SessionsNewChatVoiceMenu');

const WHEN_VOICE_ENABLED = AGENTS_VOICE_ENABLED;
const WHEN_VOICE_BUTTON_SHOWN = ContextKeyExpr.notEquals(`config.${AgentsVoiceSettingId.ShowButton}`, false);
const WHEN_CONNECTING = ContextKeyExpr.equals('agentsVoiceConnecting', true);
const WHEN_LISTENING = ContextKeyExpr.equals('agentsVoiceListening', true);
const WHEN_CONNECTED = ContextKeyExpr.equals('agentsVoiceConnected', true);
const WHEN_INITIATED_HERE = ContextKeyExpr.equals('agentsVoiceInitiatedHere', true);
const WHEN_VOICE_SURFACE = ContextKeyExpr.equals('newChatVoiceSurface', true);
// Hide Voice Mode while dictation is active (recording or the model is loading)
// so the two mic affordances never compete, mirroring `MenuId.ChatExecute`.
const WHEN_NOT_DICTATING = ContextKeyExpr.and(
	ContextKeyExpr.has('chatSpeechToTextRecording').negate(),
	ContextKeyExpr.has('chatSpeechToTextPreparing').negate(),
);

// Hide the standalone voice controls when the segmented voice/dictation pill applies
// on this composer — the pill supersedes them.
const WHEN_NO_SEGMENTED_PILL = SegmentedVoiceInputModePillInactive;

MenuRegistry.appendMenuItem(SessionsNewChatVoiceMenu, {
	command: { id: 'agentsVoice.connecting', title: localize('agentsVoice.connecting', "Connecting..."), icon: Codicon.loadingCompact },
	when: ContextKeyExpr.and(WHEN_VOICE_ENABLED, WHEN_VOICE_BUTTON_SHOWN, WHEN_CONNECTING, WHEN_INITIATED_HERE, WHEN_NO_SEGMENTED_PILL),
	group: 'navigation',
	order: -10,
});

MenuRegistry.appendMenuItem(SessionsNewChatVoiceMenu, {
	command: { id: 'agentsVoice.startVoiceInChat', title: localize('agentsVoice.startVoiceInChat', "Voice Mode"), icon: Codicon.voiceModeCompact },
	when: ContextKeyExpr.and(WHEN_VOICE_ENABLED, WHEN_VOICE_BUTTON_SHOWN, WHEN_VOICE_SURFACE, WHEN_LISTENING.negate(), WHEN_CONNECTING.negate(), WHEN_NOT_DICTATING, WHEN_NO_SEGMENTED_PILL),
	group: 'navigation',
	order: -10,
});

MenuRegistry.appendMenuItem(SessionsNewChatVoiceMenu, {
	command: { id: 'agentsVoice.pttStopInChat', title: localize('agentsVoice.pttStopInChat', "Voice Mode: Stop Recording"), icon: Codicon.voiceModeCompact },
	when: ContextKeyExpr.and(WHEN_VOICE_ENABLED, WHEN_VOICE_BUTTON_SHOWN, WHEN_LISTENING, WHEN_INITIATED_HERE, WHEN_NO_SEGMENTED_PILL),
	group: 'navigation',
	order: -10,
});

MenuRegistry.appendMenuItem(SessionsNewChatVoiceMenu, {
	command: { id: 'agentsVoice.openSettings', title: localize('agentsVoice.openSettings', "Voice Mode Settings"), icon: Codicon.settingsGear },
	when: ContextKeyExpr.and(WHEN_VOICE_ENABLED, WHEN_VOICE_BUTTON_SHOWN, WHEN_CONNECTED, WHEN_INITIATED_HERE, WHEN_NO_SEGMENTED_PILL),
	group: 'navigation',
	order: -9.5,
});

MenuRegistry.appendMenuItem(SessionsNewChatVoiceMenu, {
	command: { id: 'agentsVoice.disconnect', title: localize('agentsVoice.disconnect', "Disconnect Voice Mode"), icon: Codicon.debugDisconnectCompact },
	when: ContextKeyExpr.and(WHEN_VOICE_ENABLED, WHEN_VOICE_BUTTON_SHOWN, WHEN_CONNECTED, WHEN_INITIATED_HERE, WHEN_NO_SEGMENTED_PILL),
	group: 'navigation',
	order: -9,
});

/** Where a new-session voice toolbar action runs. `passthrough` is anything this composer does not own. */
export function newChatVoiceToolbarIntent(actionId: string): 'ignore' | 'start' | 'stop' | 'settings' | 'disconnect' | 'passthrough' {
	switch (actionId) {
		case 'agentsVoice.connecting':
			return 'ignore';
		case 'agentsVoice.startVoiceInChat':
			return 'start';
		case 'agentsVoice.pttStopInChat':
			return 'stop';
		case 'agentsVoice.openSettings':
			return 'settings';
		case 'agentsVoice.disconnect':
			return 'disconnect';
		default:
			return 'passthrough';
	}
}

export interface INewChatVoiceControllerOptions {
	/** Container for the voice toolbar. */
	readonly toolbarContainer: HTMLElement;
	/** Input container for glow and transcript overlay. */
	readonly inputContainer: HTMLElement;
	/** Composer driven by voice. */
	readonly composer: INewChatVoiceComposer;
	/** Called with the number of rendered voice actions when they change. */
	readonly onDidChangeActions?: (actionCount: number) => void;
}

/**
 * Wires voice mode into a new-session composer: toolbar, scoped keys,
 * glow/transcript, and {@link INewChatVoiceTargetService} routing.
 */
export class NewChatVoiceController extends Disposable {

	private readonly _composer: INewChatVoiceComposer;

	constructor(
		options: INewChatVoiceControllerOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@INewChatVoiceTargetService private readonly targetService: INewChatVoiceTargetService,
		@IVoiceSessionController private readonly voiceSessionController: IVoiceSessionController,
		@ISessionsService sessionsService: ISessionsService,
		@ITtsPlaybackService ttsPlaybackService: ITtsPlaybackService,
		@IMicCaptureService micCaptureService: IMicCaptureService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IThemeService themeService: IThemeService,
		@IAccessibilityService accessibilityService: IAccessibilityService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();
		this._composer = options.composer;

		this._register(targetService.registerComposer(options.composer));
		this._register(options.composer.onDidFocus(() => targetService.setActive(options.composer)));

		// Keep voice toolbar gating scoped to this composer.
		const scopedContextKeyService = this._register(contextKeyService.createScoped(options.toolbarContainer));
		// True when this composer can show the mic button.
		const voiceSurfaceKey = scopedContextKeyService.createKey<boolean>('newChatVoiceSurface', false);
		// True when voice is active on this composer.
		const initiatedHereKey = scopedContextKeyService.createKey<boolean>('agentsVoiceInitiatedHere', false);
		const scopedInstantiationService = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, scopedContextKeyService])));

		const toolbar = this._register(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, options.toolbarContainer, SessionsNewChatVoiceMenu, {
			hiddenItemStrategy: HiddenItemStrategy.NoHide,
			// Clicks stay on this composer. MenuItemAction.run would execute the
			// shared command, which resolves the last focused chat widget.
			actionRunner: this._register(new NewChatVoiceToolbarActionRunner(this)),
			actionViewItemProvider: (action, itemOptions) => {
				// While listening the menu swaps the start action for the
				// push-to-talk stop action; cover both so the context menu
				// (Select Microphone / Disable Voice Mode) stays available.
				if ((action.id === 'agentsVoice.startVoiceInChat' || action.id === 'agentsVoice.pttStopInChat') && action instanceof MenuItemAction) {
					return scopedInstantiationService.createInstance(VoiceModeActionViewItem, action, itemOptions);
				}
				return undefined;
			},
		}));
		if (options.onDidChangeActions) {
			const onDidChangeActions = () => {
				let actionCount = 0;
				while (toolbar.getItemAction(actionCount)) {
					actionCount++;
				}
				options.onDidChangeActions?.(actionCount);
			};
			this._register(toolbar.onDidChangeMenuItems(onDidChangeActions));
			onDidChangeActions();
		}

		// Target the active composer before a session exists, or when it opts in
		// while a session is active. Gate on `isCreated` to exclude drafts.
		const isVoiceSurface = derived(reader => {
			const active = sessionsService.activeSession.read(reader);
			const hasCreatedSession = !!active && active.isCreated.read(reader);
			const isActiveComposer = targetService.activeComposer.read(reader) === options.composer;
			return (options.composer.routesWhileSessionActive || !hasCreatedSession) && isActiveComposer;
		});
		const isVoiceTarget = derived(reader => {
			const voiceActive = isNewChatVoiceSessionActive(
				voiceSessionController.isConnected.read(reader),
				voiceSessionController.isConnecting.read(reader),
				voiceSessionController.targetSession.read(reader),
				voiceSessionController.hasDraftTarget.read(reader),
			);
			return voiceActive && isVoiceSurface.read(reader);
		});
		this._register(autorun(reader => {
			voiceSurfaceKey.set(isVoiceSurface.read(reader));
			initiatedHereKey.set(isVoiceTarget.read(reader));
		}));

		this._register(setupVoiceInputDecorations({
			voiceSessionController,
			ttsPlaybackService,
			micCaptureService,
			configurationService,
			keybindingService,
			themeService,
			accessibilityService,
		}, {
			inputContainer: options.inputContainer,
			isActive: isVoiceTarget,
			getCurrentResource: () => NEW_CHAT_VOICE_SENTINEL,
			currentVoiceInputResource: targetService.currentVoiceInputResource,
		}));
	}

	/**
	 * Toolbar Voice Mode. Mirrors `agentsVoice.startVoiceInChat` for this
	 * composer: draft target, then connect / push-to-talk. Never asks the voice
	 * bridge for the last focused chat widget.
	 */
	async startFromToolbar(): Promise<void> {
		const activeWindow = getActiveWindow();
		this.voiceSessionController.setActiveWindow(activeWindow);
		// Capture hold mode before the first await. A toolbar click is not a
		// held chord, so this is undefined and the press is treated as a tap.
		const holdMode = this.keybindingService.enableKeybindingHoldMode('agentsVoice.startVoiceInChat');
		this.targetService.setActive(this._composer);
		this.voiceSessionController.setDraftTarget();

		const handsFree = this.configurationService.getValue<boolean>('agents.voice.handsFree') === true;
		const wasConnected = this.voiceSessionController.isConnected.get();
		if (!wasConnected) {
			await this.voiceSessionController.connect(activeWindow);
			if (this._store.isDisposed) {
				return;
			}
		}
		if (!holdMode && !handsFree && !wasConnected) {
			return;
		}

		this.voiceSessionController.pttDown();
		if (!holdMode) {
			this.voiceSessionController.pttUp();
			return;
		}
		await holdMode;
		if (!this._store.isDisposed) {
			this.voiceSessionController.pttUp();
		}
	}

	/** Stop recording and keep the voice session connected. */
	stopFromToolbar(): void {
		this.voiceSessionController.stopListening();
	}

	disconnectFromToolbar(): void {
		this.voiceSessionController.disconnect('explicit');
	}

	async openSettings(): Promise<void> {
		await this.commandService.executeCommand('workbench.action.openSettings', { query: 'agents.voice' });
	}
}

/** Routes the new-session voice toolbar to {@link NewChatVoiceController}. */
class NewChatVoiceToolbarActionRunner extends ActionRunner {

	constructor(private readonly _controller: NewChatVoiceController) {
		super();
	}

	protected override async runAction(action: IAction, context?: unknown): Promise<void> {
		switch (newChatVoiceToolbarIntent(action.id)) {
			case 'ignore':
				return;
			case 'start':
				await this._controller.startFromToolbar();
				return;
			case 'stop':
				this._controller.stopFromToolbar();
				return;
			case 'settings':
				await this._controller.openSettings();
				return;
			case 'disconnect':
				this._controller.disconnectFromToolbar();
				return;
			default:
				await super.runAction(action, context);
		}
	}
}
