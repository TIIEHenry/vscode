/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as css from '../../../../base/browser/cssValue.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { isAbsolute } from '../../../../base/common/path.js';
import { isEqual } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { ConfigurationTarget, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKey, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ColorScheme, isDark, isHighContrast } from '../../../../platform/theme/common/theme.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { SessionsChatBackgroundAvailableContext, SessionsChatBackgroundConfiguredContext, SessionsChatBackgroundImageConfiguredContext } from '../../../common/contextkeys.js';

export const AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING = 'chat.agentSessions.preferredDarkBackgroundImage';
export const AGENT_SESSIONS_PREFERRED_LIGHT_CHAT_BACKGROUND_IMAGE_SETTING = 'chat.agentSessions.preferredLightBackgroundImage';
export const AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING = 'chat.agentSessions.backgroundImageLayout';
export const AGENT_SESSIONS_CHAT_BACKGROUND_CODICONS_PRESET = 'codicons';
export type SessionsChatBackgroundPreset = typeof AGENT_SESSIONS_CHAT_BACKGROUND_CODICONS_PRESET;
const RECENT_BACKGROUND_IMAGES_STORAGE_KEY = 'chat.agentSessions.recentBackgroundImages';
const BACKGROUND_CHOICE_STORAGE_KEY = 'chat.agentSessions.backgroundChoice';
const MAX_RECENT_BACKGROUND_IMAGES = 5;

interface IStoredBackgroundChoices {
	dark?: string | null;
	light?: string | null;
}

export interface ISessionsChatImageBackground {
	readonly kind: 'image';
	readonly backgroundImage: string;
	readonly backgroundRepeat: string;
	readonly backgroundSize: string;
	readonly backgroundPosition: string;
}

export interface ISessionsChatCodiconsBackground {
	readonly kind: 'codicons';
}

export type ISessionsChatBackground = ISessionsChatImageBackground | ISessionsChatCodiconsBackground;

const backgroundImageStyles = {
	repeat: { backgroundRepeat: 'repeat', backgroundSize: 'auto', backgroundPosition: 'left top' },
	stretch: { backgroundRepeat: 'no-repeat', backgroundSize: '100% 100%', backgroundPosition: 'center center' },
	center: { backgroundRepeat: 'no-repeat', backgroundSize: 'auto', backgroundPosition: 'center center' },
	top: { backgroundRepeat: 'no-repeat', backgroundSize: 'auto', backgroundPosition: 'center top' },
	'top-right': { backgroundRepeat: 'no-repeat', backgroundSize: 'auto', backgroundPosition: 'right top' },
	'top-left': { backgroundRepeat: 'no-repeat', backgroundSize: 'auto', backgroundPosition: 'left top' },
	bottom: { backgroundRepeat: 'no-repeat', backgroundSize: 'auto', backgroundPosition: 'center bottom' },
	'bottom-right': { backgroundRepeat: 'no-repeat', backgroundSize: 'auto', backgroundPosition: 'right bottom' },
	'bottom-left': { backgroundRepeat: 'no-repeat', backgroundSize: 'auto', backgroundPosition: 'left bottom' },
	left: { backgroundRepeat: 'no-repeat', backgroundSize: 'auto', backgroundPosition: 'left center' },
	right: { backgroundRepeat: 'no-repeat', backgroundSize: 'auto', backgroundPosition: 'right center' },
} as const satisfies Record<string, Omit<ISessionsChatImageBackground, 'kind' | 'backgroundImage'>>;

export type ChatBackgroundImageLayout = keyof typeof backgroundImageStyles;

export const chatBackgroundImageLayoutValues = Object.keys(backgroundImageStyles) as ChatBackgroundImageLayout[];

export const ISessionsChatBackgroundService = createDecorator<ISessionsChatBackgroundService>('sessionsChatBackgroundService');

export interface ISessionsChatBackgroundService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeBackground: Event<void>;
	getBackground(): ISessionsChatBackground | undefined;
	getConfiguredBackgroundImage(): URI | undefined;
	getRecentBackgroundImages(): readonly URI[];
	getBackgroundImageLayout(): ChatBackgroundImageLayout;
	setBackground(background: URI | SessionsChatBackgroundPreset): Promise<void>;
	clearBackground(): Promise<void>;
	setBackgroundImageLayout(layout: ChatBackgroundImageLayout, persist?: boolean): Promise<void>;
}

export class SessionsChatBackgroundService extends Disposable implements ISessionsChatBackgroundService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeBackground = this._register(new Emitter<void>());
	readonly onDidChangeBackground = this._onDidChangeBackground.event;
	private backgroundImageLayout: ChatBackgroundImageLayout;
	private committedBackgroundImageLayout: ChatBackgroundImageLayout;
	private pendingPersistLayout: ChatBackgroundImageLayout | undefined;
	private layoutEpoch = 0;
	private imageWriteInFlight = 0;
	/** Latest image choice per theme, plus earlier images a late settings echo must not restore. */
	private readonly imageGuards = new Map<'dark' | 'light', { current: string; superseded: Set<string> }>();
	/** Latest layout choice, plus earlier layouts a late settings echo must not restore. */
	private layoutGuard: { current: ChatBackgroundImageLayout; superseded: Set<ChatBackgroundImageLayout> } | undefined;
	private readonly backgroundAvailableContext: IContextKey<boolean>;
	private readonly backgroundConfiguredContext: IContextKey<boolean>;
	private readonly backgroundImageConfiguredContext: IContextKey<boolean>;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IThemeService private readonly themeService: IThemeService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();

		this.committedBackgroundImageLayout = this.readConfiguredBackgroundImageLayout();
		this.backgroundImageLayout = this.committedBackgroundImageLayout;
		this.backgroundAvailableContext = SessionsChatBackgroundAvailableContext.bindTo(contextKeyService);
		this.backgroundConfiguredContext = SessionsChatBackgroundConfiguredContext.bindTo(contextKeyService);
		this.backgroundImageConfiguredContext = SessionsChatBackgroundImageConfiguredContext.bindTo(contextKeyService);
		this.updateContextKeys();
		// Keep the local picture independent of remote MACHINE settings before the
		// first configuration echo can hide it.
		this.seedStoredChoices();
		this._register(this.configurationService.onDidChangeConfiguration(event => {
			const backgroundImageChanged = event.affectsConfiguration(AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING)
				|| event.affectsConfiguration(AGENT_SESSIONS_PREFERRED_LIGHT_CHAT_BACKGROUND_IMAGE_SETTING);
			const backgroundImageLayoutChanged = event.affectsConfiguration(AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING);
			let backgroundChanged = false;
			if (backgroundImageChanged && event.source !== ConfigurationTarget.USER_REMOTE && this.imageWriteInFlight === 0) {
				if (this.adoptSettingsBackground()) {
					this.updateContextKeys();
					backgroundChanged = true;
				}
			}
			if (backgroundImageLayoutChanged) {
				backgroundChanged = this.applyConfiguredBackgroundImageLayout() || backgroundChanged;
			}
			if (backgroundChanged) {
				this._onDidChangeBackground.fire();
			}
		}));
		this._register(this.themeService.onDidColorThemeChange(() => {
			this.updateContextKeys();
			this._onDidChangeBackground.fire();
		}));
	}

	getBackground(): ISessionsChatBackground | undefined {
		if (isHighContrast(this.themeService.getColorTheme().type)) {
			return undefined;
		}
		const configuredBackground = this.getConfiguredBackground();
		if (configuredBackground?.kind === 'codicons') {
			return configuredBackground;
		}
		return configuredBackground ? {
			kind: 'image',
			backgroundImage: css.asCSSUrl(configuredBackground.image),
			...backgroundImageStyles[this.getBackgroundImageLayout()],
		} : undefined;
	}

	getConfiguredBackgroundImage(): URI | undefined {
		const background = this.getConfiguredBackground();
		return background?.kind === 'image' ? background.image : undefined;
	}

	getRecentBackgroundImages(): readonly URI[] {
		const images = this.getStoredRecentBackgroundImages();
		const current = this.getConfiguredBackgroundImage();
		if (current && !images.some(image => isEqual(image, current))) {
			images.unshift(current);
		}
		return images.slice(0, MAX_RECENT_BACKGROUND_IMAGES);
	}

	async setBackground(background: URI | SessionsChatBackgroundPreset): Promise<void> {
		await this.writeActiveBackground(URI.isUri(background) ? background.fsPath : background);
		if (URI.isUri(background)) {
			this.storeRecentBackgroundImage(background);
		}
	}

	async clearBackground(): Promise<void> {
		await this.writeActiveBackground(undefined);
	}

	getBackgroundImageLayout(): ChatBackgroundImageLayout {
		return this.backgroundImageLayout;
	}

	async setBackgroundImageLayout(layout: ChatBackgroundImageLayout, persist = true): Promise<void> {
		const epoch = ++this.layoutEpoch;
		const previousGuard = this.cloneLayoutGuard();
		const replaced = this.backgroundImageLayout;
		const configuredBefore = this.readConfiguredBackgroundImageLayout();
		if (layout !== this.backgroundImageLayout) {
			this.backgroundImageLayout = layout;
			this._onDidChangeBackground.fire();
		}
		// The updated layout is on screen before the settings round-trip. A later
		// echo can still carry a layout this choice already replaced.
		this.noteLayoutChosen(replaced, layout, configuredBefore);
		if (!persist) {
			return;
		}
		this.pendingPersistLayout = layout;
		try {
			await this.configurationService.updateValue(AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING, layout, ConfigurationTarget.APPLICATION);
			if (epoch !== this.layoutEpoch) {
				this.forgetPendingPersist(layout);
				return;
			}
			this.committedBackgroundImageLayout = layout;
			this.pendingPersistLayout = undefined;
		} catch (error) {
			if (epoch !== this.layoutEpoch) {
				// A newer preview or commit owns the screen; don't put this failed save back.
				this.forgetPendingPersist(layout);
				throw error;
			}
			this.layoutGuard = previousGuard;
			this.pendingPersistLayout = undefined;
			const configuredLayout = this.readConfiguredBackgroundImageLayout();
			this.committedBackgroundImageLayout = configuredLayout;
			if (configuredLayout !== this.backgroundImageLayout) {
				this.backgroundImageLayout = configuredLayout;
				this._onDidChangeBackground.fire();
			}
			throw error;
		}
	}

	private readConfiguredBackgroundImageLayout(): ChatBackgroundImageLayout {
		const value = this.configurationService.getValue<string>(AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING);
		return chatBackgroundImageLayoutValues.includes(value as ChatBackgroundImageLayout)
			? value as ChatBackgroundImageLayout
			: 'repeat';
	}

	private getBackgroundImageSetting(colorScheme: ColorScheme): string {
		return isDark(colorScheme)
			? AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING
			: AGENT_SESSIONS_PREFERRED_LIGHT_CHAT_BACKGROUND_IMAGE_SETTING;
	}

	private updateContextKeys(): void {
		const background = this.getConfiguredBackground();
		this.backgroundAvailableContext.set(!isHighContrast(this.themeService.getColorTheme().type));
		this.backgroundConfiguredContext.set(!!background);
		this.backgroundImageConfiguredContext.set(background?.kind === 'image');
	}

	private getConfiguredBackground(): { readonly kind: 'codicons' } | { readonly kind: 'image'; readonly image: URI } | undefined {
		const scheme = this.themeService.getColorTheme().type;
		const stored = this.readStoredChoice(this.choiceBucket(scheme));
		if (stored !== undefined) {
			return stored === null ? undefined : this.backgroundFromRaw(stored);
		}
		return this.backgroundFromRaw(this.configurationService.getValue<string>(this.getBackgroundImageSetting(scheme)));
	}

	private async writeActiveBackground(value: string | undefined): Promise<void> {
		const scheme = this.themeService.getColorTheme().type;
		const bucket = this.choiceBucket(scheme);
		const setting = this.getBackgroundImageSetting(scheme);
		const previous = this.readStoredChoice(bucket);
		const configuredBefore = this.normalizeSettingsValue(this.configurationService.getValue<string>(setting));
		const written = value === undefined ? null : value;
		const previousGuard = this.cloneImageGuard(bucket);
		this.writeStoredChoice(bucket, written);
		// Remember this choice before updateValue resolves. A settings echo can
		// arrive afterwards still carrying an earlier image.
		this.rememberChosenImage(bucket, previous, written, configuredBefore);
		this.imageWriteInFlight++;
		this.updateContextKeys();
		this._onDidChangeBackground.fire();
		try {
			// USER follows the remote machine for MACHINE settings and would
			// park a local file path on the SSH host. USER_LOCAL stays on this window.
			await this.configurationService.updateValue(setting, value, ConfigurationTarget.USER_LOCAL);
		} catch (error) {
			this.writeStoredChoice(bucket, previous);
			this.restoreImageGuard(bucket, previousGuard);
			this.updateContextKeys();
			this._onDidChangeBackground.fire();
			throw error;
		} finally {
			this.imageWriteInFlight--;
		}
	}

	private adoptSettingsBackground(): boolean {
		const scheme = this.themeService.getColorTheme().type;
		const bucket = this.choiceBucket(scheme);
		const incoming = this.normalizeSettingsValue(this.configurationService.getValue<string>(this.getBackgroundImageSetting(scheme)));
		const incomingId = this.imageIdentity(incoming);
		const guard = this.imageGuards.get(bucket);
		if (guard && incomingId !== guard.current && guard.superseded.has(incomingId)) {
			return false;
		}
		const before = this.readStoredChoice(bucket);
		const beforeId = before === undefined ? undefined : this.imageIdentity(before);
		if (guard && incomingId !== guard.current) {
			guard.superseded.add(guard.current);
			guard.superseded.delete(incomingId);
			guard.current = incomingId;
		}
		if (beforeId === incomingId) {
			return false;
		}
		this.writeStoredChoice(bucket, incoming);
		return true;
	}

	private seedStoredChoices(): void {
		for (const scheme of [ColorScheme.DARK, ColorScheme.LIGHT]) {
			const bucket = this.choiceBucket(scheme);
			if (this.readStoredChoice(bucket) !== undefined) {
				continue;
			}
			const choice = this.normalizeSettingsValue(this.configurationService.getValue<string>(this.getBackgroundImageSetting(scheme)));
			if (choice) {
				this.writeStoredChoice(bucket, choice);
			}
		}
	}

	private applyConfiguredBackgroundImageLayout(): boolean {
		const layout = this.readConfiguredBackgroundImageLayout();
		if (this.isStaleLayoutEcho(layout)) {
			// This notification still carries a layout the user already replaced.
			return false;
		}
		if (layout === this.committedBackgroundImageLayout) {
			// Same saved value reported again. Keep the live preview on screen.
			return false;
		}
		if (this.pendingPersistLayout === layout && this.backgroundImageLayout !== layout) {
			// This save landed after a newer preview or a cancel. Remember it, but
			// don't put the older layout back on screen.
			this.committedBackgroundImageLayout = layout;
			this.pendingPersistLayout = undefined;
			return false;
		}
		this.committedBackgroundImageLayout = layout;
		if (this.pendingPersistLayout === layout) {
			this.pendingPersistLayout = undefined;
		}
		if (layout === this.backgroundImageLayout) {
			return false;
		}
		this.rememberLayoutFromSettings(layout);
		this.backgroundImageLayout = layout;
		return true;
	}

	private noteLayoutChosen(replaced: ChatBackgroundImageLayout, chosen: ChatBackgroundImageLayout, configuredBefore: ChatBackgroundImageLayout): void {
		const superseded = new Set(this.layoutGuard?.superseded ?? []);
		if (replaced !== chosen) {
			superseded.add(replaced);
		}
		if (configuredBefore !== chosen) {
			superseded.add(configuredBefore);
		}
		superseded.delete(chosen);
		this.layoutGuard = { current: chosen, superseded };
	}

	private isStaleLayoutEcho(layout: ChatBackgroundImageLayout): boolean {
		return !!this.layoutGuard && layout !== this.layoutGuard.current && this.layoutGuard.superseded.has(layout);
	}

	private rememberLayoutFromSettings(layout: ChatBackgroundImageLayout): void {
		if (!this.layoutGuard || layout === this.layoutGuard.current) {
			return;
		}
		this.layoutGuard.superseded.add(this.layoutGuard.current);
		this.layoutGuard.superseded.delete(layout);
		this.layoutGuard.current = layout;
	}

	private cloneLayoutGuard(): { current: ChatBackgroundImageLayout; superseded: Set<ChatBackgroundImageLayout> } | undefined {
		if (!this.layoutGuard) {
			return undefined;
		}
		return { current: this.layoutGuard.current, superseded: new Set(this.layoutGuard.superseded) };
	}

	private rememberChosenImage(bucket: 'dark' | 'light', previous: string | null | undefined, written: string | null, configuredBefore: string | null): void {
		const current = this.imageIdentity(written);
		const superseded = new Set(this.imageGuards.get(bucket)?.superseded ?? []);
		const mark = (value: string | null | undefined) => {
			if (value === undefined) {
				return;
			}
			const identity = this.imageIdentity(value);
			if (identity !== current) {
				superseded.add(identity);
			}
		};
		mark(previous);
		mark(configuredBefore);
		superseded.delete(current);
		this.imageGuards.set(bucket, { current, superseded });
	}

	private cloneImageGuard(bucket: 'dark' | 'light'): { current: string; superseded: Set<string> } | undefined {
		const guard = this.imageGuards.get(bucket);
		if (!guard) {
			return undefined;
		}
		return { current: guard.current, superseded: new Set(guard.superseded) };
	}

	private restoreImageGuard(bucket: 'dark' | 'light', snapshot: { current: string; superseded: Set<string> } | undefined): void {
		if (!snapshot) {
			this.imageGuards.delete(bucket);
			return;
		}
		this.imageGuards.set(bucket, snapshot);
	}

	private imageIdentity(value: string | null): string {
		if (value === null) {
			return '';
		}
		const background = this.backgroundFromRaw(value);
		if (!background) {
			return '';
		}
		if (background.kind === 'codicons') {
			return AGENT_SESSIONS_CHAT_BACKGROUND_CODICONS_PRESET;
		}
		return background.image.toString();
	}

	private forgetPendingPersist(layout: ChatBackgroundImageLayout): void {
		if (this.pendingPersistLayout === layout) {
			this.pendingPersistLayout = undefined;
		}
	}

	private choiceBucket(scheme: ColorScheme): 'dark' | 'light' {
		return isDark(scheme) ? 'dark' : 'light';
	}

	private backgroundFromRaw(value: string | undefined): { readonly kind: 'codicons' } | { readonly kind: 'image'; readonly image: URI } | undefined {
		const trimmed = value?.trim();
		if (!trimmed) {
			return undefined;
		}
		if (trimmed === AGENT_SESSIONS_CHAT_BACKGROUND_CODICONS_PRESET) {
			return { kind: 'codicons' };
		}
		const image = this.resolveBackgroundImage(trimmed);
		return image ? { kind: 'image', image } : undefined;
	}

	private normalizeSettingsValue(value: string | undefined): string | null {
		const background = this.backgroundFromRaw(value);
		if (!background) {
			return null;
		}
		if (background.kind === 'codicons') {
			return AGENT_SESSIONS_CHAT_BACKGROUND_CODICONS_PRESET;
		}
		return value?.trim() ?? null;
	}

	private readChoiceFile(): IStoredBackgroundChoices {
		const stored = this.storageService.getObject<IStoredBackgroundChoices>(BACKGROUND_CHOICE_STORAGE_KEY, StorageScope.PROFILE);
		if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
			return {};
		}
		return stored;
	}

	private readStoredChoice(bucket: 'dark' | 'light'): string | null | undefined {
		const choices = this.readChoiceFile();
		if (!Object.prototype.hasOwnProperty.call(choices, bucket)) {
			return undefined;
		}
		const value = choices[bucket];
		return typeof value === 'string' || value === null ? value : undefined;
	}

	private writeStoredChoice(bucket: 'dark' | 'light', value: string | null | undefined): void {
		const choices = { ...this.readChoiceFile() };
		if (value === undefined) {
			delete choices[bucket];
		} else {
			choices[bucket] = value;
		}
		if (choices.dark === undefined && choices.light === undefined) {
			this.storageService.remove(BACKGROUND_CHOICE_STORAGE_KEY, StorageScope.PROFILE);
			return;
		}
		this.storageService.store(BACKGROUND_CHOICE_STORAGE_KEY, choices, StorageScope.PROFILE, StorageTarget.MACHINE);
	}

	private getStoredRecentBackgroundImages(): URI[] {
		const stored = this.storageService.getObject<string[]>(RECENT_BACKGROUND_IMAGES_STORAGE_KEY, StorageScope.PROFILE, []);
		if (!Array.isArray(stored)) {
			return [];
		}
		const images: URI[] = [];
		for (const value of stored) {
			if (typeof value !== 'string') {
				continue;
			}
			const image = this.resolveBackgroundImage(value);
			if (image && !images.some(existing => isEqual(existing, image))) {
				images.push(image);
			}
		}
		return images.slice(0, MAX_RECENT_BACKGROUND_IMAGES);
	}

	private storeRecentBackgroundImage(image: URI): void {
		const images = [
			image,
			...this.getStoredRecentBackgroundImages().filter(existing => !isEqual(existing, image)),
		].slice(0, MAX_RECENT_BACKGROUND_IMAGES);
		this.storageService.store(
			RECENT_BACKGROUND_IMAGES_STORAGE_KEY,
			JSON.stringify(images.map(recent => recent.toString())),
			StorageScope.PROFILE,
			StorageTarget.MACHINE
		);
	}

	private resolveBackgroundImage(value: string | undefined): URI | undefined {
		const candidate = value?.trim();
		if (!candidate) {
			return undefined;
		}

		if (isAbsolute(candidate)) {
			return URI.file(candidate);
		}

		const uri = URI.parse(candidate);
		return uri.scheme === Schemas.file ? uri : undefined;
	}
}
