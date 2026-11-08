/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise, timeout } from '../../../../../../base/common/async.js';
import { DisposableStore, IReference } from '../../../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../../../base/common/map.js';
import { ISettableObservable, observableValue } from '../../../../../../base/common/observable.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { Range } from '../../../../../../editor/common/core/range.js';
import type { IManagedHover } from '../../../../../../base/browser/ui/hover/hover.js';
import { IHoverService } from '../../../../../../platform/hover/browser/hover.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { FileOperationError, FileOperationResult, IFileService } from '../../../../../../platform/files/common/files.js';
import { INotificationService } from '../../../../../../platform/notification/common/notification.js';
import { ITelemetryService } from '../../../../../../platform/telemetry/common/telemetry.js';
import { IResolvedTextEditorModel } from '../../../../../../editor/common/services/resolverService.js';
import { URI } from '../../../../../../base/common/uri.js';
import { SaveReason } from '../../../../../common/editor.js';
import { ITextFileSaveOptions, ITextFileService } from '../../../../../services/textfile/common/textfiles.js';
import { TextFileEditorModel } from '../../../../../services/textfile/common/textFileEditorModel.js';
import { ITestTextFileEditorModelManager, TestServiceAccessor, workbenchInstantiationService } from '../../../../../test/browser/workbenchTestServices.js';
import { AICustomizationManagementEditor, isCurrentPluginContributionNavigation } from '../../../browser/aiCustomization/aiCustomizationManagementEditor.js';
import { ChatConfiguration } from '../../../common/constants.js';
import { MigratableConfiguration } from '../../../common/promptSyntax/service/customizationMigrationService.js';
import { PromptsStorage } from '../../../common/promptSyntax/service/promptsService.js';
import { IHeaderAttribute } from '../../../common/promptSyntax/promptFileParser.js';
import { PromptFileSource, PromptsType, Target } from '../../../common/promptSyntax/promptTypes.js';
import { AICustomizationManagementSection, AICustomizationSources, IAICustomizationWorkspaceService } from '../../../common/aiCustomizationWorkspaceService.js';
import { CustomizationMigrationCategoryId } from '../../../browser/aiCustomization/customizationMigrationCategories.js';
import type { ICustomizationSourceFolder } from '../../../common/customizationHarnessService.js';
import type { ICustomizationMigrationCategorySummary } from '../../../browser/aiCustomization/aiCustomizationWelcomePage.js';
import { AICustomizationManagementEditorInput } from '../../../browser/aiCustomization/aiCustomizationManagementEditorInput.js';

suite('aiCustomizationManagementEditor', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('includes the customization target in the modal title', () => {
		const input = store.add(new AICustomizationManagementEditorInput());
		const names = [input.getName()];
		input.setTargetLabel('Copilot');
		names.push(input.getName());
		input.setTargetLabel(undefined);
		names.push(input.getName());
		assert.deepStrictEqual(names, [
			'Agent Customizations',
			'Agent Customizations - Copilot',
			'Agent Customizations',
		]);
	});

	test('rejects stale plugin contribution navigation', () => {
		assert.deepStrictEqual([
			isCurrentPluginContributionNavigation(2, 2, AICustomizationManagementSection.Skills, AICustomizationManagementSection.Skills, true),
			isCurrentPluginContributionNavigation(1, 2, AICustomizationManagementSection.Skills, AICustomizationManagementSection.Skills, true),
			isCurrentPluginContributionNavigation(2, 2, AICustomizationManagementSection.Skills, AICustomizationManagementSection.Agents, true),
			isCurrentPluginContributionNavigation(2, 2, AICustomizationManagementSection.Skills, AICustomizationManagementSection.Skills, false),
		], [true, false, false, false]);
	});

	type TestableEditor = {
		workspaceService: IAICustomizationWorkspaceService;
		container: HTMLElement | undefined;
		embeddedEditor: unknown;
		embeddedMcpDetail: unknown;
		dispose(): void;
		currentEditingPromptType: PromptsType | undefined;
		currentEditingSource: string | undefined;
		currentEditingReadOnly: boolean;
		customizationsByMigrationCategory: Map<CustomizationMigrationCategoryId, readonly MigratableConfiguration[]>;
		customizationMigrationTargetFoldersByType: Map<PromptsType, readonly ICustomizationSourceFolder[]>;
		activeMigrationCategoryId: CustomizationMigrationCategoryId | undefined;
		editorDisplayMode: 'preview' | 'raw';
		editorPreviewFrontMatterContainer: HTMLElement | undefined;
		editorPreviewDisposables: DisposableStore;
		editorPreviewRenderScheduler: { cancel(): void; schedule(): void };
		viewMode: 'list' | 'migration' | 'editor' | 'mcpDetail' | 'pluginDetail' | 'toolsDetail';
		dimension: undefined;
		hoverService: IHoverService;
		configurationService: IConfigurationService;
		editorDisposables: DisposableStore;
		harnessService: { activeSessionResource: ISettableObservable<URI> };
		migrationListContainer: HTMLElement | undefined;
		migrationMigrateButton: { enabled: boolean; label: string } | undefined;
		migrationTitleElement: HTMLElement | undefined;
		migrationDescriptionElement: HTMLElement | undefined;
		migrationBannerContainer: HTMLElement | undefined;
		migrationLinkElement: HTMLAnchorElement | undefined;
		selectedCustomizationMigrationItems: ResourceMap<Set<PromptsStorage>>;
		migrationPageDisposables: DisposableStore;
		labelService: { getUriLabel(uri: URI, options?: { relative?: boolean }): string };
		showEmbeddedEditor(...args: unknown[]): Promise<void>;
		getActiveHarnessLabel(): string;
		welcomePage: { setMigrationCategories(categories: readonly unknown[]): void } | undefined;
		selectedSection: AICustomizationManagementSection | undefined;
		contributedSectionContainers: Map<AICustomizationManagementSection, HTMLElement>;
		getEditorModeButtonLabel(): string;
		getEditorModeButtonTooltip(): string;
		renderPreviewAttribute(attribute: IHeaderAttribute, promptType: PromptsType, target: Target): void;
		onStructuredPreviewSettingChanged(): void;
		refreshCustomizationMigrationUi(): void;
		refreshCustomizationMigrationInfo(): Promise<void>;
		registerCustomizationMigrationSessionRefresh(): void;
		renderCustomizationMigrationPage(): void;
		setCustomizationsToMigrate(candidates: Map<CustomizationMigrationCategoryId, readonly MigratableConfiguration[]>, targetFoldersByType: Map<PromptsType, readonly ICustomizationSourceFolder[]>): void;
		isCustomizationSelectedForMigration(customization: MigratableConfiguration): boolean;
		setCustomizationSelectedForMigration(customization: MigratableConfiguration, selected: boolean): void;
		updateContentVisibility(): void;
		setVisible(visible: boolean): void;
	};

	function createConfigurationServiceStub(values: Record<string, unknown> = {}): IConfigurationService {
		// Default to enabling the structured preview so existing assertions exercise the preview path.
		const merged: Record<string, unknown> = {
			[ChatConfiguration.ChatCustomizationsStructuredPreviewEnabled]: true,
			...values,
		};
		return {
			getValue: (key: string) => merged[key],
			setValue: (key: string, value: unknown) => { merged[key] = value; },
		} as unknown as IConfigurationService & { setValue(key: string, value: unknown): void };
	}

	function createTestEditor(hoverService?: IHoverService, configurationService?: IConfigurationService): TestableEditor {
		const editor = Object.create(AICustomizationManagementEditor.prototype) as unknown as TestableEditor;
		editor.editorPreviewDisposables = new DisposableStore();
		(editor as unknown as { _store: DisposableStore })._store = editor.editorPreviewDisposables.add(new DisposableStore());
		editor.workspaceService = {
			isSessionsWindow: true,
			managementSections: [],
			clearOverrideProjectRoot() { },
		} as unknown as IAICustomizationWorkspaceService;
		editor.container = undefined;
		editor.embeddedEditor = undefined;
		editor.embeddedMcpDetail = undefined;
		editor.currentEditingPromptType = undefined;
		editor.currentEditingSource = undefined;
		editor.currentEditingReadOnly = false;
		editor.customizationsByMigrationCategory = new Map();
		editor.customizationMigrationTargetFoldersByType = new Map();
		editor.activeMigrationCategoryId = undefined;
		editor.editorDisplayMode = 'preview';
		editor.editorPreviewFrontMatterContainer = document.createElement('div');
		editor.editorDisposables = editor.editorPreviewDisposables.add(new DisposableStore());
		editor.harnessService = {
			activeSessionResource: observableValue('activeSessionResource', URI.parse('agent-host-test:/session-a')),
		};
		editor.hoverService = hoverService ?? {
			setupManagedHover: () => ({
				dispose() { },
				show() { },
				hide() { },
				update() { },
			}),
		} as unknown as IHoverService;
		editor.configurationService = configurationService ?? createConfigurationServiceStub();
		editor.migrationListContainer = undefined;
		editor.migrationMigrateButton = undefined;
		editor.migrationTitleElement = undefined;
		editor.migrationDescriptionElement = undefined;
		editor.migrationBannerContainer = undefined;
		editor.migrationLinkElement = undefined;
		editor.selectedCustomizationMigrationItems = new ResourceMap();
		editor.migrationPageDisposables = editor.editorPreviewDisposables.add(new DisposableStore());
		editor.labelService = {
			getUriLabel: uri => uri.path,
		};
		editor.showEmbeddedEditor = async () => { };
		editor.getActiveHarnessLabel = () => 'Copilot';
		editor.welcomePage = undefined;
		editor.contributedSectionContainers = new Map();
		editor.editorPreviewRenderScheduler = {
			cancel(): void { },
			schedule(): void { },
		};
		editor.viewMode = 'list';
		editor.dimension = undefined;
		editor.selectedSection = undefined;
		editor.setVisible(false);
		return editor;
	}

	function createScalarAttribute(key: string, value: string): IHeaderAttribute {
		return {
			key,
			range: new Range(1, 1, 1, key.length + value.length + 1),
			value: {
				type: 'scalar',
				value,
				range: new Range(1, 1, 1, value.length + 1),
				format: 'double',
			},
		};
	}

	test('uses edit copy for built-in skills that support raw overrides', () => {
		const editor = createTestEditor();
		editor.currentEditingPromptType = PromptsType.skill;
		editor.currentEditingSource = AICustomizationSources.builtin;
		editor.currentEditingReadOnly = true;
		editor.editorDisplayMode = 'preview';

		assert.strictEqual(editor.getEditorModeButtonLabel(), 'Edit');
		assert.strictEqual(editor.getEditorModeButtonTooltip(), 'Edit the raw markdown file');

		editor.editorPreviewDisposables.dispose();
	});

	test('uses view-raw copy for true read-only extension content', () => {
		const editor = createTestEditor();
		editor.currentEditingPromptType = PromptsType.agent;
		editor.currentEditingSource = AICustomizationSources.extension;
		editor.currentEditingReadOnly = true;
		editor.editorDisplayMode = 'preview';

		assert.strictEqual(editor.getEditorModeButtonLabel(), 'View Raw');
		assert.strictEqual(editor.getEditorModeButtonTooltip(), 'Show the raw markdown file');

		editor.editorPreviewDisposables.dispose();
	});

	test('clicking a preview field help button opens the managed hover with focus', () => {
		let focused: boolean | undefined;
		const hoverService = {
			setupManagedHover: (): IManagedHover => ({
				dispose() { },
				show(focus?: boolean): void {
					focused = focus;
				},
				hide(): void { },
				update(): void { },
			}),
		} as unknown as IHoverService;
		const editor = createTestEditor(hoverService);
		const container = editor.editorPreviewFrontMatterContainer!;
		document.body.appendChild(container);

		try {
			editor.renderPreviewAttribute(createScalarAttribute('description', 'Helpful text'), PromptsType.agent, Target.VSCode);

			const helpButton = container.querySelector('button.editor-preview-row-help') as HTMLButtonElement | null;
			assert.ok(helpButton);

			helpButton.click();

			assert.strictEqual(focused, true);
		} finally {
			container.remove();
			editor.editorPreviewDisposables.dispose();
		}
	});

	test('hides preview button when structured preview setting is disabled', () => {
		const editor = createTestEditor(undefined, createConfigurationServiceStub({
			[ChatConfiguration.ChatCustomizationsStructuredPreviewEnabled]: false,
		}));
		editor.currentEditingPromptType = PromptsType.agent;
		editor.currentEditingSource = AICustomizationSources.builtin;
		editor.currentEditingReadOnly = false;
		editor.editorDisplayMode = 'preview';

		assert.strictEqual(editor.getEditorModeButtonLabel(), '');
		assert.strictEqual(editor.getEditorModeButtonTooltip(), '');

		editor.editorPreviewDisposables.dispose();
	});

	test('disabling the setting at runtime forces the editor back to raw mode', () => {
		const configurationService = createConfigurationServiceStub() as IConfigurationService & { setValue(key: string, value: unknown): void };
		const editor = createTestEditor(undefined, configurationService);
		editor.viewMode = 'editor';
		editor.currentEditingPromptType = PromptsType.agent;
		editor.editorDisplayMode = 'preview';

		// Sanity: setting is on and file is editable, so label is "Edit" (preview mode).
		assert.strictEqual(editor.getEditorModeButtonLabel(), 'Edit');

		// Flip the setting off and run the change handler.
		configurationService.setValue(ChatConfiguration.ChatCustomizationsStructuredPreviewEnabled, false);
		editor.onStructuredPreviewSettingChanged();

		assert.strictEqual(editor.editorDisplayMode, 'raw');
		assert.strictEqual(editor.getEditorModeButtonLabel(), '');

		editor.editorPreviewDisposables.dispose();
	});

	test('gates each migration category on its own experimental setting', () => {
		const welcomePageCalls: ICustomizationMigrationCategorySummary[][] = [];
		const configurationService = createConfigurationServiceStub({
			[ChatConfiguration.ChatCustomizationsPromptMigrationEnabled]: false,
			[ChatConfiguration.ChatCustomizationsUserDataMigrationEnabled]: false,
		}) as IConfigurationService & { setValue(key: string, value: unknown): void };
		const editor = createTestEditor(undefined, configurationService);
		editor.customizationsByMigrationCategory = new Map([
			[CustomizationMigrationCategoryId.PromptFiles, [{
				uri: URI.file('/workspace/.github/prompts/prompt.prompt.md'),
				storage: PromptsStorage.local,
				type: PromptsType.prompt,
				source: PromptFileSource.GitHubWorkspace,
			} as MigratableConfiguration]],
			[CustomizationMigrationCategoryId.UserData, [{
				uri: URI.file('/user-data/prompts/legacy.agent.md'),
				storage: PromptsStorage.user,
				type: PromptsType.agent,
				source: PromptFileSource.UserData,
			} as MigratableConfiguration]],
		]);
		editor.welcomePage = {
			setMigrationCategories: categories => welcomePageCalls.push([...categories as readonly ICustomizationMigrationCategorySummary[]]),
		};

		editor.refreshCustomizationMigrationUi();
		configurationService.setValue(ChatConfiguration.ChatCustomizationsUserDataMigrationEnabled, true);
		editor.refreshCustomizationMigrationUi();
		configurationService.setValue(ChatConfiguration.ChatCustomizationsPromptMigrationEnabled, true);
		editor.refreshCustomizationMigrationUi();

		assert.deepStrictEqual(welcomePageCalls.map(categories => categories.map(category => category.id)), [
			[],
			[CustomizationMigrationCategoryId.UserData],
			[CustomizationMigrationCategoryId.PromptFiles, CustomizationMigrationCategoryId.UserData],
		]);
		editor.editorPreviewDisposables.dispose();
	});

	test('tracks migration selection by URI and storage', () => {
		const editor = createTestEditor(undefined, createConfigurationServiceStub({
			[ChatConfiguration.ChatCustomizationsPromptMigrationEnabled]: true,
		}));
		const sharedUri = URI.file('/home/user/shared.prompt.md');
		const workspacePrompt: MigratableConfiguration = {
			uri: sharedUri,
			storage: PromptsStorage.local,
			type: PromptsType.prompt,
			source: PromptFileSource.ConfigWorkspace,
		};
		const userPrompt: MigratableConfiguration = {
			uri: sharedUri,
			storage: PromptsStorage.user,
			type: PromptsType.prompt,
			source: PromptFileSource.ConfigPersonal,
		};
		const candidates = new Map<CustomizationMigrationCategoryId, readonly MigratableConfiguration[]>([
			[CustomizationMigrationCategoryId.PromptFiles, [workspacePrompt, userPrompt]],
		]);

		editor.setCustomizationsToMigrate(candidates, new Map());
		editor.setCustomizationSelectedForMigration(workspacePrompt, false);
		editor.setCustomizationsToMigrate(candidates, new Map());

		assert.deepStrictEqual({
			workspaceSelected: editor.isCustomizationSelectedForMigration(workspacePrompt),
			userSelected: editor.isCustomizationSelectedForMigration(userPrompt),
			selectedStorages: [...(editor.selectedCustomizationMigrationItems.get(sharedUri) ?? [])],
		}, {
			workspaceSelected: false,
			userSelected: true,
			selectedStorages: [PromptsStorage.user],
		});
		editor.editorPreviewDisposables.dispose();
	});

	test('refreshes migration state when the active session changes within one harness', () => {
		const editor = createTestEditor();
		const sessionA = URI.parse('agent-host-test:/session-a');
		const sessionB = URI.parse('agent-host-test:/session-b');
		const refreshedSessions: string[] = [];
		editor.harnessService.activeSessionResource.set(sessionA, undefined);
		editor.refreshCustomizationMigrationInfo = async () => {
			const sessionResource = editor.harnessService.activeSessionResource.get();
			refreshedSessions.push(sessionResource.path);
			editor.customizationsByMigrationCategory = new Map([[
				CustomizationMigrationCategoryId.UserData,
				[{
					uri: URI.file(`/user-data${sessionResource.path}.instructions.md`),
					storage: PromptsStorage.user,
					type: PromptsType.instructions,
					source: PromptFileSource.UserData,
				} as MigratableConfiguration],
			]]);
			editor.customizationMigrationTargetFoldersByType = new Map([[
				PromptsType.instructions,
				[{
					uri: URI.file('/home/test/.test-harness' + sessionResource.path + '/instructions'),
					label: sessionResource.path,
					source: AICustomizationSources.user,
				}],
			]]);
		};

		editor.registerCustomizationMigrationSessionRefresh();
		editor.harnessService.activeSessionResource.set(sessionB, undefined);

		assert.deepStrictEqual({
			refreshedSessions,
			candidatePaths: [...editor.customizationsByMigrationCategory.values()].flat().map(candidate => candidate.uri.path),
			destinationPaths: [...editor.customizationMigrationTargetFoldersByType.values()].flat().map(folder => folder.uri.path),
		}, {
			refreshedSessions: ['/session-a', '/session-b'],
			candidatePaths: ['/user-data/session-b.instructions.md'],
			destinationPaths: ['/home/test/.test-harness/session-b/instructions'],
		});
		editor.editorPreviewDisposables.dispose();
	});

	test('migration banners include destination consequences when applicable', () => {
		const editor = createTestEditor(undefined, createConfigurationServiceStub({
			[ChatConfiguration.ChatCustomizationsUserDataMigrationEnabled]: true,
			[ChatConfiguration.ChatCustomizationsPromptMigrationEnabled]: true,
		}));
		const userDataCustomizations = [
			{
				uri: URI.file('/user-data/prompts/legacy.agent.md'),
				name: 'legacy.agent.md',
				storage: PromptsStorage.user,
				type: PromptsType.agent,
				source: PromptFileSource.UserData,
			} as MigratableConfiguration,
			{
				uri: URI.file('/user-data/prompts/style.instructions.md'),
				name: 'style.instructions.md',
				storage: PromptsStorage.user,
				type: PromptsType.instructions,
				source: PromptFileSource.UserData,
			} as MigratableConfiguration,
		];
		const promptFiles = [
			{
				uri: URI.file('/workspace/.github/prompts/review.prompt.md'),
				name: 'review.prompt.md',
				storage: PromptsStorage.local,
				type: PromptsType.prompt,
				source: PromptFileSource.GitHubWorkspace,
			} as MigratableConfiguration,
		];
		editor.customizationsByMigrationCategory = new Map([
			[CustomizationMigrationCategoryId.UserData, userDataCustomizations],
			[CustomizationMigrationCategoryId.PromptFiles, promptFiles],
		]);
		editor.customizationMigrationTargetFoldersByType = new Map([
			[PromptsType.agent, [{ uri: URI.file('/home/test/.copilot/agents'), label: '~/.copilot', source: AICustomizationSources.user }]],
			[PromptsType.instructions, [{ uri: URI.file('/home/test/.copilot/instructions'), label: '~/.copilot', source: AICustomizationSources.user }]],
		]);
		editor.selectedCustomizationMigrationItems = new ResourceMap();
		editor.migrationListContainer = document.createElement('div');
		editor.migrationTitleElement = document.createElement('h2');
		editor.migrationDescriptionElement = document.createElement('p');
		editor.migrationBannerContainer = document.createElement('div');
		editor.migrationLinkElement = document.createElement('a');
		editor.migrationMigrateButton = { enabled: false, label: '' };
		document.body.appendChild(editor.migrationListContainer);

		const readBanner = () => ({
			message: editor.migrationBannerContainer!.querySelector('.customization-migration-banner-message')?.textContent ?? '',
			consequence: editor.migrationBannerContainer!.querySelector('.customization-migration-banner-consequence')?.textContent ?? '',
			bannerHidden: editor.migrationBannerContainer!.style.display === 'none',
			descriptionHidden: editor.migrationDescriptionElement!.style.display === 'none',
			linkInBanner: editor.migrationLinkElement!.closest('.customization-migration-banner-content') !== null,
		});

		try {
			editor.activeMigrationCategoryId = CustomizationMigrationCategoryId.UserData;
			editor.renderCustomizationMigrationPage();
			const userData = readBanner();

			editor.activeMigrationCategoryId = CustomizationMigrationCategoryId.PromptFiles;
			editor.renderCustomizationMigrationPage();
			const prompts = readBanner();

			assert.deepStrictEqual({ userData, prompts }, {
				userData: {
					message: 'They are stored in user data, which only VS Code reads. Move them to \'~/.copilot\' so both VS Code and this harness can use them, keeping their name, type, and content.',
					consequence: 'Migrated files aren\'t currently included in Settings Sync.',
					bannerHidden: false,
					descriptionHidden: true,
					linkInBanner: true,
				},
				prompts: {
					message: 'Prompts are no longer supported by Copilot. Convert them to skills to keep them available in both VS Code and this harness.',
					consequence: '',
					bannerHidden: false,
					descriptionHidden: true,
					linkInBanner: true,
				},
			});
		} finally {
			editor.migrationListContainer.remove();
			editor.migrationPageDisposables.dispose();
			editor.editorPreviewDisposables.dispose();
		}
	});

	test('opens a migration candidate through the shared Button widget', () => {
		const editor = createTestEditor(undefined, createConfigurationServiceStub({
			[ChatConfiguration.ChatCustomizationsPromptMigrationEnabled]: true,
		}));
		const promptFile: MigratableConfiguration = {
			uri: URI.file('/workspace/.github/prompts/review.prompt.md'),
			name: 'Review',
			storage: PromptsStorage.local,
			type: PromptsType.prompt,
			source: PromptFileSource.GitHubWorkspace,
		};
		const openedItems: unknown[][] = [];
		editor.showEmbeddedEditor = async (...args: unknown[]) => { openedItems.push(args); };
		editor.customizationsByMigrationCategory = new Map([[CustomizationMigrationCategoryId.PromptFiles, [promptFile]]]);
		editor.activeMigrationCategoryId = CustomizationMigrationCategoryId.PromptFiles;
		editor.migrationListContainer = document.createElement('div');
		editor.migrationMigrateButton = { enabled: false, label: '' };
		document.body.appendChild(editor.migrationListContainer);

		try {
			editor.renderCustomizationMigrationPage();
			const openButton = editor.migrationListContainer.querySelector<HTMLElement>('.prompt-migration-open-button');
			const activateWithKey = (key: string, keyCode: number): void => {
				const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
				Object.defineProperty(event, 'keyCode', { get: () => keyCode });
				openButton?.dispatchEvent(event);
			};
			activateWithKey('Enter', 13);
			activateWithKey(' ', 32);

			assert.deepStrictEqual({
				tagName: openButton?.tagName,
				role: openButton?.getAttribute('role'),
				ariaLabel: openButton?.getAttribute('aria-label'),
				openedItems,
			}, {
				tagName: 'A',
				role: 'button',
				ariaLabel: 'Open Review, /workspace/.github/prompts/review.prompt.md',
				openedItems: [
					[promptFile.uri, 'Review', PromptsType.prompt, PromptsStorage.local, true],
					[promptFile.uri, 'Review', PromptsType.prompt, PromptsStorage.local, true],
				],
			});
		} finally {
			editor.migrationListContainer.remove();
			editor.migrationPageDisposables.dispose();
			editor.editorPreviewDisposables.dispose();
		}
	});

	test('group migration selection retains keyboard focus', () => {
		const editor = createTestEditor(undefined, createConfigurationServiceStub({
			[ChatConfiguration.ChatCustomizationsPromptMigrationEnabled]: true,
		}));
		const promptFiles = [
			{
				uri: URI.file('/workspace/.github/prompts/workspace-a.prompt.md'),
				name: 'workspace-a.prompt.md',
				storage: PromptsStorage.local,
				type: PromptsType.prompt,
				source: PromptFileSource.GitHubWorkspace,
			} as MigratableConfiguration,
			{
				uri: URI.file('/workspace/.github/prompts/workspace-b.prompt.md'),
				name: 'workspace-b.prompt.md',
				storage: PromptsStorage.local,
				type: PromptsType.prompt,
				source: PromptFileSource.GitHubWorkspace,
			} as MigratableConfiguration,
		];
		editor.customizationsByMigrationCategory = new Map([[CustomizationMigrationCategoryId.PromptFiles, promptFiles]]);
		editor.activeMigrationCategoryId = CustomizationMigrationCategoryId.PromptFiles;
		for (const promptFile of promptFiles) {
			editor.setCustomizationSelectedForMigration(promptFile, true);
		}
		editor.migrationListContainer = document.createElement('div');
		editor.migrationMigrateButton = { enabled: false, label: '' };
		document.body.appendChild(editor.migrationListContainer);

		try {
			editor.renderCustomizationMigrationPage();
			const groupCheckbox = editor.migrationListContainer.querySelector<HTMLElement>('.prompt-migration-group-checkbox .monaco-checkbox')!;
			const itemCheckboxes = [...editor.migrationListContainer.querySelectorAll<HTMLElement>('.prompt-migration-checkbox .monaco-checkbox')];
			const activateWithSpace = (): void => {
				const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
				Object.defineProperty(event, 'keyCode', { get: () => 32 });
				groupCheckbox.dispatchEvent(event);
			};
			groupCheckbox.focus();
			activateWithSpace();
			const afterDeselecting = {
				groupRetainedFocus: document.activeElement === groupCheckbox,
				groupConnected: groupCheckbox.isConnected,
				groupChecked: groupCheckbox.getAttribute('aria-checked'),
				itemCheckboxes: itemCheckboxes.map(checkbox => checkbox.getAttribute('aria-checked')),
				selectedItems: promptFiles.map(promptFile => editor.isCustomizationSelectedForMigration(promptFile)),
				migrateButton: { ...editor.migrationMigrateButton },
			};
			activateWithSpace();

			assert.deepStrictEqual({
				afterDeselecting,
				afterReselecting: {
					groupRetainedFocus: document.activeElement === groupCheckbox,
					groupConnected: groupCheckbox.isConnected,
					groupChecked: groupCheckbox.getAttribute('aria-checked'),
					itemCheckboxes: itemCheckboxes.map(checkbox => checkbox.getAttribute('aria-checked')),
					selectedItems: promptFiles.map(promptFile => editor.isCustomizationSelectedForMigration(promptFile)),
					migrateButton: { ...editor.migrationMigrateButton },
				},
			}, {
				afterDeselecting: {
					groupRetainedFocus: true,
					groupConnected: true,
					groupChecked: 'false',
					itemCheckboxes: ['false', 'false'],
					selectedItems: [false, false],
					migrateButton: { enabled: false, label: 'Convert to Skills' },
				},
				afterReselecting: {
					groupRetainedFocus: true,
					groupConnected: true,
					groupChecked: 'true',
					itemCheckboxes: ['true', 'true'],
					selectedItems: [true, true],
					migrateButton: { enabled: true, label: 'Convert 2 to Skills' },
				},
			});
		} finally {
			editor.migrationListContainer.remove();
			editor.migrationPageDisposables.dispose();
			editor.editorPreviewDisposables.dispose();
		}
	});

	test('customization migration groups render as flat source sections', () => {
		const editor = createTestEditor(undefined, createConfigurationServiceStub({
			[ChatConfiguration.ChatCustomizationsPromptMigrationEnabled]: true,
		}));
		const promptFiles = [
			{
				uri: URI.file('/workspace/.github/prompts/workspace-a.prompt.md'),
				name: 'workspace-a.prompt.md',
				storage: PromptsStorage.local,
				type: PromptsType.prompt,
				source: PromptFileSource.GitHubWorkspace,
			} as MigratableConfiguration,
			{
				uri: URI.file('/workspace/.github/prompts/workspace-b.prompt.md'),
				name: 'workspace-b.prompt.md',
				storage: PromptsStorage.local,
				type: PromptsType.prompt,
				source: PromptFileSource.GitHubWorkspace,
			} as MigratableConfiguration,
			{
				uri: URI.file('/user-data/prompts/user-a.prompt.md'),
				name: 'user-a.prompt.md',
				storage: PromptsStorage.user,
				type: PromptsType.prompt,
				source: PromptFileSource.UserData,
			} as MigratableConfiguration,
			{
				uri: URI.file('/user-data/prompts/user-b.prompt.md'),
				name: 'user-b.prompt.md',
				storage: PromptsStorage.user,
				type: PromptsType.prompt,
				source: PromptFileSource.UserData,
			} as MigratableConfiguration,
		];
		editor.customizationsByMigrationCategory = new Map([[CustomizationMigrationCategoryId.PromptFiles, promptFiles]]);
		editor.activeMigrationCategoryId = CustomizationMigrationCategoryId.PromptFiles;
		for (const promptFile of promptFiles) {
			editor.setCustomizationSelectedForMigration(promptFile, true);
		}
		editor.migrationListContainer = document.createElement('div');
		editor.migrationTitleElement = document.createElement('h2');
		editor.migrationDescriptionElement = document.createElement('p');
		editor.migrationLinkElement = document.createElement('a');
		editor.migrationMigrateButton = { enabled: false, label: '' };
		document.body.appendChild(editor.migrationListContainer);

		try {
			editor.renderCustomizationMigrationPage();

			const groupContainers = [...editor.migrationListContainer.querySelectorAll('.prompt-migration-group-items')] as HTMLElement[];
			assert.deepStrictEqual({
				groupTitles: [...editor.migrationListContainer.querySelectorAll('.prompt-migration-group-title')].map(element => element.textContent),
				groupContainers: groupContainers.map(container => container.style.display),
				collapseButtons: editor.migrationListContainer.querySelectorAll('.prompt-migration-group-toggle').length,
			}, {
				groupTitles: ['Workspace', 'User'],
				groupContainers: ['', ''],
				collapseButtons: 0,
			});
		} finally {
			editor.migrationListContainer.remove();
			editor.migrationPageDisposables.dispose();
			editor.editorPreviewDisposables.dispose();
		}
	});

	test('unchecking every item in a migration group unchecks the group checkbox', () => {
		const editor = createTestEditor(undefined, createConfigurationServiceStub({
			[ChatConfiguration.ChatCustomizationsPromptMigrationEnabled]: true,
		}));
		const promptFiles = [
			{
				uri: URI.file('/workspace/.github/prompts/workspace-a.prompt.md'),
				name: 'workspace-a.prompt.md',
				storage: PromptsStorage.local,
				type: PromptsType.prompt,
				source: PromptFileSource.GitHubWorkspace,
			} as MigratableConfiguration,
			{
				uri: URI.file('/workspace/.github/prompts/workspace-b.prompt.md'),
				name: 'workspace-b.prompt.md',
				storage: PromptsStorage.local,
				type: PromptsType.prompt,
				source: PromptFileSource.GitHubWorkspace,
			} as MigratableConfiguration,
		];
		editor.customizationsByMigrationCategory = new Map([[CustomizationMigrationCategoryId.PromptFiles, promptFiles]]);
		editor.activeMigrationCategoryId = CustomizationMigrationCategoryId.PromptFiles;
		for (const promptFile of promptFiles) {
			editor.setCustomizationSelectedForMigration(promptFile, true);
		}
		editor.migrationListContainer = document.createElement('div');
		editor.migrationTitleElement = document.createElement('h2');
		editor.migrationDescriptionElement = document.createElement('p');
		editor.migrationLinkElement = document.createElement('a');
		editor.migrationMigrateButton = { enabled: false, label: '' };
		document.body.appendChild(editor.migrationListContainer);

		try {
			editor.renderCustomizationMigrationPage();

			const groupCheckbox = editor.migrationListContainer.querySelector<HTMLElement>('.prompt-migration-group-checkbox [role="checkbox"]');
			const itemCheckboxes = [...editor.migrationListContainer.querySelectorAll<HTMLElement>('.prompt-migration-group-items .prompt-migration-checkbox [role="checkbox"]')];
			const readGroupChecked = () => groupCheckbox?.getAttribute('aria-checked');

			const initiallyChecked = readGroupChecked();
			// Unchecking only one item leaves a partial group selection.
			itemCheckboxes[0].click();
			const afterFirstUncheck = readGroupChecked();
			// Unchecking the last remaining item must keep the group checkbox cleared (issue #331330).
			itemCheckboxes[1].click();
			const afterLastUncheck = readGroupChecked();
			// Re-checking every item should re-select the group checkbox.
			itemCheckboxes[0].click();
			itemCheckboxes[1].click();
			const afterRecheckingAll = readGroupChecked();

			assert.deepStrictEqual({
				itemCount: itemCheckboxes.length,
				initiallyChecked,
				afterFirstUncheck,
				afterLastUncheck,
				afterRecheckingAll,
			}, {
				itemCount: 2,
				initiallyChecked: 'true',
				afterFirstUncheck: 'mixed',
				afterLastUncheck: 'false',
				afterRecheckingAll: 'true',
			});
		} finally {
			editor.migrationListContainer.remove();
			editor.migrationPageDisposables.dispose();
			editor.editorPreviewDisposables.dispose();
		}
	});

	test('cleans up and detaches DOM container and embedded editors on dispose', () => {
		const editor = createTestEditor();
		const parent = document.createElement('div');
		const container = document.createElement('div');
		const child = document.createElement('span');
		container.appendChild(child);
		parent.appendChild(container);
		editor.container = container;

		let modelCleared = false;
		let mcpDetailCleared = false;
		editor.embeddedEditor = {
			setModel(model: unknown) {
				if (model === null) {
					modelCleared = true;
				}
			}
		};
		editor.embeddedMcpDetail = {
			clearInput() {
				mcpDetailCleared = true;
			}
		};

		editor.dispose();
		editor.editorPreviewDisposables.dispose();

		assert.strictEqual(container.childNodes.length, 0);
		assert.strictEqual(container.parentElement, null);
		assert.strictEqual(modelCleared, true);
		assert.strictEqual(mcpDetailCleared, true);
	});

	type FakeSessionModel = {
		getValue(): string;
		setValue(value: string): void;
		isDisposed(): boolean;
		dispose(): void;
	};

	type BuiltinSaveTarget = { label: string; target: 'workspace' | 'user' | 'cancel'; folder?: URI };

	type ExistingCustomizationSaveRequest = {
		readonly fileUri: URI;
		readonly modelRef: IReference<IResolvedTextEditorModel>;
		readonly projectRoot?: URI;
	};

	type SaveTestableEditor = TestableEditor & {
		textFileService: ITextFileService;
		fileService: IFileService;
		notificationService: INotificationService;
		telemetryService: ITelemetryService;
		currentEditingUri: URI | undefined;
		currentEditingProjectRoot: URI | undefined;
		_editorContentChanged: boolean;
		currentModelRef: IReference<IResolvedTextEditorModel> | undefined;
		editorReturnViewMode: 'list' | 'migration';
		editorModelChangeDisposables: DisposableStore;
		editorSaveIndicator: HTMLElement;
		inEditorContextKey: { set(value: boolean): void };
		listWidget: { refresh(): void; focusSearch(): void } | undefined;
		builtinEditingSessions: Map<string, { model: FakeSessionModel; originalContent: string }>;
		builtinOverrideSavesInFlight: Map<string, Promise<boolean>>;
		createExistingCustomizationSaveRequest(): ExistingCustomizationSaveRequest | undefined;
		saveExistingCustomization(request: ExistingCustomizationSaveRequest): Promise<void>;
		pickBuiltinPromptSaveTarget(): Promise<BuiltinSaveTarget | undefined>;
		handleEditorActionButton(): Promise<void>;
		handleBuiltinSave(): Promise<boolean>;
		goBackToList(): void;
		clearInput(): void;
	};

	const workspaceSaveTarget: BuiltinSaveTarget = { label: 'Workspace', target: 'workspace', folder: URI.file('/workspace/.github/skills') };

	function createSaveTestEditor(): SaveTestableEditor {
		const editor = createTestEditor() as SaveTestableEditor;
		// `goBackToList` clears `editorPreviewDisposables`, which holds the stub's original `_store`.
		(editor as unknown as { _store: DisposableStore })._store = store.add(new DisposableStore());
		editor.editorModelChangeDisposables = store.add(new DisposableStore());
		editor.editorSaveIndicator = document.createElement('div');
		editor.editorReturnViewMode = 'list';
		editor.inEditorContextKey = { set() { } };
		editor.listWidget = { refresh() { }, focusSearch() { } };
		editor.builtinEditingSessions = new Map();
		editor.builtinOverrideSavesInFlight = new Map();
		editor.telemetryService = { publicLog2() { } } as unknown as ITelemetryService;
		return editor;
	}

	function createFakeSessionModel(initialValue: string): FakeSessionModel {
		let value = initialValue;
		let disposed = false;
		return {
			getValue: () => value,
			setValue: next => { value = next; },
			isDisposed: () => disposed,
			dispose: () => { disposed = true; },
		};
	}

	function createExistingCustomizationEditor(save: (resource: URI, options: ITextFileSaveOptions | undefined) => Promise<URI | undefined>) {
		const editor = createSaveTestEditor();
		const events: string[] = [];
		const modelUri = URI.file('/workspace/.github/agents/reviewer.agent.md');
		editor.currentEditingUri = URI.file('/workspace/.github/agents/Reviewer.agent.md');
		editor.currentEditingSource = AICustomizationSources.local;
		editor.currentEditingProjectRoot = URI.file('/workspace');
		editor._editorContentChanged = true;
		editor.currentModelRef = {
			object: { textEditorModel: { uri: modelUri } } as unknown as IResolvedTextEditorModel,
			dispose: () => { events.push('release'); },
		};
		editor.textFileService = {
			save: (resource: URI, options?: ITextFileSaveOptions) => {
				events.push(`save:${resource.path}`);
				return save(resource, options);
			},
		} as unknown as ITextFileService;
		editor.fileService = { writeFile: async () => { events.push('writeFile'); } } as unknown as IFileService;
		editor.workspaceService = {
			...editor.workspaceService,
			commitFiles: async (_projectRoot: URI, fileUris: URI[]) => { events.push(`commit:${fileUris.map(uri => uri.path).join(',')}`); },
		} as IAICustomizationWorkspaceService;
		return { editor, events, modelUri };
	}

	function createBuiltinOverrideEditor(options: { pick?: () => Promise<BuiltinSaveTarget | undefined>; writeFile?: () => Promise<void> } = {}) {
		const editor = createSaveTestEditor();
		const sourceUri = URI.file('/app/builtin/skills/review/SKILL.md');
		const session = createFakeSessionModel('edited');
		const warnings: string[] = [];
		const calls = { pick: 0, write: 0, goBack: 0 };
		editor.viewMode = 'editor';
		editor.currentEditingUri = sourceUri;
		editor.currentEditingSource = AICustomizationSources.builtin;
		editor.currentEditingPromptType = PromptsType.skill;
		editor._editorContentChanged = true;
		editor.builtinEditingSessions.set(sourceUri.toString(), { model: session, originalContent: 'original' });
		editor.pickBuiltinPromptSaveTarget = () => {
			calls.pick++;
			return options.pick?.() ?? Promise.resolve(workspaceSaveTarget);
		};
		editor.fileService = {
			createFolder: async () => undefined,
			writeFile: async () => {
				calls.write++;
				await options.writeFile?.();
			},
		} as unknown as IFileService;
		editor.notificationService = { warn: (message: string) => { warnings.push(message); } } as unknown as INotificationService;
		editor.workspaceService = {
			...editor.workspaceService,
			getActiveProjectRoot: () => undefined,
			commitFiles: async () => { },
		} as IAICustomizationWorkspaceService;
		const goBackToList = editor.goBackToList.bind(editor);
		editor.goBackToList = () => {
			calls.goBack++;
			goBackToList();
		};
		return { editor, sourceUri, session, warnings, calls };
	}

	/** The unit test runner fails on any console output; a failed override write logs this error on purpose. */
	async function withoutOverrideWriteErrorLog<T>(run: () => Promise<T>): Promise<T> {
		const originalConsoleError = console.error;
		console.error = (...args: unknown[]) => {
			if (typeof args[0] === 'string' && args[0].startsWith('Failed to save built-in override:')) {
				return;
			}
			originalConsoleError.apply(console, args as Parameters<typeof console.error>);
		};
		try {
			return await run();
		} finally {
			console.error = originalConsoleError;
		}
	}

	test('saves an edited workspace customization through its text file model and releases the reference afterwards', async () => {
		const saveResult = new DeferredPromise<URI | undefined>();
		const saveOptions: (ITextFileSaveOptions | undefined)[] = [];
		const { editor, events, modelUri } = createExistingCustomizationEditor((_resource, options) => {
			saveOptions.push(options);
			return saveResult.p;
		});

		const request = editor.createExistingCustomizationSaveRequest();
		assert.ok(request);
		const pending = editor.saveExistingCustomization(request);
		const beforeSaveSettled = [...events];
		saveResult.complete(modelUri);
		await pending;

		assert.deepStrictEqual({
			currentModelRef: editor.currentModelRef,
			beforeSaveSettled,
			events,
			options: saveOptions.map(options => ({ reason: options?.reason, skipSaveParticipants: options?.skipSaveParticipants })),
		}, {
			currentModelRef: undefined,
			beforeSaveSettled: ['save:/workspace/.github/agents/reviewer.agent.md'],
			events: ['save:/workspace/.github/agents/reviewer.agent.md', 'commit:/workspace/.github/agents/Reviewer.agent.md', 'release'],
			options: [{ reason: SaveReason.EXPLICIT, skipSaveParticipants: true }],
		});

		editor.editorPreviewDisposables.dispose();
	});

	test('does not commit when saving the text file model fails and still releases the reference', async () => {
		const { editor, events, modelUri } = createExistingCustomizationEditor(async () => undefined);

		const request = editor.createExistingCustomizationSaveRequest();
		assert.ok(request);
		await editor.saveExistingCustomization(request);

		assert.deepStrictEqual(events, [`save:${modelUri.path}`, 'release']);

		editor.editorPreviewDisposables.dispose();
	});

	test('saving through the text file model clears its dirty state and keeps it dirty on a save conflict', async () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const accessor = instantiationService.createInstance(TestServiceAccessor);
		const files = accessor.textFileService.files as ITestTextFileEditorModelManager;
		store.add(files);
		const editor = createSaveTestEditor();
		const commits: string[] = [];
		let released = 0;
		editor.textFileService = accessor.textFileService;
		editor.workspaceService = {
			...editor.workspaceService,
			commitFiles: async (_projectRoot: URI, fileUris: URI[]) => { commits.push(...fileUris.map(uri => uri.path)); },
		} as IAICustomizationWorkspaceService;

		const saveEdited = async (path: string) => {
			const model = store.add(instantiationService.createInstance(TextFileEditorModel, URI.file(path), 'utf8', undefined));
			files.add(model.resource, model);
			await model.resolve();
			model.textEditorModel!.setValue('changed');
			await editor.saveExistingCustomization({
				fileUri: model.resource,
				modelRef: { object: model as unknown as IResolvedTextEditorModel, dispose: () => { released++; } },
				projectRoot: URI.file('/workspace'),
			});
			return model;
		};

		const saved = await saveEdited('/workspace/.github/agents/saved.agent.md');
		accessor.fileService.writeShouldThrowError = new FileOperationError('save conflict', FileOperationResult.FILE_MODIFIED_SINCE);
		const conflicting = await saveEdited('/workspace/.github/agents/conflict.agent.md').finally(() => {
			accessor.fileService.writeShouldThrowError = undefined;
		});

		assert.deepStrictEqual({
			savedDirty: accessor.textFileService.isDirty(saved.resource),
			conflictDirty: accessor.textFileService.isDirty(conflicting.resource),
			commits,
			released,
		}, {
			savedDirty: false,
			conflictDirty: true,
			commits: ['/workspace/.github/agents/saved.agent.md'],
			released: 2,
		});

		editor.editorPreviewDisposables.dispose();
	});

	test('keeps the built-in override edits in the editor and warns when the override write fails', async () => {
		const { editor, sourceUri, session, warnings, calls } = createBuiltinOverrideEditor({ writeFile: () => Promise.reject(new Error('disk full')) });

		await withoutOverrideWriteErrorLog(() => editor.handleEditorActionButton());

		assert.deepStrictEqual({
			warnings,
			goBack: calls.goBack,
			viewMode: editor.viewMode,
			sessionKept: editor.builtinEditingSessions.get(sourceUri.toString())?.model === session,
			sessionContent: session.getValue(),
			sessionDisposed: session.isDisposed(),
			inFlight: editor.builtinOverrideSavesInFlight.size,
		}, {
			warnings: ['Could not save the override to the workspace.'],
			goBack: 0,
			viewMode: 'editor',
			sessionKept: true,
			sessionContent: 'edited',
			sessionDisposed: false,
			inFlight: 0,
		});

		editor.editorPreviewDisposables.dispose();
	});

	test('returns to the list and releases the built-in session once the override is written', async () => {
		const { editor, sourceUri, session, warnings, calls } = createBuiltinOverrideEditor();

		await editor.handleEditorActionButton();

		assert.deepStrictEqual({
			warnings,
			goBack: calls.goBack,
			write: calls.write,
			viewMode: editor.viewMode,
			sessionReleased: !editor.builtinEditingSessions.has(sourceUri.toString()) && session.isDisposed(),
		}, {
			warnings: [],
			goBack: 1,
			write: 1,
			viewMode: 'list',
			sessionReleased: true,
		});

		editor.editorPreviewDisposables.dispose();
	});

	test('joins a running override write instead of picking a target and writing again', async () => {
		const write = new DeferredPromise<void>();
		const { editor, calls } = createBuiltinOverrideEditor({ writeFile: () => write.p });

		const buttonSave = editor.handleEditorActionButton();
		await timeout(0);
		const commandSave = editor.handleBuiltinSave();
		write.complete();
		const [, commandResult] = await Promise.all([buttonSave, commandSave]);

		assert.deepStrictEqual({ pick: calls.pick, write: calls.write, commandResult }, { pick: 1, write: 1, commandResult: true });

		editor.editorPreviewDisposables.dispose();
	});

	test('joins an override save that is still waiting for its target', async () => {
		const pick = new DeferredPromise<BuiltinSaveTarget | undefined>();
		const { editor, calls } = createBuiltinOverrideEditor({ pick: () => pick.p });

		const buttonSave = editor.handleEditorActionButton();
		await timeout(0);
		const commandSave = editor.handleBuiltinSave();
		pick.complete(workspaceSaveTarget);
		const [, commandResult] = await Promise.all([buttonSave, commandSave]);

		assert.deepStrictEqual({ pick: calls.pick, write: calls.write, commandResult }, { pick: 1, write: 1, commandResult: true });

		editor.editorPreviewDisposables.dispose();
	});

	test('closing the editor while the override is written keeps the session until the write settles', async () => {
		const failingWrite = new DeferredPromise<void>();
		const failing = createBuiltinOverrideEditor({ writeFile: () => failingWrite.p });
		const keptWhileWriting = await withoutOverrideWriteErrorLog(async () => {
			const failingSave = failing.editor.handleEditorActionButton();
			await timeout(0);
			failing.editor.viewMode = 'list';
			failing.editor.clearInput();
			const kept = failing.editor.builtinEditingSessions.has(failing.sourceUri.toString());
			failingWrite.error(new Error('disk full'));
			await failingSave;
			return kept;
		});

		const succeedingWrite = new DeferredPromise<void>();
		const succeeding = createBuiltinOverrideEditor({ writeFile: () => succeedingWrite.p });
		const succeedingSave = succeeding.editor.handleEditorActionButton();
		await timeout(0);
		succeeding.editor.viewMode = 'list';
		succeeding.editor.clearInput();
		succeedingWrite.complete();
		await succeedingSave;

		assert.deepStrictEqual({
			keptWhileWriting,
			keptAfterFailure: failing.editor.builtinEditingSessions.has(failing.sourceUri.toString()) && !failing.session.isDisposed(),
			warnings: failing.warnings,
			releasedAfterSuccess: !succeeding.editor.builtinEditingSessions.has(succeeding.sourceUri.toString()) && succeeding.session.isDisposed(),
		}, {
			keptWhileWriting: true,
			keptAfterFailure: true,
			warnings: ['Could not save the override to the workspace.'],
			releasedAfterSuccess: true,
		});

		failing.editor.editorPreviewDisposables.dispose();
		succeeding.editor.editorPreviewDisposables.dispose();
	});

	test('keeps edits made after leaving and returning while the override was written', async () => {
		const write = new DeferredPromise<void>();
		const { editor, sourceUri, session, calls } = createBuiltinOverrideEditor({ writeFile: () => write.p });

		const save = editor.handleEditorActionButton();
		await timeout(0);
		editor.goBackToList();
		const keptAfterLeaving = editor.builtinEditingSessions.has(sourceUri.toString());

		editor.viewMode = 'editor';
		editor.currentEditingUri = sourceUri;
		editor.currentEditingSource = AICustomizationSources.builtin;
		editor.currentEditingPromptType = PromptsType.skill;
		session.setValue('edited more');
		editor._editorContentChanged = true;

		write.complete();
		await save;

		assert.deepStrictEqual({
			keptAfterLeaving,
			goBack: calls.goBack,
			viewMode: editor.viewMode,
			sessionContent: editor.builtinEditingSessions.get(sourceUri.toString())?.model.getValue(),
			editorContentChanged: editor._editorContentChanged,
		}, {
			keptAfterLeaving: true,
			goBack: 1,
			viewMode: 'editor',
			sessionContent: 'edited more',
			editorContentChanged: true,
		});

		editor.editorPreviewDisposables.dispose();
	});

	test('releases the built-in session when the target pick is cancelled after leaving the item', async () => {
		const pick = new DeferredPromise<BuiltinSaveTarget | undefined>();
		const { editor, sourceUri, session, calls } = createBuiltinOverrideEditor({ pick: () => pick.p });

		const save = editor.handleEditorActionButton();
		await timeout(0);
		editor.goBackToList();
		const keptWhilePicking = editor.builtinEditingSessions.has(sourceUri.toString());
		pick.complete(undefined);
		await save;

		assert.deepStrictEqual({
			keptWhilePicking,
			released: !editor.builtinEditingSessions.has(sourceUri.toString()) && session.isDisposed(),
			write: calls.write,
		}, {
			keptWhilePicking: true,
			released: true,
			write: 0,
		});

		editor.editorPreviewDisposables.dispose();
	});
});
