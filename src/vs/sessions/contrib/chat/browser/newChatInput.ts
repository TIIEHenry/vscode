/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/chatInput.css';
import './media/chatInputMobile.css';
import * as dom from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable, DisposableStore, MutableDisposable, thenRegisterOrDispose, toDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { Schemas } from '../../../../base/common/network.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import type { IManagedHoverContent } from '../../../../base/browser/ui/hover/hover.js';
import { IMenuEntryActionViewItemOptions, MenuEntryActionViewItem } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { CodeEditorWidget, ICodeEditorWidgetOptions } from '../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { EditorExtensionsRegistry } from '../../../../editor/browser/editorExtensions.js';
import { IEditorConstructionOptions } from '../../../../editor/browser/config/editorConfiguration.js';
import { getCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { IRange, Range } from '../../../../editor/common/core/range.js';
import { isLocation, Location } from '../../../../editor/common/languages.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { EDITOR_FONT_DEFAULTS } from '../../../../editor/common/config/fontInfo.js';
import { EditorOptions } from '../../../../editor/common/config/editorOptions.js';
import { Context as SuggestContext } from '../../../../editor/contrib/suggest/browser/suggest.js';
import { SuggestController } from '../../../../editor/contrib/suggest/browser/suggestController.js';
import { SnippetController2 } from '../../../../editor/contrib/snippet/browser/snippetController2.js';
import { CopyPasteController } from '../../../../editor/contrib/dropOrPasteInto/browser/copyPasteController.js';
import { PlaceholderTextContribution } from '../../../../editor/contrib/placeholderText/browser/placeholderTextContribution.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { KeybindingsRegistry, KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { AccessibilityVerbositySettingId } from '../../../../workbench/contrib/accessibility/browser/accessibilityConfiguration.js';
import { AccessibilityCommandId } from '../../../../workbench/contrib/accessibility/common/accessibilityCommands.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { HoverPosition } from '../../../../base/browser/ui/hover/hoverWidget.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import * as aria from '../../../../base/browser/ui/aria/aria.js';
import { ContextMenuController } from '../../../../editor/contrib/contextmenu/browser/contextmenu.js';
import { getSimpleEditorOptions } from '../../../../workbench/contrib/codeEditor/browser/simpleEditorOptions.js';
import { NewChatContextAttachments } from './newChatContextAttachments.js';
import { ChatDragAndDrop } from '../../../../workbench/contrib/chat/browser/widget/chatDragAndDrop.js';
import { EDITOR_DRAG_AND_DROP_BACKGROUND } from '../../../../workbench/common/theme.js';
import { inactiveSessionViewBackground, inactiveSessionViewForeground } from '../../../common/theme.js';

import { INewChatVoiceTargetService, isNewChatVoiceSessionActive, NEW_CHAT_VOICE_SENTINEL, NewChatVoiceController } from './newChatVoice.js';
import { ISessionTypePickerOptions, SessionTypePicker } from './sessionTypePicker.js';
import { IActiveSession } from '../../../services/sessions/common/sessionsManagement.js';
import { SessionStatus } from '../../../services/sessions/common/session.js';
import { MobileSessionTypePicker } from './mobile/mobileSessionTypePicker.js';
import { installMobileChipLaneScroll } from '../../../browser/parts/mobile/mobileChipLaneScroll.js';
import { IWorkbenchLayoutService } from '../../../../workbench/services/layout/browser/layoutService.js';
import { Menus } from '../../../browser/menus.js';
import { HiddenItemStrategy, MenuWorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { MenuId, MenuItemAction } from '../../../../platform/actions/common/actions.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { SlashCommandHandler } from './slashCommands.js';
import { VariableCompletionHandler } from './variableCompletions.js';
import { SessionReferenceCompletionHandler } from './sessionReferenceCompletions.js';
import { AgentHostInputCompletionHandler } from './agentHostInputCompletions.js';
import { IChatModelInputState } from '../../../../workbench/contrib/chat/common/model/chatModel.js';
import { IChatRequestVariableEntry, isExplicitFileOrImageVariableEntry, isStringVariableEntry, toFileVariableEntry, toPasteVariableEntry } from '../../../../workbench/contrib/chat/common/attachments/chatVariableEntries.js';
import { IChatSessionsService } from '../../../../workbench/contrib/chat/common/chatSessionsService.js';
import { ChatAgentLocation, ChatModeKind } from '../../../../workbench/contrib/chat/common/constants.js';
import { ChatHistoryNavigator } from '../../../../workbench/contrib/chat/common/widget/chatWidgetHistoryService.js';
import { IHistoryNavigationWidget } from '../../../../base/browser/history.js';
import { registerAndCreateHistoryNavigationContext, IHistoryNavigationContext } from '../../../../platform/history/browser/contextScopedHistoryWidget.js';
import { autorun, constObservable, derived, IObservable, observableFromEvent, observableValue } from '../../../../base/common/observable.js';
import { isEqual } from '../../../../base/common/resources.js';
import { ChatInputNotificationWidget } from '../../../../workbench/contrib/chat/browser/widget/input/chatInputNotificationWidget.js';
import { IChatInputNotificationContext, IChatInputNotificationService } from '../../../../workbench/contrib/chat/browser/widget/input/chatInputNotificationService.js';
import { ILanguageModelChatMetadataAndIdentifier, ILanguageModelsService } from '../../../../workbench/contrib/chat/common/languageModels.js';
import { ChatInputNoticeHost, ChatInputNoticeLane } from '../../../../workbench/contrib/chat/browser/widget/input/chatInputNoticeHost.js';
import { registerChatInputOnboardingHosts } from '../../../../workbench/contrib/chat/browser/widget/input/chatInputOnboardingHosts.js';
import { IChatInputNoticeHubService } from '../../../../workbench/contrib/chat/browser/widget/input/chatInputNoticeHub.js';
import { ChatInputPickerResponsiveLayout, IChatInputPickerResponsiveLayoutItem } from '../../../../workbench/contrib/chat/browser/widget/input/chatInputPickerResponsiveLayout.js';
import { chatInputStackClass, chatInputStackSlotClass, ChatInputStackSlot, refreshChatInputStack, setChatInputStackSlot } from '../../../../workbench/contrib/chat/browser/widget/input/chatInputStack.js';
import { IChatSubmitRequestHandlerService } from '../../../../workbench/contrib/chat/browser/chatSubmitRequestHandlerService.js';
import { INewChatModelPickerService, NewChatModelPickerService } from './newChatModelPicker.js';
import { ModelPicker, ModelPickerActionViewItem } from './modelPicker.js';
import { ISessionModelSelection, SessionModelSelection } from './sessionModelSelection.js';
import { ISessionContext, SessionContext } from '../../../services/sessions/browser/sessionContext.js';
import { AGENT_SESSIONS_SCOPED_INPUT_HISTORY_SETTING } from './sessionsChatHistory.js';
import { IChatStatusItemService } from '../../../../workbench/contrib/chat/browser/chatStatus/chatStatusItemService.js';
import { handleTerminalCommandPaste, isTerminalCommandInput } from '../../../../workbench/contrib/chat/browser/chatTerminalCommandPaste.js';
import { IChatPasteTargetService } from '../../../../workbench/contrib/chat/browser/chat.js';
import { NewChatInputPasteTarget } from './newChatInputPasteTarget.js';
import { getChatSessionType } from '../../../../workbench/contrib/chat/common/model/chatUri.js';
import { ChatSpeechToTextState, DICTATION_MAI_MODEL_ID, DICTATION_MODEL_SETTING, DictationSettingId, IChatSpeechToTextService } from '../../../../workbench/contrib/chat/browser/speechToText/chatSpeechToTextService.js';
import { DictationActionViewItem } from '../../../../workbench/contrib/chat/browser/speechToText/dictationActionViewItem.js';
import { DictationDownloadActionViewItem } from '../../../../workbench/contrib/chat/browser/speechToText/dictationDownloadActionViewItem.js';
import { IDictationOnboardingService } from '../../../../workbench/contrib/chat/browser/speechToText/dictationOnboarding.js';
import { ChatVoiceInputModeAction, VoiceInputModeActionViewItem } from '../../../../workbench/contrib/chat/browser/voiceInputMode/voiceInputModeActionViewItem.js';
import { IVoiceInputModeService } from '../../../../workbench/contrib/chat/browser/voiceInputMode/voiceInputMode.js';
import { toAction } from '../../../../base/common/actions.js';
import { runDictationShortcut } from '../../../../workbench/contrib/chat/browser/actions/chatSpeechToTextActions.js';
import { isDictationActiveForEditor, notifyDictationSubmitted, onDidChangeDictationEditor } from '../../../../workbench/contrib/chat/browser/speechToText/dictationSession.js';
import { combineVoiceInput } from '../../../../workbench/contrib/chat/browser/voiceClient/voiceInputUtils.js';
import { parse, stringify } from '../../../../base/common/marshalling.js';
import { ChatContextKeys } from '../../../../workbench/contrib/chat/common/actions/chatContextKeys.js';
import { IVoiceSessionController } from '../../../../workbench/contrib/chat/browser/voiceClient/voiceSessionController.js';
import { IChatPetWidgetService } from '../../../../workbench/contrib/chat/browser/widget/chatPetWidgetService.js';
import { getChatPetStackPlatformTop } from '../../../../workbench/contrib/chat/browser/widget/chatPetWidget.js';
import { IVoiceModeOnboardingService } from '../../../../workbench/contrib/agentsVoice/browser/voiceModeOnboarding.js';
import { AGENTS_VOICE_ENABLED } from '../../../../workbench/contrib/agentsVoice/common/agentsVoice.js';
import { animatePromptTyping, IPromptTypingAnimation } from './promptTypingAnimation.js';
import { PromptTemplatePlaceholderController } from './promptTemplatePlaceholder.js';
import { INewSessionComposer, INewSessionPromptOptionsController, NEW_SESSION_PROMPT_TYPING_DURATION_MS, NewSessionPromptOptionsState, NewSessionWorkspacePreselectionSource } from './newSessionComposerService.js';
import { NewSessionPromptOptionsWidget } from './newSessionPromptOptions.js';
import { IEditorService } from '../../../../workbench/services/editor/common/editorService.js';
import { ChatImplicitContexts } from '../../../../workbench/contrib/chat/browser/attachments/chatImplicitContext.js';
import { ImplicitContextAttachmentWidget } from '../../../../workbench/contrib/chat/browser/attachments/implicitContextAttachment.js';
import { ChatAttachmentModel } from '../../../../workbench/contrib/chat/browser/attachments/chatAttachmentModel.js';
import { DEFAULT_LABELS_CONTAINER, ResourceLabels } from '../../../../workbench/browser/labels.js';
import { ChatMode, IChatMode, IChatModeService } from '../../../../workbench/contrib/chat/common/chatModes.js';
import { ChatSelectedTools, ToolsScope } from '../../../../workbench/contrib/chat/browser/widget/input/chatSelectedTools.js';
import { showToolsPicker } from '../../../../workbench/contrib/chat/browser/actions/chatToolPicker.js';


const OPEN_OTEL_SETTINGS_COMMAND = 'github.copilot.chat.otel.openSettings';
const OTEL_STATUS_COMMAND = 'github.copilot.chat.otel.statusActive';
const OTEL_STATUS_ENTRY_ID = 'copilot.otelStatus';
const OTEL_DOCS_URL = 'https://code.visualstudio.com/docs/agents/guides/monitoring-agents';
const STORAGE_KEY_DRAFT_STATE = 'sessions.draftState';
const MIN_EDITOR_HEIGHT = 50;
const MAX_EDITOR_HEIGHT = 200;
const NEW_CHAT_INPUT_FONT_FAMILY = 'system-ui, -apple-system, sans-serif';

function getLabeledPickerResponsiveItems(container: HTMLElement): IChatInputPickerResponsiveLayoutItem[] {
	const elements = new Map<HTMLElement, HTMLElement | undefined>();
	const actionItemLabelCounts = new Map<HTMLElement, number>();
	const visit = (element: HTMLElement, pickerSlot: HTMLElement | undefined, actionItem: HTMLElement | undefined): void => {
		const currentPickerSlot = element.classList.contains('sessions-chat-picker-slot') ? element : pickerSlot;
		const currentActionItem = element.classList.contains('action-item') ? element : actionItem;
		if (element.classList.contains('sessions-chat-dropdown-label')) {
			const pickerElement = currentPickerSlot ?? currentActionItem;
			if (pickerElement) {
				elements.set(pickerElement, currentActionItem);
				if (currentActionItem) {
					actionItemLabelCounts.set(currentActionItem, (actionItemLabelCounts.get(currentActionItem) ?? 0) + 1);
				}
			}
		}
		for (const child of element.children) {
			if (dom.isHTMLElement(child)) {
				visit(child, currentPickerSlot, currentActionItem);
			}
		}
	};
	visit(container, undefined, undefined);

	return Array.from(elements, ([element, actionItem]) => ({
		element,
		isCompact: () => element.classList.contains('compact-picker'),
		setCompact: compact => {
			element.classList.toggle('compact-picker', compact);
			if (actionItem && actionItem !== element && actionItemLabelCounts.get(actionItem) === 1) {
				actionItem.classList.toggle('compact-picker', compact);
			}
		},
	}));
}

/** True while focus is in an Agents window composer that supports dictation. */
const SessionsChatInputHasDictationFocus = new RawContextKey<boolean>('sessionsChatInputHasDictationFocus', false, localize('sessionsChatInputHasDictationFocus', "True when focus is in an Agents window chat composer that supports dictation."));

const TOGGLE_DICTATION_COMMAND_ID = 'sessions.action.chat.toggleDictation';

const IMPLICIT_CONTEXT_SKIPPED_SCHEMES = new Set<string>([
	Schemas.sessionsChatInput,
	Schemas.vscodeChatResponseResource,
	Schemas.vscodeSettings,
	Schemas.walkThrough,
	Schemas.walkThroughSnippet,
]);

export interface INewChatImplicitSelection {
	readonly isEmpty: boolean;
	readonly range: IRange;
}

/**
 * Active-editor snapshot for the new-session implicit chip.
 * No editor, the composer model, and non-file schemes yield nothing.
 */
export function implicitContextValueForEditor(resource: URI | undefined, selection: INewChatImplicitSelection | undefined): { readonly value: URI | Location | undefined; readonly isSelection: boolean } {
	if (!resource || IMPLICIT_CONTEXT_SKIPPED_SCHEMES.has(resource.scheme) || resource.path.endsWith('.copilotmd')) {
		return { value: undefined, isSelection: false };
	}
	if (selection && !selection.isEmpty) {
		return { value: { uri: resource, range: selection.range }, isSelection: true };
	}
	return { value: resource, isSelection: false };
}

/**
 * Maps a session mode id onto a real {@link IChatMode}.
 * An unset id is not a mode — the composer does not invent one.
 */
export function resolveComposerChatMode(
	selected: { readonly id: string; readonly kind: string } | undefined,
	findMode: (id: string) => IChatMode | undefined,
): IChatMode | undefined {
	if (!selected) {
		return undefined;
	}
	switch (selected.id) {
		case ChatMode.Agent.id:
			return ChatMode.Agent;
		case ChatMode.Ask.id:
			return ChatMode.Ask;
		case ChatMode.Edit.id:
			return ChatMode.Edit;
		default:
			return findMode(selected.id);
	}
}

/** Composer the dictation shortcut targets (the composer isn't an `IChatWidget`). */
let activeDictationComposer: NewChatInputWidget | undefined;

KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: TOGGLE_DICTATION_COMMAND_ID,
	weight: KeybindingWeight.WorkbenchContrib + 1,
	when: ContextKeyExpr.and(
		SessionsChatInputHasDictationFocus,
		ContextKeyExpr.has(ChatContextKeys.speechToTextConfigured.key),
	),
	primary: KeyMod.CtrlCmd | KeyCode.KeyI,
	handler: () => { void activeDictationComposer?.toggleDictation()?.catch(onUnexpectedError).catch(onUnexpectedError); },
});

// Preserve the command id so push-to-talk hold mode can track this chord.
KeybindingsRegistry.registerKeybindingRule({
	id: 'agentsVoice.startVoiceInChat',
	weight: KeybindingWeight.WorkbenchContrib + 1,
	when: ContextKeyExpr.and(
		SessionsChatInputHasDictationFocus,
		AGENTS_VOICE_ENABLED,
	),
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Space,
});

interface IDraftState {
	inputText: string;
	attachments: readonly IChatRequestVariableEntry[];
}

export function hasSendableNewChatContent(query: string, attachments: readonly IChatRequestVariableEntry[], hasAdditionalSendContent = false): boolean {
	return !!query.trim() || attachments.some(isExplicitFileOrImageVariableEntry) || hasAdditionalSendContent;
}

/**
 * Monaco accepts Enter only when the suggest widget is visible, a row is focused,
 * the item would change the text, and accept-on-enter is enabled. An explicit
 * empty list stays visible with no focused row; yielding then inserts a newline.
 */
export function newChatEnterYieldsToSuggest(readContextKey: (key: string) => unknown): boolean {
	return readContextKey(SuggestContext.Visible.key) === true
		&& readContextKey(SuggestContext.HasFocusedSuggestion.key) === true
		&& readContextKey(SuggestContext.MakesTextEdit.key) !== false
		&& readContextKey(SuggestContext.AcceptSuggestionsOnEnter.key) !== false;
}

class NewChatInputStatusActionViewItem extends MenuEntryActionViewItem {
	private readonly hoverContentDisposables = this._register(new MutableDisposable<DisposableStore>());

	constructor(
		action: MenuItemAction,
		options: IMenuEntryActionViewItemOptions | undefined,
		@IKeybindingService keybindingService: IKeybindingService,
		@INotificationService notificationService: INotificationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IAccessibilityService accessibilityService: IAccessibilityService,
		@IChatStatusItemService private readonly chatStatusItemService: IChatStatusItemService,
		@IHoverService private readonly hoverService: IHoverService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(action, options, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, accessibilityService);
	}

	override render(container: HTMLElement): void {
		super.render(container);

		if (this._commandAction.id !== OTEL_STATUS_COMMAND) {
			return;
		}

		this._register(this.chatStatusItemService.onDidChange(e => {
			if (e.entry.id === OTEL_STATUS_ENTRY_ID) {
				this.updateTooltip();
			}
		}));
	}

	override async onClick(event: MouseEvent): Promise<void> {
		if (this._commandAction.id === OTEL_STATUS_COMMAND && this.element) {
			event.preventDefault();
			event.stopPropagation();
			this.hoverService.showManagedHover(this.element);
			return;
		}

		await super.onClick(event);
	}

	protected override getHoverContents(): IManagedHoverContent | undefined {
		if (this._commandAction.id === OTEL_STATUS_COMMAND) {
			return { element: () => this._renderStatusHover() };
		}

		return super.getHoverContents();
	}

	protected override getTooltip(): string {
		if (this._commandAction.id === OTEL_STATUS_COMMAND) {
			const tooltip = this._getStatusEntryTooltip();
			if (tooltip) {
				return tooltip;
			}
		}

		return super.getTooltip();
	}

	private _getStatusEntryTooltip(): string | undefined {
		for (const entry of this.chatStatusItemService.getEntries()) {
			if (entry.id === OTEL_STATUS_ENTRY_ID) {
				return entry.tooltip;
			}
		}

		return undefined;
	}

	private _renderStatusHover(): HTMLElement {
		const store = new DisposableStore();
		this.hoverContentDisposables.value = store;

		const root = dom.$('.new-chat-input-status-hover');
		root.appendChild(dom.$('.new-chat-input-status-hover-title', undefined, localize('newChatInput.status.otel.title', "Monitoring with OpenTelemetry enabled")));
		root.appendChild(dom.$('.new-chat-input-status-hover-detail', undefined, this._getStatusEntryTooltip() ?? super.getTooltip()));

		const actions = root.appendChild(dom.$('.new-chat-input-status-hover-actions'));
		const learnMoreButton = store.add(new Button(actions, { ...defaultButtonStyles, secondary: true }));
		learnMoreButton.label = localize('newChatInput.status.otel.learnMore', "Learn More");
		store.add(learnMoreButton.onDidClick(() => {
			void this.commandService.executeCommand('vscode.open', URI.parse(OTEL_DOCS_URL)).catch(onUnexpectedError).catch(onUnexpectedError);
			this.hoverService.hideHover(true);
		}));

		const manageButton = store.add(new Button(actions, { ...defaultButtonStyles, secondary: true }));
		manageButton.label = localize('newChatInput.status.otel.manage', "Manage");
		store.add(manageButton.onDidClick(() => {
			void this.commandService.executeCommand(OPEN_OTEL_SETTINGS_COMMAND).catch(onUnexpectedError).catch(onUnexpectedError);
			this.hoverService.hideHover(true);
		}));

		return root;
	}
}

/**
 * Toolbar action for {@link DictationActionViewItem} on the new-session composer.
 * `run` must call this composer's `toggleDictation`. The shared Dictate command
 * targets the last focused chat widget, and this composer is not an `IChatWidget`.
 */
class NewChatDictationMenuAction extends MenuItemAction {

	constructor(
		item: MenuItemAction['item'],
		private readonly _toggle: () => Promise<unknown>,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ICommandService commandService: ICommandService,
	) {
		super(item, undefined, undefined, undefined, undefined, contextKeyService, commandService);
	}

	override async run(): Promise<void> {
		await this._toggle();
	}
}

/**
 * Options passed to the {@link NewChatInputWidget}'s `sendRequest` callback when
 * the user submits the input.
 */
export interface INewChatInputSendRequest {
	readonly query: string;
	readonly attachments?: IChatRequestVariableEntry[];
	readonly background?: boolean;
}

/**
 * Randomized, friendly placeholders shown in the new-session chat input
 * to add a bit of personality. One is picked per widget instance, avoiding
 * an immediate repeat of the previous pick.
 */
const RANDOM_PLACEHOLDERS = [
	localize('sessionsChatInput.placeholder.whatAreYouBuilding', "What are you building?"),
	localize('sessionsChatInput.placeholder.whatWillYouShipToday', "What will you ship today?"),
	localize('sessionsChatInput.placeholder.describeWhatYouWantToBuild', "Describe what you want to build"),
	localize('sessionsChatInput.placeholder.whatsYourNextMilestone', "What's your next milestone?"),
	localize('sessionsChatInput.placeholder.whatAreYouTryingToAchieve', "What are you trying to achieve?"),
	localize('sessionsChatInput.placeholder.pitchYourIdea', "Pitch your idea"),
	localize('sessionsChatInput.placeholder.whatsTheGoal', "What's the goal?"),
	localize('sessionsChatInput.placeholder.whatWillYouCreate', "What will you create?"),
	localize('sessionsChatInput.placeholder.whatFeatureAreYouDreamingUp', "What feature are you dreaming up?"),
	localize('sessionsChatInput.placeholder.describeTheOutcome', "Describe the outcome you want"),
	localize('sessionsChatInput.placeholder.whatProblemAreYouSolving', "What problem are you solving?"),
	localize('sessionsChatInput.placeholder.whatsNextOnYourRoadmap', "What's next on your roadmap?"),
	localize('sessionsChatInput.placeholder.whatWouldYouLikeToAutomate', "What would you like to automate?"),
	localize('sessionsChatInput.placeholder.whatWillYouLaunch', "What will you launch?"),
	localize('sessionsChatInput.placeholder.describeYourMission', "Describe your mission"),
];

let lastPlaceholderIndex = -1;
function getRandomChatInputPlaceholder(): string {
	let index = Math.floor(Math.random() * RANDOM_PLACEHOLDERS.length);
	if (index === lastPlaceholderIndex) {
		index = (index + 1) % RANDOM_PLACEHOLDERS.length;
	}
	lastPlaceholderIndex = index;
	return RANDOM_PLACEHOLDERS[index];
}

// #region --- New Chat Widget ---

export class NewChatInputWidget extends Disposable implements IHistoryNavigationWidget, INewSessionComposer {

	readonly sessionTypePicker: SessionTypePicker;

	/** Arbitrates which notice occupies the area above this input. */
	readonly noticeHost = this._register(new ChatInputNoticeHost(() => this.focus()));
	private _gettingStartedTipContainer: HTMLElement | undefined;
	private _hostNoticeContainer: HTMLElement | undefined;

	/** The canonical notice slot, directly above this input. */
	get gettingStartedTipContainerElement(): HTMLElement | undefined {
		return this._gettingStartedTipContainer;
	}

	/** Notice slot for the composer's host, so its content docks inside this stack. */
	get hostNoticeContainerElement(): HTMLElement | undefined {
		return this._hostNoticeContainer;
	}


	// IHistoryNavigationWidget
	private readonly _onDidFocus = this._register(new Emitter<void>());
	readonly onDidFocus = this._onDidFocus.event;
	private readonly _onDidBlur = this._register(new Emitter<void>());
	readonly onDidBlur = this._onDidBlur.event;
	get element(): HTMLElement { return this._editorContainer; }

	/** The underlying input editor. Exposed for component fixtures. */
	get inputEditor(): CodeEditorWidget | undefined { return this._editor; }

	/** The current model-selection state. Exposed so host widgets can react to model changes. */
	get selectedModelState() { return this._modelSelection.state; }

	get workspacePreselectionSource(): NewSessionWorkspacePreselectionSource | undefined {
		return this.options.getWorkspacePreselectionSource?.();
	}

	/** Opens the model picker dropdown. */
	openModelPicker(): void { this._newChatModelPickerService.openModelPicker(); }

	/** Moves the provider-contributed session controls into the given container. */
	renderSessionControls(container: HTMLElement): void {
		if (!this._sessionControlsContainer) {
			throw new Error('NewChatInputWidget must be rendered before its session controls.');
		}
		container.appendChild(this._sessionControlsContainer);
	}

	// Input
	private _editor!: CodeEditorWidget;
	private _editorContainer!: HTMLElement;
	private _sessionControlsContainer: HTMLElement | undefined;
	private readonly _promptTemplatePlaceholder = this._register(new MutableDisposable<PromptTemplatePlaceholderController>());
	private readonly _promptOptionsWidget = this._register(new MutableDisposable<NewSessionPromptOptionsWidget>());
	private readonly _promptOptionsRefresh = this._register(new MutableDisposable<CancellationTokenSource>());
	private _promptOptionsState: NewSessionPromptOptionsState | undefined;
	private _promptOptionsController: INewSessionPromptOptionsController | undefined;
	private _promptOptionsDismissed = false;

	// Send button
	private _sendButton: Button | undefined;
	private _sending = false;
	private _sendGeneration = 0;

	// Loading state
	private _loadingSpinner: HTMLElement | undefined;
	private readonly _loadingDelayDisposable = this._register(new MutableDisposable());
	private readonly _promptTypingAnimation = this._register(new MutableDisposable<IPromptTypingAnimation>());

	// Attached context
	private readonly _contextAttachments: NewChatContextAttachments;
	private _attachedContextContainer: HTMLElement | undefined;
	private _implicitContexts!: ChatImplicitContexts;
	private readonly _implicitEditorListeners = this._register(new MutableDisposable());
	private _implicitHost: HTMLElement | undefined;
	private readonly _implicitWidget = this._register(new MutableDisposable<ImplicitContextAttachmentWidget>());
	private _implicitLabels: ResourceLabels | undefined;
	private _implicitAttachmentModel: ChatAttachmentModel | undefined;
	private _implicitEnabled = false;
	private readonly _customModes = this._register(new MutableDisposable());
	private readonly _chatMode = observableValue<IChatMode | undefined>(this, undefined);
	private readonly _toolsMode = observableValue<IChatMode>(this, ChatMode.Agent);
	private _toolsLanguageModel: IObservable<ILanguageModelChatMetadataAndIdentifier | undefined> | undefined;
	private _selectedTools: ChatSelectedTools | undefined;
	private _toolsButton: HTMLElement | undefined;
	private _toolsFailed = false;

	// Slash commands
	private _agentHostInputCompletionHandler: AgentHostInputCompletionHandler | undefined;
	private readonly _scopedInstantiationService: IInstantiationService;
	private readonly _newChatModelPickerService = new NewChatModelPickerService();
	private readonly _modelSelection: SessionModelSelection;
	private readonly _canSendRequest: IObservable<boolean>;
	private readonly _compactModelPicker = observableValue(this, false);
	private _primaryPickerResponsiveLayout: ChatInputPickerResponsiveLayout | undefined;
	private _secondaryPickerResponsiveLayout: ChatInputPickerResponsiveLayout | undefined;

	// Input state
	private _draftState: IDraftState | undefined = {
		inputText: '',
		attachments: [],
	};

	// Input history
	private readonly _history: ChatHistoryNavigator;
	private _historyNavigationBackwardsEnablement!: IHistoryNavigationContext['historyNavigationBackwardsEnablement'];
	private _historyNavigationForwardsEnablement!: IHistoryNavigationContext['historyNavigationForwardsEnablement'];

	constructor(
		private readonly options: {
			session: IObservable<IActiveSession | undefined>;
			getContextFolderUri: () => URI | undefined;
			getWorkspacePreselectionSource?: () => NewSessionWorkspacePreselectionSource;
			sendRequest: (request: INewChatInputSendRequest) => Promise<boolean>;
			canSendRequest: IObservable<boolean>;
			canSubmitWithoutSession?: IObservable<boolean>;
			hasAdditionalSendContent?: IObservable<boolean>;
			loading: IObservable<boolean>;
			historyKey?: IObservable<string | undefined>;
			minEditorHeight?: number;
			placeholder?: string;
			renderSendButton?: boolean;
			sessionTypePickerOptions?: ISessionTypePickerOptions;
			supportsBackground?: boolean;
			deferredNotificationsEnabled?: IObservable<boolean>;
			petHostPreferred?: IObservable<boolean>;
			/**
			 * Keep this composer a valid voice target even while a created session
			 * is active. Used by the in-session "new chat" composer so dictation
			 * creates a parallel chat instead of routing to the parent session's
			 * chat widget. The welcome composer leaves this unset.
			 */
			voiceRoutesWhileSessionActive?: boolean;
		},
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IModelService private readonly modelService: IModelService,
		@ITextModelService private readonly textModelService: ITextModelService,
		@IChatPasteTargetService private readonly chatPasteTargetService: IChatPasteTargetService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@ILogService private readonly logService: ILogService,
		@IHoverService private readonly hoverService: IHoverService,
		@IStorageService private readonly storageService: IStorageService,
		@IDialogService private readonly dialogService: IDialogService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IChatSessionsService private readonly chatSessionsService: IChatSessionsService,
		@IChatSpeechToTextService private readonly chatSpeechToTextService: IChatSpeechToTextService,
		@IDictationOnboardingService private readonly dictationOnboardingService: IDictationOnboardingService,
		@IChatInputNoticeHubService private readonly chatInputNoticeHubService: IChatInputNoticeHubService,
		@IChatSubmitRequestHandlerService private readonly chatSubmitRequestHandlerService: IChatSubmitRequestHandlerService,
		@IVoiceSessionController private readonly voiceSessionController: IVoiceSessionController,
		@IVoiceInputModeService private readonly voiceInputModeService: IVoiceInputModeService,
		@IAccessibilityService private readonly accessibilityService: IAccessibilityService,
		@IVoiceModeOnboardingService private readonly voiceModeOnboardingService: IVoiceModeOnboardingService,
		@INewChatVoiceTargetService private readonly newChatVoiceTargetService: INewChatVoiceTargetService,
		@IChatPetWidgetService private readonly chatPetWidgetService: IChatPetWidgetService,
		@IChatInputNotificationService private readonly chatInputNotificationService: IChatInputNotificationService,
		@ILanguageModelsService private readonly languageModelsService: ILanguageModelsService,
		@IEditorService private readonly editorService: IEditorService,
		@IChatModeService private readonly chatModeService: IChatModeService,
	) {
		super();
		this._modelSelection = this._register(this.instantiationService.createInstance(SessionModelSelection, this.options.session));
		this._canSendRequest = derived(this, reader => {
			if (this.options.canSubmitWithoutSession?.read(reader)) {
				return true;
			}
			const modelSelection = this._modelSelection.state.read(reader);
			return this.options.canSendRequest.read(reader) && modelSelection.hasSelectableModel && !modelSelection.pendingSelection;
		});
		this._scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection(
			[INewChatModelPickerService, this._newChatModelPickerService],
			[ISessionContext, new SessionContext(this.options.session)],
			[ISessionModelSelection, this._modelSelection],
		)));
		this._history = this._register(this.instantiationService.createInstance(ChatHistoryNavigator, ChatAgentLocation.Chat));
		if (this.options.historyKey) {
			this._register(autorun(reader => this._setHistoryKey(this.options.historyKey?.read(reader))));
			this._register(this.configurationService.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration(AGENT_SESSIONS_SCOPED_INPUT_HISTORY_SETTING)) {
					this._setHistoryKey(this.options.historyKey?.get());
				}
			}));
		}
		this._contextAttachments = this._register(this.instantiationService.createInstance(NewChatContextAttachments));
		// Always use the mobile-aware picker. Its overrides bail to the
		// desktop behavior when `isPhoneLayout()` is false, so picking
		// the same class regardless of construction-time viewport
		// avoids a class-mismatch when the user resizes across the
		// phone breakpoint after the chat input mounted.
		this.sessionTypePicker = this._register(this.instantiationService.createInstance(MobileSessionTypePicker, this.options.session, this.options.sessionTypePickerOptions));
		this._register(this._contextAttachments.onDidChangeContext(() => {
			this._updateDraftState();
			this._updateSendButtonState();
			this.focus();
			// Attachment rendering clears its container. Put the implicit chip back.
			this._renderImplicitContext();
		}));
		this._implicitContexts = this._register(this.instantiationService.createInstance(ChatImplicitContexts));
		this._register(this._implicitContexts.onDidChangeValue(() => this._renderImplicitContext()));
		this._trackActiveEditorImplicitContext();
		this._toolsLanguageModel = derived(this, reader => this._modelSelection.state.read(reader).currentModel);
		this._register(autorun(reader => {
			const session = this.options.session.read(reader);
			this._bindComposerChatMode(session, session?.mode.read(reader));
		}));
		this._register(autorun(reader => {
			const mode = this._chatMode.read(reader);
			const model = this._toolsLanguageModel!.read(reader);
			this._setImplicitEnabled(mode?.name.get().toLowerCase() === 'ask');
			this._applyToolsButton(mode, model);
		}));
		this._register(autorun(reader => {
			this._canSendRequest.read(reader);
			this.options.hasAdditionalSendContent?.read(reader);
			const isLoading = this.options.loading.read(reader);
			this._loadingSpinner?.classList.toggle('visible', isLoading);
			this._updateSendButtonState();
		}));
	}

	private _setHistoryKey(historyKey: string | undefined): void {
		this._history.setHistoryKey(this.configurationService.getValue<boolean>(AGENT_SESSIONS_SCOPED_INPUT_HISTORY_SETTING) !== false ? historyKey : undefined);
	}

	// --- Rendering ---

	render(parent: HTMLElement, root: HTMLElement): void {
		// Input slot, and the stack the notices, prompt options and input area sit in.
		const chatInputContainer = dom.append(parent, dom.$(`.new-chat-input-container.${chatInputStackClass}`));

		// Overflow widget DOM node at the top level so the suggest widget
		// is not clipped by any overflow:hidden ancestor.
		// Mounted on the workbench container (not the composer subtree) so overflow
		// widgets such as suggest and the post-paste selector are not clipped by,
		// or stacked beneath, the composer's own layout. Because it lives outside the
		// composer, it has to be taken down with the widget rather than with `root`.
		const editorOverflowWidgetsDomNode = this.layoutService.getContainer(dom.getWindow(root)).appendChild(dom.$('.sessions-chat-editor-overflow.monaco-editor'));
		// Suppress the default `Text` kind icon in the suggest widget; chat slash/skill
		// completions use that kind and rely on the chat module's CSS rule scoped to this class.
		editorOverflowWidgetsDomNode.classList.add('hideSuggestTextIcons');
		// Registered before the editor so it is removed after the editor — and the
		// overflow widgets it owns — have been disposed.
		this._register(toDisposable(() => editorOverflowWidgetsDomNode.remove()));

		this._register(this.chatInputNoticeHubService.registerHost(this.noticeHost, chatInputContainer));

		// Scopes the notice focus command to this composer. Tracked on the whole
		// container rather than the editor, so the command can also toggle focus
		// back out of a notice once it is in one.
		const composerFocusKey = ChatContextKeys.inChatComposer.bindTo(this._register(this.contextKeyService.createScoped(chatInputContainer)));
		const composerFocusTracker = this._register(dom.trackFocus(chatInputContainer));
		this._register(composerFocusTracker.onDidFocus(() => composerFocusKey.set(true)));
		this._register(composerFocusTracker.onDidBlur(() => composerFocusKey.set(false)));

		// Notification widget above the input area
		const notificationContainer = dom.append(chatInputContainer, dom.$(`.chat-input-notification-container.${chatInputStackSlotClass}`));
		// Declared up front: the visibility callback can fire while the widget is
		// still being constructed, before the binding below is assigned.
		const notificationWidget: ChatInputNotificationWidget = this._register(this.instantiationService.createInstance(
			ChatInputNotificationWidget,
			{
				modelTargetChatSessionType: this.sessionTypePicker.modelTargetChatSessionType,
				sessionResource: derived(this, reader => this.options.session.read(reader)?.activeChat.read(reader).resource),
				deferredNotificationsEnabled: this.options.deferredNotificationsEnabled,
				isTransientChat: derived(this, reader => this.options.session.read(reader)?.isQuickChat?.read(reader) ?? false),
				sessionStarted: derived(this, reader => {
					const session = this.options.session.read(reader);
					return session ? session.activeChat.read(reader).status.read(reader) !== SessionStatus.Untitled : false;
				}),
				modelSelection: {
					state: this._modelSelection.state,
					openPicker: () => this._newChatModelPickerService.openModelPicker(),
					selectModel: modelIdentifier => this._newChatModelPickerService.switchToModel(modelIdentifier),
					// The model picker here has no scoped store and configures models globally,
					// so a notification writes to the same place its "Thinking" rows do.
					applyModelConfiguration: (modelIdentifier, values) => this.languageModelsService.setModelConfiguration(modelIdentifier, values),
				},
				onDidChangeVisibility: (visible, focusTarget) => this.noticeHost.setOccupied(ChatInputNoticeLane.Notification, visible, focusTarget),
				focusInput: () => this.focus(),
			},
		));
		notificationWidget.attachTo(notificationContainer);

		// First-run voice and dictation introductions, docked directly above the
		// input area so they read as one stack with it.
		const voiceOnboardingContainer = dom.append(chatInputContainer, dom.$(`.voice-mode-onboarding-container.${chatInputStackSlotClass}`));
		const dictationOnboardingContainer = dom.append(chatInputContainer, dom.$(`.dictation-onboarding-container.${chatInputStackSlotClass}`));
		this._register(registerChatInputOnboardingHosts(
			this.noticeHost,
			{ voice: voiceOnboardingContainer, dictation: dictationOnboardingContainer },
			chatInputContainer,
			() => this.focus(),
			this.voiceModeOnboardingService,
			this.dictationOnboardingService,
		));

		// Getting-started tip: the canonical notice slot, directly above and
		// attached to the input, matching the workbench chat input.
		this._gettingStartedTipContainer = dom.append(chatInputContainer, dom.$(`.chat-getting-started-tip-container.${chatInputStackSlotClass}`));
		this._hostNoticeContainer = dom.append(chatInputContainer, dom.$(`.chat-input-host-notice-container.${chatInputStackSlotClass}`));

		this._promptOptionsWidget.value = this.instantiationService.createInstance(NewSessionPromptOptionsWidget, chatInputContainer, {
			selectOption: async (option, expectedInput, animate) => {
				this.focus();
				const inserted = animate
					? await this.animatePrompt(option.prompt, NEW_SESSION_PROMPT_TYPING_DURATION_MS, option.placeholder, CancellationToken.None, expectedInput)
					: this._replacePrompt(option.prompt, option.placeholder, expectedInput);
				const generatedValue = option.placeholder ? option.prompt.replace(option.placeholder, '') : option.prompt;
				if (inserted && (this._editor.getValue() === option.prompt || this._editor.getValue() === generatedValue)) {
					aria.status(localize('newSessionPromptOptions.inserted', "Inserted prompt: {0}", option.title));
				}
				return inserted;
			},
			onDidSelectOption: option => this._promptOptionsController?.onDidSelectOption(option),
			onDidClose: () => this._dismissPromptOptions(),
		});
		this._promptOptionsWidget.value.setState(this._promptOptionsState);

		// Input area inside the input slot
		const inputAreaWrapper = dom.append(chatInputContainer, dom.$('.new-chat-input-area-wrapper'));
		const inputArea = dom.append(inputAreaWrapper, dom.$('.new-chat-input-area'));

		// Attachments row (pills only) inside input area, above editor
		const contextAttachments = this._contextAttachments;
		const attachRow = dom.append(inputArea, dom.$('.sessions-chat-attach-row'));
		const attachedContextContainer = dom.append(attachRow, dom.$('.sessions-chat-attached-context'));
		this._attachedContextContainer = attachedContextContainer;
		this._contextAttachments.renderAttachedContext(attachedContextContainer);
		this._renderImplicitContext();
		this._register(this.instantiationService.createInstance(ChatDragAndDrop, () => undefined, {
			get attachments() { return contextAttachments.attachments; },
			addAttachments: (entries: readonly IChatRequestVariableEntry[]) => contextAttachments.addAttachments(...entries),
		}, {
			listForeground: inactiveSessionViewForeground,
			listBackground: inactiveSessionViewBackground,
			overlayBackground: EDITOR_DRAG_AND_DROP_BACKGROUND,
		})).addOverlay(root, root);

		this._createEditor(inputArea, editorOverflowWidgetsDomNode);
		const inputHasContent = observableFromEvent(this, this._editor.onDidChangeModelContent, () => this._editor.getValue().length > 0);
		this._register(this.chatPetWidgetService.register(this, {
			parent: chatInputContainer,
			dragBounds: inputArea,
			movementBounds: root,
			model: constObservable(undefined),
			hasInput: inputHasContent,
			inputChanged: this._editor.onDidChangeModelContent,
			// Stand on the notice docked above the input, not on the input itself.
			getPlatformTop: () => getChatPetStackPlatformTop(chatInputContainer, inputArea),
			onDidChangePlatform: Event.None,
		}, this.options.petHostPreferred, this.onDidFocus));
		this._createInputToolbar(inputArea);

		const newChatBottomContainer = dom.append(parent, dom.$('.new-chat-bottom-container'));
		const newChatControlsContainer = dom.append(newChatBottomContainer, dom.$('.new-chat-controls-container'));
		const sessionControlsContainer = this._sessionControlsContainer = dom.append(newChatControlsContainer, dom.$('.new-chat-session-controls'));
		this._register(this._scopedInstantiationService.createInstance(MenuWorkbenchToolBar, sessionControlsContainer, Menus.NewSessionControl, {
			hiddenItemStrategy: HiddenItemStrategy.NoHide,
		}));
		this._register({ dispose: () => sessionControlsContainer.remove() });

		const repoConfigContainer = dom.append(newChatBottomContainer, dom.$('.new-chat-repo-config-container'));
		this._register(this._scopedInstantiationService.createInstance(MenuWorkbenchToolBar, repoConfigContainer, Menus.NewSessionRepositoryConfig, {
			hiddenItemStrategy: HiddenItemStrategy.NoHide,
		}));

		// On phone, the chip lane is horizontally scrollable when its
		// content overflows the viewport. Native touch scroll is blocked
		// because each chip registers a `Gesture.addTarget` handler in
		// `renderPickerTrigger` that calls `preventDefault` on
		// `touchmove`, swallowing the pan. The helper below installs a
		// pointer-event-based scroll handler that no-ops on desktop and
		// kicks in once a drag crosses a small threshold on phone.
		this._register(installMobileChipLaneScroll(newChatBottomContainer, this.layoutService));

		// Generic extension point for status indicators in the new-session view.
		const statusContainer = dom.append(repoConfigContainer, dom.$('.new-chat-status-toolbar'));
		this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, statusContainer, MenuId.ChatInputStatus, {
			hiddenItemStrategy: HiddenItemStrategy.NoHide,
			toolbarOptions: { primaryGroup: () => true },
			actionViewItemProvider: (action, options) => {
				if (action.id === OTEL_STATUS_COMMAND && action instanceof MenuItemAction) {
					return this.instantiationService.createInstance(NewChatInputStatusActionViewItem, action, options);
				}
				return undefined;
			},
		}));

		this._secondaryPickerResponsiveLayout = this._register(new ChatInputPickerResponsiveLayout('NewChatInput.secondaryPicker', newChatBottomContainer, {
			getItems: () => getLabeledPickerResponsiveItems(newChatBottomContainer),
		}));
		this._secondaryPickerResponsiveLayout.layout();

		// Restore draft input state from storage
		this._restoreState();

		// The composer is a stack, and was just added to its host's stack. Hosts
		// often dock a notice - the sub-session tip, a feedback banner - before
		// this point, and nothing reports for a child being added.
		//
		// Standalone, not docked: the composer draws its own frame, so a notice
		// above it joins it but the run stops before the controls row below.
		setChatInputStackSlot(chatInputContainer, ChatInputStackSlot.Standalone);
		refreshChatInputStack(parent);

		// Layout editor after the input slot fade-in animation completes
		this._register(dom.addDisposableListener(chatInputContainer, 'animationend', () => {
			this._editor?.layout();
		}, { once: true }));
	}

	private _updateInputLoadingState(): void {
		const loading = this._sending;
		if (loading) {
			if (!this._loadingDelayDisposable.value) {
				const timer = setTimeout(() => {
					this._loadingDelayDisposable.clear();
					if (this._sending) {
						this._loadingSpinner?.classList.add('visible');
					}
				}, 500);
				this._loadingDelayDisposable.value = toDisposable(() => clearTimeout(timer));
			}
		} else {
			this._loadingDelayDisposable.clear();
			this._loadingSpinner?.classList.remove('visible');
		}
	}

	// --- Editor ---

	private _getAriaLabel(): string {
		const verbose = this.configurationService.getValue<boolean>(AccessibilityVerbositySettingId.SessionsChat);
		if (verbose) {
			const kbLabel = this.keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp)?.getLabel();
			return kbLabel
				? localize('chatInput.accessibilityHelp', "Chat input. Press Enter to send out the request. Use {0} for Chat Accessibility Help.", kbLabel)
				: localize('chatInput.accessibilityHelpNoKb', "Chat input. Press Enter to send out the request. Use the Chat Accessibility Help command for more information.");
		}
		return localize('chatInput', "Chat input");
	}

	private _getTerminalCommandPrefix(): string | undefined {
		const session = this.options.session.get();
		return session ? this.chatSessionsService.getCapabilitiesForSessionType(getChatSessionType(session.resource))?.terminalCommandPrefix : undefined;
	}

	private _handleTerminalCommandPaste(e: ClipboardEvent): void {
		handleTerminalCommandPaste(e, this._editor, this._getTerminalCommandPrefix(), this.dialogService, this.storageService);
	}

	/**
	 * Paste edits are applied through the bulk edit service, which resolves the
	 * input model and force-destroys it when the last reference is released.
	 * Holding one keeps the model alive for this editor's lifetime.
	 */
	private _holdInputModelReference(uri: URI, model: ITextModel): void {
		const inputModelReference = thenRegisterOrDispose(this.textModelService.createModelReference(uri), this._store);
		void inputModelReference.catch(error => {
			model.dispose();
			if (!this._store.isDisposed) {
				this.logService.error('Failed to hold the chat input model reference', error);
			}
		});
	}

	private _createEditor(container: HTMLElement, overflowWidgetsDomNode: HTMLElement): void {
		const editorContainer = this._editorContainer = dom.append(container, dom.$('.sessions-chat-editor'));
		const minHeight = this.options.minEditorHeight ?? MIN_EDITOR_HEIGHT;
		editorContainer.style.height = `${minHeight}px`;

		// Create scoped context key service and register history navigation
		// BEFORE creating the editor, so the editor's context key scope is a child
		const inputScopedContextKeyService = this._register(this.contextKeyService.createScoped(container));
		const { historyNavigationBackwardsEnablement, historyNavigationForwardsEnablement } = this._register(registerAndCreateHistoryNavigationContext(inputScopedContextKeyService, this));
		this._historyNavigationBackwardsEnablement = historyNavigationBackwardsEnablement;
		this._historyNavigationForwardsEnablement = historyNavigationForwardsEnablement;

		const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, inputScopedContextKeyService])));

		const uri = URI.from({ scheme: Schemas.sessionsChatInput, path: `input-${Date.now()}` });
		const textModel = this.modelService.createModel('', null, uri, true);
		this._holdInputModelReference(uri, textModel);

		const editorOptions: IEditorConstructionOptions = {
			...getSimpleEditorOptions(this.configurationService),
			readOnly: false,
			// Match the workbench chat input so the post-paste selector is offered.
			pasteAs: EditorOptions.pasteAs.defaultValue,
			ariaLabel: this._getAriaLabel(),
			placeholder: this.options.placeholder ?? getRandomChatInputPlaceholder(),
			fontFamily: NEW_CHAT_INPUT_FONT_FAMILY,
			fontSize: 13,
			lineHeight: 20,
			cursorWidth: 1,
			padding: { top: 8, bottom: 2 },
			wrappingStrategy: 'advanced',
			stickyScroll: { enabled: false },
			renderWhitespace: 'none',
			scrollbar: {
				horizontal: 'hidden',
				alwaysConsumeMouseWheel: false,
				vertical: 'auto',
				verticalScrollbarSize: 7,
			},
			overflowWidgetsDomNode,
			suggest: {
				showIcons: true,
				showSnippets: false,
				showWords: true,
				showStatusBar: false,
				insertMode: 'insert',
				fitWidthToDetails: true,
			},
		};

		const widgetOptions: ICodeEditorWidgetOptions = {
			isSimpleWidget: true,
			contributions: EditorExtensionsRegistry.getSomeEditorContributions([
				ContextMenuController.ID,
				SuggestController.ID,
				SnippetController2.ID,
				PlaceholderTextContribution.ID,
				CopyPasteController.ID,
			]),
		};

		this._editor = this._register(scopedInstantiationService.createInstance(
			CodeEditorWidget, editorContainer, editorOptions, widgetOptions,
		));
		this._editor.setModel(textModel);
		this._promptTemplatePlaceholder.value = new PromptTemplatePlaceholderController(this._editor, () => this._promptTypingAnimation.value?.complete());
		this._register(autorun(reader => {
			// Re-evaluate when the attached session changes; content changes are
			// handled by the model-content listener below.
			this.options.session.read(reader);
			this._updateEditorFontFamily();
		}));
		// Attach to the container (not `getDomNode()`, which is null until the
		// editor has a model) so the capture-phase paste veto is always wired up.
		this._register(dom.addDisposableListener(this._editorContainer, dom.EventType.PASTE, e => this._handleTerminalCommandPaste(e), true));

		// Ensure suggest widget renders above the input (not clipped by container)
		SuggestController.get(this._editor)?.forceRenderingAbove();

		// Update aria label when accessibility verbosity setting changes
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(AccessibilityVerbositySettingId.SessionsChat)) {
				this._editor.updateOptions({ ariaLabel: this._getAriaLabel() });
			}
		}));

		const dictationFocusKey = SessionsChatInputHasDictationFocus.bindTo(inputScopedContextKeyService);
		// The composer is a chat input, so it carries the shared focus key that
		// chat input keybindings such as paste as text are scoped to.
		const inputHasFocusKey = ChatContextKeys.inputHasFocus.bindTo(inputScopedContextKeyService);
		this._register(this._editor.onDidFocusEditorWidget(() => {
			dictationFocusKey.set(true);
			inputHasFocusKey.set(true);
			activeDictationComposer = this;
			this._onDidFocus.fire();
		}));
		this._register(this._editor.onDidBlurEditorWidget(() => {
			dictationFocusKey.set(false);
			inputHasFocusKey.set(false);
			if (activeDictationComposer === this) {
				activeDictationComposer = undefined;
			}
			this._onDidBlur.fire();
		}));
		this._register(toDisposable(() => {
			if (activeDictationComposer === this) {
				activeDictationComposer = undefined;
			}
		}));

		this._register(this._editor.onKeyDown(e => {
			if (e.browserEvent.defaultPrevented) {
				return;
			}
			if (e.keyCode === KeyCode.Enter && !e.shiftKey && !e.ctrlKey && !e.altKey && this._promptTemplatePlaceholder.value?.replaceAtCursor()) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}
			if (e.keyCode === KeyCode.Enter && !e.shiftKey && !e.ctrlKey && !e.altKey) {
				if (newChatEnterYieldsToSuggest(key => this._editor.contextKeyService.getContextKeyValue(key))) {
					return;
				}
				e.preventDefault();
				e.stopPropagation();
				this._send();
			}
			// Alt+Enter — send in the background without navigating into the session
			if (this.options.supportsBackground && e.keyCode === KeyCode.Enter && !e.shiftKey && !e.ctrlKey && e.altKey) {
				e.preventDefault();
				e.stopPropagation();
				this._send(true);
			}
			// Cmd+/ / Ctrl+/ — open the context picker (same as the attach button)
			if (e.equals(KeyMod.CtrlCmd | KeyCode.Slash)) {
				e.preventDefault();
				e.stopPropagation();
				this._contextAttachments.showPicker(this.options.getContextFolderUri());
			}
		}));

		// Update history navigation enablement based on cursor position
		const updateHistoryNavigationEnablement = () => {
			const model = this._editor.getModel();
			const position = this._editor.getPosition();
			if (!model || !position) {
				return;
			}
			this._historyNavigationBackwardsEnablement.set(position.lineNumber === 1 && position.column === 1);
			this._historyNavigationForwardsEnablement.set(position.lineNumber === model.getLineCount() && position.column === model.getLineMaxColumn(position.lineNumber));
		};
		this._register(this._editor.onDidChangeCursorPosition(() => updateHistoryNavigationEnablement()));
		updateHistoryNavigationEnablement();

		let previousHeight = -1;
		this._register(this._editor.onDidContentSizeChange(e => {
			if (!e.contentHeightChanged) {
				return;
			}
			const contentHeight = this._editor.getContentHeight();
			const clampedHeight = Math.min(MAX_EDITOR_HEIGHT, Math.max(this.options.minEditorHeight ?? MIN_EDITOR_HEIGHT, contentHeight));
			if (clampedHeight === previousHeight) {
				return;
			}
			previousHeight = clampedHeight;
			this._editorContainer.style.height = `${clampedHeight}px`;
			this._editor.layout();
		}));

		// Slash commands
		this._register(this._scopedInstantiationService.createInstance(SlashCommandHandler, this._editor));

		// Variable completions (#file, #folder)
		this._register(this.instantiationService.createInstance(
			VariableCompletionHandler, this._editor, this._contextAttachments, () => this.options.getContextFolderUri(),
		));

		// Session reference completions (#session)
		this._register(this.instantiationService.createInstance(
			SessionReferenceCompletionHandler, this._editor, this._contextAttachments,
		));

		this._agentHostInputCompletionHandler = this._register(this._scopedInstantiationService.createInstance(
			AgentHostInputCompletionHandler, this._editor, this._contextAttachments,
		));

		this._register(this.chatPasteTargetService.registerTarget(textModel.uri, new NewChatInputPasteTarget(
			this._editor,
			this._contextAttachments,
			this._agentHostInputCompletionHandler,
			() => this._getTerminalCommandPrefix(),
			() => this.options.session.get()?.resource,
			textModel.uri,
		)));

		this._register(this._editor.onDidChangeModelContent(() => {
			this._updateDraftState();
			this._updateSendButtonState();
			this._updateEditorFontFamily();
			this._promptOptionsWidget.value?.setInputValue(this._editor.getValue());
		}));
	}

	/**
	 * The input is monospace only while a terminal command is being composed:
	 * the attached session advertises a prefix AND the current input begins with
	 * it. Otherwise it uses the normal new-chat input font.
	 */
	private _updateEditorFontFamily(): void {
		const isCommand = isTerminalCommandInput(this._editor.getModel()?.getLineContent(1) || '', this._getTerminalCommandPrefix());
		this._editor.updateOptions({ fontFamily: isCommand ? EDITOR_FONT_DEFAULTS.fontFamily : NEW_CHAT_INPUT_FONT_FAMILY });
	}

	private _createAttachButton(container: HTMLElement): void {
		const attachButton = dom.append(container, dom.$('.sessions-chat-attach-button'));
		const attachButtonLabel = localize('addContext', "Add Context...");
		attachButton.tabIndex = 0;
		attachButton.role = 'button';
		attachButton.ariaLabel = attachButtonLabel;
		this._register(this.hoverService.setupDelayedHover(attachButton, {
			content: attachButtonLabel,
			position: { hoverPosition: HoverPosition.BELOW },
			appearance: { showPointer: true }
		}));
		dom.append(attachButton, renderIcon(Codicon.addCompact));
		this._register(dom.addDisposableListener(attachButton, dom.EventType.CLICK, () => {
			this._contextAttachments.showPicker(this.options.getContextFolderUri());
		}));
	}

	private _createToolsButton(container: HTMLElement): void {
		const toolsButton = this._toolsButton = dom.append(container, dom.$('.sessions-chat-attach-button.sessions-chat-tools-button'));
		toolsButton.style.display = 'none';
		const toolsLabel = localize('configureTools', "Configure Tools...");
		toolsButton.tabIndex = 0;
		toolsButton.role = 'button';
		toolsButton.ariaLabel = toolsLabel;
		this._register(this.hoverService.setupDelayedHover(toolsButton, {
			content: toolsLabel,
			position: { hoverPosition: HoverPosition.BELOW },
			appearance: { showPointer: true }
		}));
		dom.append(toolsButton, renderIcon(Codicon.settingsCompact));
		const open = () => { void this._configureTools().catch(onUnexpectedError).catch(onUnexpectedError); };
		this._register(dom.addDisposableListener(toolsButton, dom.EventType.CLICK, open));
		this._register(dom.addDisposableListener(toolsButton, dom.EventType.KEY_DOWN, e => {
			const event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
				dom.EventHelper.stop(event, true);
				open();
			}
		}));
		this._applyToolsButton(this._chatMode.get(), this._modelSelection.state.get().currentModel);
	}

	private _bindComposerChatMode(session: IActiveSession | undefined, selected: { readonly id: string; readonly kind: string } | undefined): void {
		const needsCustom = !!selected
			&& selected.id !== ChatMode.Agent.id
			&& selected.id !== ChatMode.Ask.id
			&& selected.id !== ChatMode.Edit.id;
		if (!needsCustom || !session) {
			this._customModes.clear();
			this._chatMode.set(resolveComposerChatMode(selected, () => undefined), undefined);
			return;
		}
		const modes = this.chatModeService.createModes(session.resource);
		const store = new DisposableStore();
		store.add(modes);
		const apply = () => this._chatMode.set(resolveComposerChatMode(selected, id => modes.findModeById(id)), undefined);
		store.add(modes.onDidChange(apply));
		this._customModes.value = store;
		apply();
	}

	private _setImplicitEnabled(enabled: boolean): void {
		if (this._implicitEnabled === enabled) {
			return;
		}
		this._implicitEnabled = enabled;
		this._implicitContexts.setEnabled(enabled);
	}

	/** Show Configure Tools only when this composer has a resolved mode and a selected model. */
	private _applyToolsButton(mode: IChatMode | undefined, model: ILanguageModelChatMetadataAndIdentifier | undefined): void {
		const show = !!mode && !!model && !this._toolsFailed;
		if (this._toolsButton) {
			this._toolsButton.style.display = show ? '' : 'none';
		}
		if (!show || !mode || !this._toolsLanguageModel) {
			return;
		}
		this._toolsMode.set(mode, undefined);
		if (!this._selectedTools) {
			try {
				this._selectedTools = this._register(this.instantiationService.createInstance(ChatSelectedTools, this._toolsMode, this._toolsLanguageModel));
			} catch (error) {
				this._toolsFailed = true;
				if (this._toolsButton) {
					this._toolsButton.style.display = 'none';
				}
				this.logService.error('Failed to create new-session tools model:', error);
			}
		}
	}

	private async _configureTools(): Promise<void> {
		const mode = this._chatMode.get();
		const model = this._modelSelection.state.get().currentModel;
		const tools = this._selectedTools;
		if (!mode || !model || !tools) {
			return;
		}
		const label = mode.label.get();
		let placeholder: string;
		let description: string;
		switch (tools.entriesScope) {
			case ToolsScope.Session:
				placeholder = localize('chat.tools.placeholder.session', "Select tools for this chat session");
				description = localize('chat.tools.description.session', "The selected tools were configured only for this chat session.");
				break;
			case ToolsScope.Agent:
				placeholder = localize('chat.tools.placeholder.agent', "Select tools for this custom agent");
				description = localize('chat.tools.description.agent', "The selected tools are configured by the '{0}' custom agent. Changes to the tools will be applied to the custom agent file as well.", label);
				break;
			case ToolsScope.Agent_ReadOnly:
				placeholder = localize('chat.tools.placeholder.readOnlyAgent', "Select tools for this custom agent");
				description = localize('chat.tools.description.readOnlyAgent', "The selected tools are configured by the '{0}' custom agent. Changes to the tools will only be used for this session and will not change the '{0}' custom agent.", label);
				break;
			case ToolsScope.Global:
			default:
				placeholder = localize('chat.tools.placeholder.global', "Select tools that are available to chat.");
				description = localize('chat.tools.description.global', "The selected tools will be applied globally for all chat sessions that use the default agent.");
				break;
		}
		const cts = new CancellationTokenSource();
		const initialModeId = mode.id;
		const modeListener = autorun(reader => {
			if (this._chatMode.read(reader)?.id !== initialModeId) {
				cts.cancel();
			}
		});
		try {
			const result = await this.instantiationService.invokeFunction(showToolsPicker, placeholder, 'newChatInput', description, () => tools.entriesMap.get(), model.metadata, cts.token);
			if (result && this._chatMode.get()?.id === initialModeId) {
				tools.set(result, false);
			}
		} finally {
			modeListener.dispose();
			cts.dispose();
		}
	}

	private _trackActiveEditorImplicitContext(): void {
		const update = () => this._updateImplicitContextFromActiveEditor();
		this._register(this.editorService.onDidActiveEditorChange(() => {
			this._implicitEditorListeners.clear();
			const codeEditor = this._activeEditorCodeEditor();
			if (codeEditor) {
				this._implicitEditorListeners.value = Event.debounce(
					Event.any(codeEditor.onDidChangeModel, codeEditor.onDidChangeCursorSelection),
					() => undefined,
					500,
				)(update);
			}
			update();
		}));
		update();
	}

	private _activeEditorCodeEditor() {
		const resource = this.editorService.activeEditor?.resource;
		const control = this.editorService.activeEditorPane?.getControl();
		const codeEditor = control ? getCodeEditor(control) : undefined;
		const modelUri = codeEditor?.getModel()?.uri;
		if (!codeEditor || !resource || !modelUri || !isEqual(modelUri, resource) || modelUri.scheme === Schemas.sessionsChatInput) {
			return undefined;
		}
		return codeEditor;
	}

	private _updateImplicitContextFromActiveEditor(): void {
		const resource = this.editorService.activeEditor?.resource;
		const editorSelection = this._activeEditorCodeEditor()?.getSelection();
		const selection = editorSelection ? { isEmpty: editorSelection.isEmpty(), range: editorSelection } : undefined;
		const next = implicitContextValueForEditor(resource, selection);
		if (next.value) {
			this._implicitContexts.setValues([next]);
		} else {
			this._implicitContexts.setValues([]);
		}
	}

	private _isImplicitAlreadyAttached(targetUri: URI | undefined, targetRange: IRange | undefined, targetHandle: number | undefined): boolean {
		return this._contextAttachments.attachments.some(attachment => {
			const attachmentUri = URI.isUri(attachment.value) ? attachment.value : isLocation(attachment.value) ? attachment.value.uri : undefined;
			const attachmentRange = isLocation(attachment.value) ? attachment.value.range : undefined;
			if (targetHandle !== undefined && isStringVariableEntry(attachment) && attachment.handle === targetHandle) {
				return true;
			}
			if (targetUri && attachmentUri && isEqual(targetUri, attachmentUri)) {
				if (targetRange && attachmentRange) {
					return Range.equalsRange(targetRange, attachmentRange);
				}
				return !targetRange && !attachmentRange;
			}
			return false;
		});
	}

	private _renderImplicitContext(): void {
		const container = this._attachedContextContainer;
		this._implicitWidget.clear();
		this._implicitHost?.remove();
		this._implicitHost = undefined;
		if (!container || !this._implicitContexts?.hasValue) {
			return;
		}
		if (!this._implicitLabels) {
			this._implicitLabels = this._register(this.instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER));
		}
		if (!this._implicitAttachmentModel) {
			this._implicitAttachmentModel = this._register(this.instantiationService.createInstance(ChatAttachmentModel));
			this._register(this._implicitAttachmentModel.onDidChange(e => {
				if (e.added.length > 0) {
					this._contextAttachments.addAttachments(...e.added);
				}
			}));
		}
		const host = dom.append(container, dom.$('.sessions-chat-attached-context'));
		const widget = this.instantiationService.createInstance(
			ImplicitContextAttachmentWidget,
			() => undefined,
			(targetUri: URI | undefined, targetRange: IRange | undefined, targetHandle: number | undefined) => this._isImplicitAlreadyAttached(targetUri, targetRange, targetHandle),
			this._implicitContexts,
			this._implicitLabels,
			this._implicitAttachmentModel,
			host,
		);
		if (!widget.hasRenderedContexts) {
			widget.dispose();
			host.remove();
			return;
		}
		this._implicitHost = host;
		this._implicitWidget.value = widget;
	}

	private _createInputToolbar(container: HTMLElement): void {
		const toolbar = dom.append(container, dom.$('.sessions-chat-toolbar'));
		let dictationActionVisible = false;
		let voiceActionCount = 0;
		const updateVoiceInputActionBorder = () => {
			toolbar.classList.toggle('sessions-chat-voice-input-actions-multiple', Number(dictationActionVisible) + voiceActionCount > 1);
		};

		this._createAttachButton(toolbar);
		this._createToolsButton(toolbar);

		// Session config pickers (such as model) — rendered via MenuWorkbenchToolBar
		// Visibility controlled by context keys (isActiveSessionBackgroundProvider, isNewChatSession)
		const configContainer = dom.append(toolbar, dom.$('.sessions-chat-config-toolbar'));
		const configToolbar = this._register(this._scopedInstantiationService.createInstance(MenuWorkbenchToolBar, configContainer, Menus.NewSessionConfig, {
			hiddenItemStrategy: HiddenItemStrategy.NoHide,
			actionViewItemProvider: (action) => {
				if (action.id === 'sessions.modelPicker') {
					const picker = this._scopedInstantiationService.createInstance(ModelPicker, this._compactModelPicker);
					return new ModelPickerActionViewItem(picker);
				}
				return undefined;
			},
		}));

		// Dictation mic. Hosts the editor chat input's dictation view item in the
		// slot before the voice controls. The action dictates into this composer.
		try {
			this._createSpeechToTextButton(toolbar, visible => {
				dictationActionVisible = visible;
				updateVoiceInputActionBorder();
			});
		} catch (error) {
			this.logService.error('Failed to create new-session dictation control:', error);
		}

		// Voice controls (mic/stop/settings/disconnect). The hand-built toolbar
		// can't use the shared `MenuId.ChatExecute`, so a dedicated menu is used.
		// Keep the session picker usable when optional voice initialization fails.
		// The controller also handles voice target routing + input glow, which the
		// segmented pill relies on, so it is created regardless of the pill; its
		// toolbar items hide (via `when`) when the pill is active.
		const voiceContainer = dom.append(toolbar, dom.$('.sessions-chat-voice-toolbar'));
		try {
			this._register(this.instantiationService.createInstance(NewChatVoiceController, {
				toolbarContainer: voiceContainer,
				inputContainer: container,
				composer: this,
				onDidChangeActions: actionCount => {
					voiceActionCount = actionCount;
					updateVoiceInputActionBorder();
				},
			}));
		} catch (error) {
			this.logService.error('Failed to create new-session voice controls:', error);
		}

		// Segmented voice/dictation pill (experimental). When enabled it replaces the
		// standalone dictation button and voice controls above with a single control.
		try {
			this._createVoiceInputModePill(toolbar, container);
		} catch (error) {
			this.logService.error('Failed to create new-session voice input mode pill:', error);
		}

		// `options.loading` is draft init (`session.loading`). ISession has no
		// cancel that stops that state, so this stays a spinner. The round
		// button remains Send.
		this._loadingSpinner = dom.append(toolbar, dom.$('.sessions-chat-loading-spinner'));
		const loadingIcon = dom.append(this._loadingSpinner, renderIcon(ThemeIcon.modify(Codicon.loading, 'spin')));
		loadingIcon.setAttribute('aria-hidden', 'true');
		this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), this._loadingSpinner, localize('loading', "Loading...")));
		this._loadingSpinner.classList.toggle('visible', this.options.loading.get());

		if (this.options.renderSendButton !== false) {
			const sendButtonContainer = dom.append(toolbar, dom.$('.sessions-chat-send-button'));
			const sendButton = this._sendButton = this._register(new Button(sendButtonContainer, {
				secondary: true,
				title: this.options.supportsBackground
					? localize('sendWithBackgroundHint', "Send (Alt-click to start in the background)")
					: localize('send', "Send"),
				ariaLabel: localize('send', "Send"),
			}));
			sendButton.icon = Codicon.arrowUpCompact;
			// Hold Alt while clicking Send to start the session in the background.
			this._register(sendButton.onDidClick(e => this._send(!!this.options.supportsBackground && !!(e as MouseEvent | KeyboardEvent | undefined)?.altKey)));
		}
		updateVoiceInputActionBorder();

		this._primaryPickerResponsiveLayout = this._register(new ChatInputPickerResponsiveLayout('NewChatInput.primaryPicker', configContainer, {
			getItems: () => {
				const items: IChatInputPickerResponsiveLayoutItem[] = [];
				for (let index = 0; index < configToolbar.getItemsLength(); index++) {
					const element = configToolbar.getItemElement(index);
					if (!element) {
						continue;
					}
					items.push({
						element,
						isCompact: () => element.classList.contains('compact-picker'),
						setCompact: (compact: boolean) => {
							element.classList.toggle('compact-picker', compact);
							if (configToolbar.getItemAction(index)?.id === 'sessions.modelPicker') {
								this._compactModelPicker.set(compact, undefined);
							}
						},
					});
				}
				return items;
			},
			hasOverflow: () => configToolbar.hasOverflow(),
			relayout: () => configToolbar.relayout(),
		}));
		this._primaryPickerResponsiveLayout.layout();
	}

	private _createVoiceInputModePill(toolbar: HTMLElement, inputContainer: HTMLElement): void {
		const pillContainer = dom.append(toolbar, dom.$('.sessions-chat-voice-input-mode'));
		const isVoiceInputActive = derived(this, reader => isEqual(this.newChatVoiceTargetService.currentVoiceInputResource.read(reader), NEW_CHAT_VOICE_SENTINEL));
		const isDictationInputActive = observableFromEvent(
			this,
			Event.any(this.chatSpeechToTextService.onDidChangeState, this.chatSpeechToTextService.onDidChangePreparingModel, onDidChangeDictationEditor),
			() => isDictationActiveForEditor(this._editor),
		);
		const isVoiceSessionActive = derived(this, reader => isNewChatVoiceSessionActive(
			this.voiceSessionController.isConnected.read(reader),
			this.voiceSessionController.isConnecting.read(reader),
			this.voiceSessionController.targetSession.read(reader),
			this.voiceSessionController.hasDraftTarget.read(reader),
		));

		const action = toAction({
			id: ChatVoiceInputModeAction.ID,
			label: localize('voiceInputMode', "Voice Input Mode"),
			run: () => { /* interaction handled by the view item */ },
		});
		const pill = this._register(this._scopedInstantiationService.createInstance(VoiceInputModeActionViewItem, action, {
			// Dictation must target this composer's editor, not the last focused
			// chat widget (this composer isn't an `IChatWidget`).
			toggleDictation: () => { void this.toggleDictation().catch(onUnexpectedError).catch(onUnexpectedError); },
			isActive: isVoiceInputActive,
			isDictationActive: isDictationInputActive,
			isVoiceActive: isVoiceSessionActive,
		}));
		pill.render(pillContainer);

		// The pill only earns its place when it would host at least two cells:
		//   - both dictation and Voice Mode are available, or
		//   - only Voice Mode is available in manual (non-hands-free) mode AND a
		//     session is active, so listen + voice-connection cells both render.
		// Otherwise the standalone dictation + voice controls show instead.
		this._register(autorun(reader => {
			const dict = this.voiceInputModeService.dictationAvailable.read(reader);
			const voice = this.voiceInputModeService.voiceAvailable.read(reader);
			const handsFree = this.voiceInputModeService.handsFree.read(reader);
			// The voice-only branch's "session active" must match the main-window
			// `AGENTS_VOICE_CONNECTED` context key, which tracks `isConnected` only.
			// Counting `isConnecting` here would show the pill while the scoped
			// standalone toolbar still shows its Connecting item (duplicate controls).
			const connected = isVoiceSessionActive.read(reader) && this.voiceSessionController.isConnected.read(reader);
			const pillActive = (dict && voice) || (voice && !dict && !handsFree && connected);
			pillContainer.classList.toggle('hidden', !pillActive);
			// Mirror the pill's active state onto the input container so voice glow
			// styling (driven by the voice controller) stays consistent.
			inputContainer.classList.toggle('voice-input-mode-pill', pillActive);
		}));
	}

	private _createSpeechToTextButton(container: HTMLElement, onDidChangeVisibility: (visible: boolean) => void): void {
		const sttService = this.chatSpeechToTextService;
		const isDictationInputActive = observableFromEvent(
			this,
			Event.any(sttService.onDidChangeState, sttService.onDidChangePreparingModel, onDidChangeDictationEditor),
			() => isDictationActiveForEditor(this._editor),
		);

		// Stable slot so swapping the view item (which removes its element on
		// dispose) does not move the mic to the end of the toolbar.
		const slot = dom.append(container, dom.$('.sessions-chat-stt-slot'));
		const viewItem = this._register(new MutableDisposable<MenuEntryActionViewItem>());
		const dictateLabel = localize('sessionsStt.dictate', "Dictate (Speech to Text)");
		const stopLabel = localize('sessionsStt.stop', "Stop Dictation");
		// Kept as a named helper so the fire-and-forget catch scan still sees one
		// double-caught toggle. The view item awaits this instead of the global
		// Dictate command.
		const toggle = () => this.toggleDictation().catch(onUnexpectedError).catch(onUnexpectedError);
		let renderedMode = '';

		const renderDictationButton = () => {
			const active = isDictationActiveForEditor(this._editor);
			const preparing = active && sttService.isPreparingModel;
			// Recording flips back to the idle mic as soon as transcription starts,
			// matching the chat toolbar. The glow stays up through the settling phase.
			const recording = active && sttService.state === ChatSpeechToTextState.Recording;
			const mode = preparing ? 'preparing' : recording ? 'recording' : 'idle';
			if (mode === renderedMode && viewItem.value) {
				return;
			}

			const connecting = preparing && this.configurationService.getValue<string>(DICTATION_MODEL_SETTING) === DICTATION_MAI_MODEL_ID;
			const title = preparing
				? (connecting
					? localize('sessionsStt.connecting', "Connecting to Speech to Text…")
					: localize('sessionsStt.preparing', "Preparing Speech to Text Model…"))
				: (recording ? stopLabel : dictateLabel);
			const action = this._scopedInstantiationService.createInstance(NewChatDictationMenuAction, {
				id: TOGGLE_DICTATION_COMMAND_ID,
				title,
				tooltip: title,
				icon: preparing
					? (sttService.isDownloadingModel ? Codicon.micDownloadCompact : Codicon.loadingCompact)
					: Codicon.micCompact,
				toggled: !preparing && recording ? {
					condition: ContextKeyExpr.true(),
					icon: Codicon.micFilled,
					title: stopLabel,
				} : undefined,
			}, toggle);

			viewItem.clear();
			dom.clearNode(slot);
			const button = dom.append(slot, dom.$('.sessions-chat-stt-button'));
			// Preparing swaps in the download/connecting view item, the same split
			// the editor toolbar makes with MenuId.ChatExecute. Both actions run
			// this composer's toggle, which cancels a preparing session.
			const item = preparing
				? this._scopedInstantiationService.createInstance(DictationDownloadActionViewItem, action, undefined, TOGGLE_DICTATION_COMMAND_ID)
				: this._scopedInstantiationService.createInstance(DictationActionViewItem, action, undefined, isDictationInputActive);
			viewItem.value = item;
			item.render(button);
			item.setFocusable(true);
			renderedMode = mode;
		};
		renderDictationButton();
		this._register(Event.any(sttService.onDidChangeState, sttService.onDidChangePreparingModel, onDidChangeDictationEditor)(renderDictationButton));

		// The view item's label is an anchor, which does not activate on Enter/Space.
		this._register(dom.addDisposableListener(slot, dom.EventType.KEY_DOWN, e => {
			const event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
				dom.EventHelper.stop(event, true);
				void toggle();
			}
		}));

		const updateVisibility = () => {
			// Mirror the `MenuId.ChatExecute` dictation gate: hide while
			// unconfigured, and while Voice Mode is connected so the dictation and
			// voice mic affordances never compete on this composer. Also hide when
			// the segmented voice/dictation pill applies (both modes available, so
			// the pill hosts its own dictation cell), which supersedes this button.
			const voiceActive = isNewChatVoiceSessionActive(
				this.voiceSessionController.isConnected.get(),
				this.voiceSessionController.isConnecting.get(),
				this.voiceSessionController.targetSession.get(),
				this.voiceSessionController.hasDraftTarget.get(),
			);
			const dict = this.voiceInputModeService.dictationAvailable.get();
			const voice = this.voiceInputModeService.voiceAvailable.get();
			const handsFree = this.voiceInputModeService.handsFree.get();
			// Match the pill autorun / `AGENTS_VOICE_CONNECTED`: the voice-only branch
			// keys off `isConnected` only, not the connecting phase.
			const sessionActive = this.voiceSessionController.isConnected.get();
			const pillActive = (dict && voice) || (voice && !dict && !handsFree && sessionActive);
			// Honor the shared `dictation.showButton` visibility toggle: hiding the
			// button still leaves Cmd/Ctrl+I working (its keybinding is independent).
			const buttonShown = this.configurationService.getValue<boolean>(DictationSettingId.ShowButton) !== false;
			const visible = sttService.isConfigured && !voiceActive && !pillActive && buttonShown;
			slot.classList.toggle('hidden', !visible);
			onDidChangeVisibility(visible);
		};
		updateVisibility();
		this._register(autorun(reader => {
			this.voiceSessionController.isConnected.read(reader);
			this.voiceSessionController.isConnecting.read(reader);
			this.voiceSessionController.targetSession.read(reader);
			this.voiceSessionController.hasDraftTarget.read(reader);
			this.voiceInputModeService.dictationAvailable.read(reader);
			this.voiceInputModeService.voiceAvailable.read(reader);
			this.voiceInputModeService.handsFree.read(reader);
			updateVisibility();
		}));
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			// Both the enable kill-switch and the model selection can change
			// availability (e.g. an unsupported on-device platform becomes
			// configured when switching to the cloud backend).
			if (e.affectsConfiguration('dictation.enabled') || e.affectsConfiguration('dictation.model') || e.affectsConfiguration(DictationSettingId.ShowButton)) {
				updateVisibility();
			}
		}));
	}

	/**
	 * Toggle dictation into this composer's editor. Shared by the mic button and
	 * the Cmd/Ctrl+I chord ({@link TOGGLE_DICTATION_COMMAND_ID}); the shared
	 * Dictate action can't target this composer since it isn't an `IChatWidget`.
	 */
	async toggleDictation(): Promise<void> {
		if (!this._editor) {
			return;
		}
		await runDictationShortcut({
			speechService: this.chatSpeechToTextService,
			keybindingService: this.keybindingService,
			logService: this.logService,
			onboardingService: this.dictationOnboardingService,
		}, TOGGLE_DICTATION_COMMAND_ID, this._editor);
	}

	// --- Input History (IHistoryNavigationWidget) ---

	showPreviousValue(): void {
		if (this._history.isAtStart()) {
			return;
		}
		if (this._draftState?.inputText || this._draftState?.attachments.length) {
			this._history.overlay(this._toHistoryEntry(this._draftState));
		}
		this._navigateHistory(true);
	}

	showNextValue(): void {
		if (this._history.isAtEnd()) {
			return;
		}
		if (this._draftState?.inputText || this._draftState?.attachments.length) {
			this._history.overlay(this._toHistoryEntry(this._draftState));
		}
		this._navigateHistory(false);
	}

	private _updateDraftState(): void {
		this._draftState = {
			inputText: this._editor?.getModel()?.getValue() ?? '',
			attachments: [...this._contextAttachments.attachments],
		};
	}

	private _toHistoryEntry(draft: IDraftState): IChatModelInputState {
		return {
			...draft,
			mode: { id: ChatModeKind.Agent, kind: ChatModeKind.Agent },
			selectedModel: undefined,
			selections: [],
			contrib: {},
		};
	}

	private _navigateHistory(previous: boolean): void {
		const entry = previous ? this._history.previous() : this._history.next();
		const inputText = entry?.inputText ?? '';
		if (entry) {
			this._editor?.getModel()?.setValue(inputText);
			this._contextAttachments.setAttachments(entry.attachments);
		}
		aria.status(inputText);
		if (previous) {
			this._editor.setPosition({ lineNumber: 1, column: 1 });
		} else {
			const model = this._editor.getModel();
			if (model) {
				const lastLine = model.getLineCount();
				this._editor.setPosition({ lineNumber: lastLine, column: model.getLineMaxColumn(lastLine) });
			}
		}
	}

	// --- Send ---


	async submit(background = false): Promise<boolean> {
		return this._send(background);
	}

	private async _send(background = false): Promise<boolean> {
		const rawQuery = this._editor.getModel()?.getValue() ?? '';
		const query = rawQuery.trim();
		const queryOffset = rawQuery.length - rawQuery.trimStart().length;
		const hasAdditionalSendContent = this.options.hasAdditionalSendContent?.get() ?? false;
		if (!hasSendableNewChatContent(query, this._contextAttachments.attachments, hasAdditionalSendContent) || this._sending) {
			return false;
		}

		// Respect the same gate as the send button (e.g. a session with no
		// usable model). The Enter keybinding and slash-command paths reach
		// here directly, bypassing the button's disabled state.
		if (!this._canSendRequest.get()) {
			return false;
		}

		// Measure any pending dictation accuracy against the text being sent,
		// before the editor is cleared below.
		notifyDictationSubmitted(this._editor);

		const generation = ++this._sendGeneration;
		this._sending = true;
		this._updateSendButtonState();

		const session = this.options.session.get();
		if (!hasAdditionalSendContent && session && await this.chatSubmitRequestHandlerService.tryHandle({
			sessionResource: session.resource,
			providerId: session.providerId,
			sessionId: session.sessionId,
			input: query,
		})) {
			if (generation !== this._sendGeneration || this._store.isDisposed) {
				return false;
			}
			this._editor.getModel()?.setValue('');
			this._sending = false;
			this._updateSendButtonState();
			return true;
		}

		if (generation !== this._sendGeneration || this._store.isDisposed) {
			return false;
		}

		const attachments = [...(this._agentHostInputCompletionHandler?.getAttachmentsForSend(query, queryOffset) ?? this._contextAttachments.attachments)];
		const implicitEntries = this._implicitContexts.enabledBaseEntries(this.configurationService.getValue<boolean>('chat.implicitContext.suggestedContext'));
		for (const entry of implicitEntries) {
			if (!attachments.some(existing => existing.id === entry.id)) {
				attachments.push(entry);
			}
		}
		const attachedContext = attachments.length > 0
			? attachments
			: undefined;
		const request = query;
		const notificationContext = this._getNotificationContext();

		if (this._draftState) {
			this._history.append(this._toHistoryEntry(this._draftState));
		}
		this._clearDraftState();

		this._sending = true;
		this._editor.updateOptions({ readOnly: true });
		this._updateSendButtonState();
		this._updateInputLoadingState();

		let sent = false;
		try {
			sent = await this.options.sendRequest({ query: request, attachments: attachedContext, background });
			if (generation !== this._sendGeneration || this._store.isDisposed) {
				return false;
			}
			if (!sent) {
				return false;
			}
			this.chatInputNotificationService.handleMessageSent(notificationContext);
			this._contextAttachments.clear();
			this._editor.getModel()?.setValue('');
		} catch (e) {
			this.logService.error('Failed to send request:', e);
			return false;
		} finally {
			if (!this._store.isDisposed && generation === this._sendGeneration) {
				this._sending = false;
				this._editor.updateOptions({ readOnly: false });
				this._updateDraftState();
				this._updateSendButtonState();
				this._updateInputLoadingState();
			}
		}
		return sent;
	}

	private _getNotificationContext(): IChatInputNotificationContext {
		const session = this.options.session.get();
		const activeChat = session?.activeChat.get();
		const modelSelection = this._modelSelection.state.get();
		return {
			sessionType: this.sessionTypePicker.modelTargetChatSessionType.get(),
			sessionResource: activeChat?.resource,
			deferredNotificationsEnabled: this.options.deferredNotificationsEnabled?.get() ?? true,
			isTransientChat: session?.isQuickChat?.get() ?? false,
			sessionStarted: activeChat ? activeChat.status.get() !== SessionStatus.Untitled : false,
			modelState: modelSelection,
		};
	}

	private _updateSendButtonState(): void {
		if (!this._sendButton) {
			return;
		}
		const hasAdditionalSendContent = this.options.hasAdditionalSendContent?.get() ?? false;
		this._sendButton.enabled = !this._sending
			&& hasSendableNewChatContent(this._editor?.getModel()?.getValue() ?? '', this._contextAttachments.attachments, hasAdditionalSendContent)
			&& this._canSendRequest.get();
	}

	private _restoreState(): void {
		const draft = this._getDraftState();
		if (draft) {
			this._editor?.getModel()?.setValue(draft.inputText);
			if (draft.attachments?.length) {
				this._contextAttachments.setAttachments(draft.attachments.map(IChatRequestVariableEntry.fromExport));
			}
		}
	}

	private _getDraftState(): IDraftState | undefined {
		const raw = this.storageService.get(STORAGE_KEY_DRAFT_STATE, StorageScope.WORKSPACE);
		if (!raw) {
			return undefined;
		}
		try {
			return parse(raw) as IDraftState;
		} catch {
			return undefined;
		}
	}

	private _clearDraftState(): void {
		this._draftState = { inputText: '', attachments: [] };
		this.storageService.store(STORAGE_KEY_DRAFT_STATE, stringify(this._draftState), StorageScope.WORKSPACE, StorageTarget.MACHINE);
	}

	saveState(): void {
		if (this._draftState) {
			const state = {
				...this._draftState,
				attachments: this._draftState.attachments.map(IChatRequestVariableEntry.toExport),
			};
			this.storageService.store(STORAGE_KEY_DRAFT_STATE, stringify(state), StorageScope.WORKSPACE, StorageTarget.MACHINE);
		}
	}

	layout(_height: number, _width: number): void {
		this._editor?.layout();
		this._primaryPickerResponsiveLayout?.layout();
		this._secondaryPickerResponsiveLayout?.layout();
	}

	focus(): void {
		this._editor?.focus();
	}

	async animatePrompt(text: string, durationMs: number, placeholder: string, token: CancellationToken, expectedValue = ''): Promise<boolean> {
		const editor = this._editor;
		const model = editor?.getModel();
		if (!editor || !model || !text || model.getValue() !== expectedValue || token.isCancellationRequested) {
			return false;
		}

		this._promptTypingAnimation.clear();
		if (expectedValue) {
			model.setValue('');
		}
		this._promptTemplatePlaceholder.value?.setPlaceholder(placeholder);
		const targetWindow = dom.getWindow(this._editorContainer);
		const effectiveDuration = this.accessibilityService.isMotionReduced() || this.accessibilityService.isScreenReaderOptimized() ? 0 : durationMs;
		const animation = animatePromptTyping({
			getValue: () => model.getValue(),
			setValue: value => {
				model.setValue(value);
				const lastLine = model.getLineCount();
				editor.setPosition({ lineNumber: lastLine, column: model.getLineMaxColumn(lastLine) });
			},
			onDidChange: listener => model.onDidChangeContent(() => listener()),
		}, text, effectiveDuration, {
			now: () => targetWindow.performance.now(),
			schedule: callback => dom.scheduleAtNextAnimationFrame(targetWindow, callback),
		});
		this._promptTypingAnimation.value = animation;
		const cancellationListener = token.onCancellationRequested(() => {
			if (this._promptTypingAnimation.value === animation) {
				this._promptTypingAnimation.clear();
			} else {
				animation.dispose();
			}
		});
		try {
			return (await animation.result).didWrite;
		} finally {
			cancellationListener.dispose();
			if (this._promptTypingAnimation.value === animation) {
				this._promptTypingAnimation.clear();
			}
		}
	}

	private _replacePrompt(text: string, placeholder: string, expectedValue: string): boolean {
		const model = this._editor.getModel();
		if (!model || model.getValue() !== expectedValue) {
			return false;
		}
		this._promptTypingAnimation.clear();
		this._promptTemplatePlaceholder.value?.setPlaceholder(placeholder);
		this._editor.pushUndoStop();
		const edited = this._editor.executeEdits('sessions.promptOption', [{ range: model.getFullModelRange(), text }]);
		if (!edited) {
			return false;
		}
		this._editor.pushUndoStop();
		const lastLine = model.getLineCount();
		this._editor.setPosition({ lineNumber: lastLine, column: model.getLineMaxColumn(lastLine) });
		return true;
	}

	showPromptOptions(state: NewSessionPromptOptionsState | undefined): boolean {
		if (state && this._promptOptionsDismissed) {
			return false;
		}
		this._promptOptionsState = state;
		const widget = this._promptOptionsWidget.value;
		if (!widget) {
			return false;
		}
		widget.setState(state);
		widget.setInputValue(this._editor.getValue());
		return true;
	}

	setPromptOptionsController(controller: INewSessionPromptOptionsController): void {
		this._cancelPromptOptionsRefresh(false);
		this._promptOptionsController = controller;
		this._promptOptionsDismissed = false;
	}

	preparePromptOptionsRefresh(): boolean {
		if (!this._promptOptionsController || this._promptOptionsDismissed) {
			return false;
		}
		this._cancelPromptOptionsRefresh();
		this.showPromptOptions({ kind: 'loading' });
		return true;
	}

	clearPromptOptions(): void {
		this._cancelPromptOptionsRefresh();
		this.showPromptOptions(undefined);
	}

	private _dismissPromptOptions(): void {
		if (this._promptOptionsDismissed) {
			return;
		}
		const controller = this._promptOptionsController;
		this._promptOptionsDismissed = true;
		this._cancelPromptOptionsRefresh(false);
		this.showPromptOptions(undefined);
		this.focus();
		aria.status(localize('newSessionPromptOptions.closed', "Prompt options closed"));
		controller?.onDidClose();
	}

	private _cancelPromptOptionsRefresh(clearGeneratedInput = true): void {
		const shouldClearInput = this._promptOptionsWidget.value?.shouldClearInputForRefresh() ?? false;
		this._promptTypingAnimation.clear();
		this._promptOptionsRefresh.value?.cancel();
		this._promptOptionsRefresh.clear();
		if (clearGeneratedInput && shouldClearInput) {
			this._promptTemplatePlaceholder.value?.setPlaceholder(undefined);
			this._editor.getModel()?.setValue('');
		}
	}

	async refreshPromptOptions(token: CancellationToken = CancellationToken.None): Promise<boolean> {
		const controller = this._promptOptionsController;
		if (!controller || !this.preparePromptOptionsRefresh()) {
			return false;
		}
		const cts = new CancellationTokenSource(token);
		this._promptOptionsRefresh.value = cts;
		let state: NewSessionPromptOptionsState;
		try {
			state = await controller.resolve(cts.token);
		} catch (error) {
			if (this._promptOptionsRefresh.value === cts) {
				this._promptOptionsRefresh.clear();
				if (cts.token.isCancellationRequested || isCancellationError(error)) {
					this.showPromptOptions(undefined);
					return false;
				}
			}
			throw error;
		}
		if (this._promptOptionsRefresh.value !== cts) {
			return false;
		}
		if (cts.token.isCancellationRequested) {
			this._promptOptionsRefresh.clear();
			this.showPromptOptions(undefined);
			return false;
		}
		this._promptOptionsRefresh.clear();
		return this.showPromptOptions(state);
	}

	override dispose(): void {
		++this._sendGeneration;
		this._cancelPromptOptionsRefresh();
		super.dispose();
	}

	/** See {@link INewChatVoiceComposer.routesWhileSessionActive}. */
	get routesWhileSessionActive(): boolean {
		return this.options.voiceRoutesWhileSessionActive === true;
	}

	prefillInput(text: string): void {
		const editor = this._editor;
		const model = editor?.getModel();
		if (editor && model) {
			model.setValue(text);
			const lastLine = model.getLineCount();
			const maxColumn = model.getLineMaxColumn(lastLine);
			editor.setPosition({ lineNumber: lastLine, column: maxColumn });
			editor.focus();
		}
	}

	sendQuery(text: string): void {
		// A submit is already in flight (e.g. a rapid second transcript before the
		// session is created); don't clobber the in-flight text or double-submit.
		if (this._sending) {
			return;
		}
		const model = this._editor?.getModel();
		if (model) {
			const combined = combineVoiceInput(model.getValue(), text);
			model.setValue(combined);
			this._send();
		}
	}

	attach(uris: URI[]): void {
		this._contextAttachments.addAttachments(...uris.map(uri => toFileVariableEntry(uri)));
	}

	attachTextContext(name: string, content: string, icon: ThemeIcon, id = `context:${content}`): void {
		this._contextAttachments.addAttachments(toPasteVariableEntry(name, content, {
			id,
			icon,
		}));
	}

	addAttachments(...attachments: IChatRequestVariableEntry[]): void {
		this._contextAttachments.addAttachments(...attachments);
	}

	removeAttachment(id: string): void {
		this._contextAttachments.removeAttachment(id);
	}

	get onDidChangeAttachments(): Event<void> {
		return this._contextAttachments.onDidChangeContext;
	}

	get attachments(): readonly IChatRequestVariableEntry[] {
		return this._contextAttachments.attachments;
	}

	getVoiceModels() {
		return this._modelSelection.state.get().models;
	}

	selectVoiceModel(identifier: string): boolean {
		return this._modelSelection.selectModel(identifier);
	}
}

// #endregion
