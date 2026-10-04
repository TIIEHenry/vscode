/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConfigurationTarget, IConfigurationChangeEvent, IConfigurationOverrides, IConfigurationUpdateOptions, IConfigurationUpdateOverrides } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { InMemoryStorageService } from '../../../../../platform/storage/common/storage.js';
import { ColorScheme } from '../../../../../platform/theme/common/theme.js';
import { TestColorTheme, TestThemeService } from '../../../../../platform/theme/test/common/testThemeService.js';
import { SessionsChatBackgroundAvailableContext, SessionsChatBackgroundConfiguredContext, SessionsChatBackgroundImageConfiguredContext } from '../../../../common/contextkeys.js';
import { AGENT_SESSIONS_CHAT_BACKGROUND_CODICONS_PRESET, AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING, AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING, AGENT_SESSIONS_PREFERRED_LIGHT_CHAT_BACKGROUND_IMAGE_SETTING, chatBackgroundImageLayoutValues, ChatBackgroundImageLayout, ISessionsChatImageBackground, SessionsChatBackgroundService } from '../../browser/chatBackgroundService.js';

class CapturingConfigurationService extends TestConfigurationService {
	readonly updates: { key: string; value: unknown; target: ConfigurationTarget | undefined }[] = [];
	updateError: Error | undefined;
	deferUpdates = false;
	private readonly deferred: { resolve: () => void; reject: (error: Error) => void }[] = [];

	override updateValue(key: string, value: unknown): Promise<void>;
	override updateValue(key: string, value: unknown, target: ConfigurationTarget): Promise<void>;
	override updateValue(key: string, value: unknown, overrides: IConfigurationOverrides | IConfigurationUpdateOverrides): Promise<void>;
	override updateValue(key: string, value: unknown, overrides: IConfigurationOverrides | IConfigurationUpdateOverrides, target: ConfigurationTarget, options?: IConfigurationUpdateOptions): Promise<void>;
	override updateValue(key: string, value: unknown, arg3?: ConfigurationTarget | IConfigurationOverrides | IConfigurationUpdateOverrides, target?: ConfigurationTarget): Promise<void> {
		this.updates.push({ key, value, target: typeof arg3 === 'number' ? arg3 : target });
		if (this.deferUpdates) {
			return new Promise((resolve, reject) => {
				this.deferred.push({ resolve, reject });
			});
		}
		return this.updateError ? Promise.reject(this.updateError) : Promise.resolve();
	}

	settleDeferred(error?: Error): void {
		const pending = this.deferred.splice(0);
		for (const update of pending) {
			if (error) {
				update.reject(error);
			} else {
				update.resolve();
			}
		}
	}
}

function fireConfigurationChange(configurationService: TestConfigurationService, setting: string, source?: ConfigurationTarget): void {
	configurationService.onDidChangeConfigurationEmitter.fire(upcastPartial<IConfigurationChangeEvent>({
		affectsConfiguration: key => key === setting,
		source,
	}));
}

suite('Sessions Chat Background Service', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not return a background without a configured image', () => {
		const contextKeyService = disposables.add(new MockContextKeyService());
		const service = disposables.add(new SessionsChatBackgroundService(new TestConfigurationService(), new TestThemeService(), contextKeyService, disposables.add(new InMemoryStorageService())));

		assert.deepStrictEqual({
			background: service.getBackground(),
			image: service.getConfiguredBackgroundImage(),
			backgroundConfigured: contextKeyService.getContextKeyValue(SessionsChatBackgroundConfiguredContext.key),
			imageConfigured: contextKeyService.getContextKeyValue(SessionsChatBackgroundImageConfiguredContext.key),
		}, {
			background: undefined,
			image: undefined,
			backgroundConfigured: false,
			imageConfigured: false,
		});
	});

	test('resolves the background for the active color theme and emits changes', async () => {
		const configurationService = new TestConfigurationService({
			[AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING]: URI.file('/textures/dark.png').fsPath,
			[AGENT_SESSIONS_PREFERRED_LIGHT_CHAT_BACKGROUND_IMAGE_SETTING]: URI.file('/textures/light.png').fsPath,
			[AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING]: 'center',
		});
		const themeService = new TestThemeService();
		const contextKeyService = disposables.add(new MockContextKeyService());
		const service = disposables.add(new SessionsChatBackgroundService(configurationService, themeService, contextKeyService, disposables.add(new InMemoryStorageService())));
		let changes = 0;
		disposables.add(service.onDidChangeBackground(() => changes++));

		const darkBackground = service.getBackground();
		const dark = {
			kind: darkBackground?.kind,
			image: service.getConfiguredBackgroundImage()?.path.endsWith('dark.png'),
			cssImage: darkBackground?.kind === 'image' && !!darkBackground.backgroundImage,
			repeat: darkBackground?.kind === 'image' ? darkBackground.backgroundRepeat : undefined,
			size: darkBackground?.kind === 'image' ? darkBackground.backgroundSize : undefined,
			position: darkBackground?.kind === 'image' ? darkBackground.backgroundPosition : undefined,
			available: contextKeyService.getContextKeyValue(SessionsChatBackgroundAvailableContext.key),
			backgroundConfigured: contextKeyService.getContextKeyValue(SessionsChatBackgroundConfiguredContext.key),
			imageConfigured: contextKeyService.getContextKeyValue(SessionsChatBackgroundImageConfiguredContext.key),
		};
		themeService.setTheme(new TestColorTheme({}, ColorScheme.LIGHT));
		const lightBackground = service.getBackground();
		const light = {
			kind: lightBackground?.kind,
			image: service.getConfiguredBackgroundImage()?.path.endsWith('light.png'),
			cssImage: lightBackground?.kind === 'image' && !!lightBackground.backgroundImage,
			repeat: lightBackground?.kind === 'image' ? lightBackground.backgroundRepeat : undefined,
			size: lightBackground?.kind === 'image' ? lightBackground.backgroundSize : undefined,
			position: lightBackground?.kind === 'image' ? lightBackground.backgroundPosition : undefined,
			available: contextKeyService.getContextKeyValue(SessionsChatBackgroundAvailableContext.key),
			backgroundConfigured: contextKeyService.getContextKeyValue(SessionsChatBackgroundConfiguredContext.key),
			imageConfigured: contextKeyService.getContextKeyValue(SessionsChatBackgroundImageConfiguredContext.key),
		};
		themeService.setTheme(new TestColorTheme({}, ColorScheme.HIGH_CONTRAST_DARK));
		const highContrast = {
			background: service.getBackground(),
			available: contextKeyService.getContextKeyValue(SessionsChatBackgroundAvailableContext.key),
			backgroundConfigured: contextKeyService.getContextKeyValue(SessionsChatBackgroundConfiguredContext.key),
			imageConfigured: contextKeyService.getContextKeyValue(SessionsChatBackgroundImageConfiguredContext.key),
		};
		themeService.setTheme(new TestColorTheme({}, ColorScheme.DARK));
		const restoredAvailability = contextKeyService.getContextKeyValue(SessionsChatBackgroundAvailableContext.key);
		await configurationService.setUserConfiguration(AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING, 'https://example.com/texture.png');
		fireConfigurationChange(configurationService, AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING);

		assert.deepStrictEqual({
			dark,
			light,
			highContrast,
			unsupportedUri: service.getBackground(),
			unsupportedBackgroundConfigured: contextKeyService.getContextKeyValue(SessionsChatBackgroundConfiguredContext.key),
			unsupportedImageConfigured: contextKeyService.getContextKeyValue(SessionsChatBackgroundImageConfiguredContext.key),
			restoredAvailability,
			changes,
		}, {
			dark: { kind: 'image', image: true, cssImage: true, repeat: 'no-repeat', size: 'auto', position: 'center center', available: true, backgroundConfigured: true, imageConfigured: true },
			light: { kind: 'image', image: true, cssImage: true, repeat: 'no-repeat', size: 'auto', position: 'center center', available: true, backgroundConfigured: true, imageConfigured: true },
			highContrast: { background: undefined, available: false, backgroundConfigured: true, imageConfigured: true },
			unsupportedUri: undefined,
			unsupportedBackgroundConfigured: false,
			unsupportedImageConfigured: false,
			restoredAvailability: true,
			changes: 4,
		});
	});

	test('returns the codicons preset without resolving an image', () => {
		const configurationService = new TestConfigurationService({
			[AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING]: AGENT_SESSIONS_CHAT_BACKGROUND_CODICONS_PRESET,
		});
		const contextKeyService = disposables.add(new MockContextKeyService());
		const service = disposables.add(new SessionsChatBackgroundService(configurationService, new TestThemeService(), contextKeyService, disposables.add(new InMemoryStorageService())));

		assert.deepStrictEqual({
			background: service.getBackground(),
			image: service.getConfiguredBackgroundImage(),
			backgroundConfigured: contextKeyService.getContextKeyValue(SessionsChatBackgroundConfiguredContext.key),
			imageConfigured: contextKeyService.getContextKeyValue(SessionsChatBackgroundImageConfiguredContext.key),
		}, {
			background: { kind: 'codicons' },
			image: undefined,
			backgroundConfigured: true,
			imageConfigured: false,
		});
	});

	test('returns every configured image layout', async () => {
		const configurationService = new TestConfigurationService({
			[AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING]: URI.file('/textures/kirby.png').fsPath,
			[AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING]: 'repeat',
		});
		const service = disposables.add(new SessionsChatBackgroundService(configurationService, new TestThemeService(), disposables.add(new MockContextKeyService()), disposables.add(new InMemoryStorageService())));
		const actual: Partial<Record<ChatBackgroundImageLayout, Omit<ISessionsChatImageBackground, 'kind' | 'backgroundImage'> | undefined>> = {};

		for (const layout of chatBackgroundImageLayoutValues) {
			await configurationService.setUserConfiguration(AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING, layout);
			fireConfigurationChange(configurationService, AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING);
			const background = service.getBackground();
			if (background?.kind === 'image') {
				actual[layout] = {
					backgroundRepeat: background.backgroundRepeat,
					backgroundSize: background.backgroundSize,
					backgroundPosition: background.backgroundPosition,
				};
			}
		}

		assert.deepStrictEqual(actual, {
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
		});
	});

	test('updates the image layout without persisting until the final value is committed', async () => {
		const configurationService = new TestConfigurationService({
			[AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING]: URI.file('/textures/kirby.png').fsPath,
			[AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING]: 'center',
		});
		const service = disposables.add(new SessionsChatBackgroundService(configurationService, new TestThemeService(), disposables.add(new MockContextKeyService()), disposables.add(new InMemoryStorageService())));
		let changes = 0;
		disposables.add(service.onDidChangeBackground(() => changes++));
		const getPosition = () => {
			const background = service.getBackground();
			return background?.kind === 'image' ? background.backgroundPosition : undefined;
		};

		const configuredPosition = getPosition();
		await service.setBackgroundImageLayout('bottom-right', false);
		const previewPosition = getPosition();
		const persistedDuringPreview = configurationService.getValue(AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING);
		await service.setBackgroundImageLayout('center', true);

		assert.deepStrictEqual({
			configuredPosition,
			previewPosition,
			persistedDuringPreview,
			restoredPosition: getPosition(),
			persistedLayout: configurationService.getValue(AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING),
			changes,
		}, {
			configuredPosition: 'center center',
			previewPosition: 'right bottom',
			persistedDuringPreview: 'center',
			restoredPosition: 'center center',
			persistedLayout: 'center',
			changes: 2,
		});
	});

	test('restores the configured image layout when persistence fails', async () => {
		const configurationService = new CapturingConfigurationService();
		const service = disposables.add(new SessionsChatBackgroundService(configurationService, new TestThemeService(), disposables.add(new MockContextKeyService()), disposables.add(new InMemoryStorageService())));
		let changes = 0;
		disposables.add(service.onDidChangeBackground(() => changes++));
		await service.setBackgroundImageLayout('bottom-right', false);
		configurationService.updateError = new Error('Unable to save layout');

		await assert.rejects(service.setBackgroundImageLayout('bottom-right', true), /Unable to save layout/);

		assert.deepStrictEqual({
			layout: service.getBackgroundImageLayout(),
			changes,
		}, {
			layout: 'repeat',
			changes: 2,
		});
	});

	test('keeps the five most recently selected background images', async () => {
		const initialImage = URI.file('/textures/initial.png');
		const configurationService = new TestConfigurationService({
			[AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING]: initialImage.toString(),
		});
		const storageService = disposables.add(new InMemoryStorageService());
		const service = disposables.add(new SessionsChatBackgroundService(configurationService, new TestThemeService(), disposables.add(new MockContextKeyService()), storageService));
		const selectedImages = Array.from({ length: 6 }, (_, index) => URI.file(`/textures/recent-${index + 1}.png`));
		const initialRecents = service.getRecentBackgroundImages();
		for (const image of selectedImages) {
			await service.setBackground(image);
		}
		await service.setBackground(selectedImages[2]);
		const restoredService = disposables.add(new SessionsChatBackgroundService(new TestConfigurationService(), new TestThemeService(), disposables.add(new MockContextKeyService()), storageService));

		assert.deepStrictEqual({
			initialRecents: initialRecents.map(image => image.path),
			persistedRecents: restoredService.getRecentBackgroundImages().map(image => image.path),
		}, {
			initialRecents: ['/textures/initial.png'],
			persistedRecents: [
				'/textures/recent-3.png',
				'/textures/recent-6.png',
				'/textures/recent-5.png',
				'/textures/recent-4.png',
				'/textures/recent-2.png',
			],
		});
	});

	test('updates the background for the active color theme and the shared layout', async () => {
		const image = URI.file('/textures/kirby.png');
		const configurationService = new CapturingConfigurationService();
		const themeService = new TestThemeService();
		const service = disposables.add(new SessionsChatBackgroundService(configurationService, themeService, disposables.add(new MockContextKeyService()), disposables.add(new InMemoryStorageService())));

		await service.setBackground(image);
		await service.setBackground(AGENT_SESSIONS_CHAT_BACKGROUND_CODICONS_PRESET);
		await service.clearBackground();
		themeService.setTheme(new TestColorTheme({}, ColorScheme.LIGHT));
		await service.setBackground(image);
		await service.setBackgroundImageLayout('bottom-right');

		assert.deepStrictEqual(configurationService.updates, [{
			key: AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING,
			value: image.fsPath,
			target: ConfigurationTarget.USER_LOCAL,
		}, {
			key: AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING,
			value: AGENT_SESSIONS_CHAT_BACKGROUND_CODICONS_PRESET,
			target: ConfigurationTarget.USER_LOCAL,
		}, {
			key: AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING,
			value: undefined,
			target: ConfigurationTarget.USER_LOCAL,
		}, {
			key: AGENT_SESSIONS_PREFERRED_LIGHT_CHAT_BACKGROUND_IMAGE_SETTING,
			value: image.fsPath,
			target: ConfigurationTarget.USER_LOCAL,
		}, {
			key: AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING,
			value: 'bottom-right',
			target: ConfigurationTarget.APPLICATION,
		}]);
	});

	test('keeps a layout preview when the saved layout is reported again', async () => {
		const configurationService = new TestConfigurationService({
			[AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING]: URI.file('/textures/kirby.png').fsPath,
			[AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING]: 'center',
		});
		const service = disposables.add(new SessionsChatBackgroundService(configurationService, new TestThemeService(), disposables.add(new MockContextKeyService()), disposables.add(new InMemoryStorageService())));
		let changes = 0;
		disposables.add(service.onDidChangeBackground(() => changes++));
		const position = () => {
			const background = service.getBackground();
			return background?.kind === 'image' ? background.backgroundPosition : undefined;
		};

		await service.setBackgroundImageLayout('bottom-right', false);
		fireConfigurationChange(configurationService, AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING);

		assert.deepStrictEqual({
			position: position(),
			changes,
		}, {
			position: 'right bottom',
			changes: 1,
		});
	});

	test('does not put an older layout save back over a newer preview', async () => {
		const configurationService = new CapturingConfigurationService({
			[AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING]: URI.file('/textures/kirby.png').fsPath,
			[AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING]: 'center',
		});
		configurationService.deferUpdates = true;
		const service = disposables.add(new SessionsChatBackgroundService(configurationService, new TestThemeService(), disposables.add(new MockContextKeyService()), disposables.add(new InMemoryStorageService())));
		const position = () => {
			const background = service.getBackground();
			return background?.kind === 'image' ? background.backgroundPosition : undefined;
		};

		const savingBottom = service.setBackgroundImageLayout('bottom', true);
		await service.setBackgroundImageLayout('left', false);
		await configurationService.setUserConfiguration(AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING, 'bottom');
		fireConfigurationChange(configurationService, AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING);
		configurationService.settleDeferred(new Error('Unable to save layout'));

		await assert.rejects(savingBottom, /Unable to save layout/);
		assert.deepStrictEqual({
			position: position(),
			layout: service.getBackgroundImageLayout(),
		}, {
			position: 'left center',
			layout: 'left',
		});
	});

	test('keeps the local picture when remote machine settings clear it and rolls back a failed change', async () => {
		const kept = URI.file('/textures/keep.png');
		const replacement = URI.file('/textures/replacement.png');
		const configurationService = new CapturingConfigurationService({
			[AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING]: kept.fsPath,
		});
		const service = disposables.add(new SessionsChatBackgroundService(configurationService, new TestThemeService(), disposables.add(new MockContextKeyService()), disposables.add(new InMemoryStorageService())));
		configurationService.updateError = new Error('Unable to save background');

		await assert.rejects(service.setBackground(replacement), /Unable to save background/);
		const afterFailure = service.getConfiguredBackgroundImage()?.path;
		configurationService.updateError = undefined;
		await configurationService.setUserConfiguration(AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING, undefined);
		fireConfigurationChange(configurationService, AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING, ConfigurationTarget.USER_REMOTE);
		const afterRemoteClear = service.getConfiguredBackgroundImage()?.path;
		await configurationService.setUserConfiguration(AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING, undefined);
		fireConfigurationChange(configurationService, AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING, ConfigurationTarget.USER);

		assert.deepStrictEqual({
			afterFailure,
			afterRemoteClear,
			afterSettingsClear: service.getConfiguredBackgroundImage()?.path,
			failedTarget: configurationService.updates[0]?.target,
		}, {
			afterFailure: '/textures/keep.png',
			afterRemoteClear: '/textures/keep.png',
			afterSettingsClear: undefined,
			failedTarget: ConfigurationTarget.USER_LOCAL,
		});
	});

	test('does not let a later settings echo of an earlier image replace the chosen image', async () => {
		const first = URI.file('/textures/first.png');
		const second = URI.file('/textures/second.png');
		const chosen = URI.file('/textures/chosen.png');
		const configurationService = new CapturingConfigurationService({
			[AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING]: first.fsPath,
		});
		const service = disposables.add(new SessionsChatBackgroundService(configurationService, new TestThemeService(), disposables.add(new MockContextKeyService()), disposables.add(new InMemoryStorageService())));
		const shown = () => {
			const background = service.getBackground();
			return {
				path: service.getConfiguredBackgroundImage()?.path,
				kind: background?.kind,
				showsChosen: background?.kind === 'image' && background.backgroundImage.includes('chosen') && !background.backgroundImage.includes('first') && !background.backgroundImage.includes('second'),
			};
		};

		await service.setBackground(second);
		configurationService.deferUpdates = true;
		const savingChosen = service.setBackground(chosen);
		await configurationService.setUserConfiguration(AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING, first.fsPath);
		fireConfigurationChange(configurationService, AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING);
		await configurationService.setUserConfiguration(AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING, second.fsPath);
		fireConfigurationChange(configurationService, AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING);
		const duringEcho = shown();
		configurationService.settleDeferred();
		await savingChosen;
		await configurationService.setUserConfiguration(AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING, first.fsPath);
		fireConfigurationChange(configurationService, AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING);
		await configurationService.setUserConfiguration(AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING, second.fsPath);
		fireConfigurationChange(configurationService, AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING);

		assert.deepStrictEqual({
			duringEcho,
			afterEcho: shown(),
		}, {
			duringEcho: { path: '/textures/chosen.png', kind: 'image', showsChosen: true },
			afterEcho: { path: '/textures/chosen.png', kind: 'image', showsChosen: true },
		});
	});

	test('does not let a later settings echo of an earlier layout replace the chosen layout', async () => {
		const configurationService = new CapturingConfigurationService({
			[AGENT_SESSIONS_PREFERRED_DARK_CHAT_BACKGROUND_IMAGE_SETTING]: URI.file('/textures/kirby.png').fsPath,
			[AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING]: 'center',
		});
		configurationService.deferUpdates = true;
		const service = disposables.add(new SessionsChatBackgroundService(configurationService, new TestThemeService(), disposables.add(new MockContextKeyService()), disposables.add(new InMemoryStorageService())));
		const position = () => {
			const background = service.getBackground();
			return background?.kind === 'image' ? background.backgroundPosition : undefined;
		};

		const savingBottom = service.setBackgroundImageLayout('bottom');
		const savingLeft = service.setBackgroundImageLayout('left');
		await configurationService.setUserConfiguration(AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING, 'center');
		fireConfigurationChange(configurationService, AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING);
		await configurationService.setUserConfiguration(AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING, 'bottom');
		fireConfigurationChange(configurationService, AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING);
		const duringEcho = {
			position: position(),
			layout: service.getBackgroundImageLayout(),
		};
		configurationService.settleDeferred();
		await savingBottom;
		await savingLeft;
		await configurationService.setUserConfiguration(AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING, 'center');
		fireConfigurationChange(configurationService, AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING);
		await configurationService.setUserConfiguration(AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING, 'bottom');
		fireConfigurationChange(configurationService, AGENT_SESSIONS_CHAT_BACKGROUND_IMAGE_LAYOUT_SETTING);

		assert.deepStrictEqual({
			duringEcho,
			afterEcho: {
				position: position(),
				layout: service.getBackgroundImageLayout(),
			},
		}, {
			duringEcho: { position: 'left center', layout: 'left' },
			afterEcho: { position: 'left center', layout: 'left' },
		});
	});
});
