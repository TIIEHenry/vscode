/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Barrier, Promises } from '../../../../base/common/async.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IUserDataInitializer } from '../../userData/browser/userDataInit.js';
import { IProfileResourceInitializer, IUserDataProfileService, IUserDataProfileTemplate, isUserDataProfileTemplate } from '../common/userDataProfile.js';
import { SettingsResourceInitializer } from './settingsResource.js';
import { GlobalStateResourceInitializer } from './globalStateResource.js';
import { KeybindingsResourceInitializer } from './keybindingsResource.js';
import { TasksResourceInitializer } from './tasksResource.js';
import { SnippetsResourceInitializer } from './snippetsResource.js';
import { McpResourceInitializer } from './mcpProfileResource.js';
import { ExtensionsResourceInitializer } from './extensionsResource.js';
import { IBrowserWorkbenchEnvironmentService } from '../../environment/browser/environmentService.js';
import { isString } from '../../../../base/common/types.js';
import { IRequestService, asJson } from '../../../../platform/request/common/request.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { URI } from '../../../../base/common/uri.js';
import { ProfileResourceType } from '../../../../platform/userDataProfile/common/userDataProfile.js';

export class UserDataProfileInitializer implements IUserDataInitializer {

	_serviceBrand: undefined;

	private readonly initialized: ProfileResourceType[] = [];
	private readonly initializationFinished = new Barrier();

	constructor(
		@IBrowserWorkbenchEnvironmentService private readonly environmentService: IBrowserWorkbenchEnvironmentService,
		@IFileService private readonly fileService: IFileService,
		@IUserDataProfileService private readonly userDataProfileService: IUserDataProfileService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
		@IRequestService private readonly requestService: IRequestService,
	) {
	}

	async whenInitializationFinished(): Promise<void> {
		await this.initializationFinished.wait();
	}

	async requiresInitialization(): Promise<boolean> {
		if (!this.environmentService.options?.profile?.contents) {
			return false;
		}
		if (!this.storageService.isNew(StorageScope.PROFILE)) {
			return false;
		}
		return true;
	}

	async initializeRequiredResources(): Promise<void> {
		this.logService.trace(`UserDataProfileInitializer#initializeRequiredResources`);
		const promises = [];
		const profileTemplate = await this.getProfileTemplate();
		if (profileTemplate?.settings) {
			promises.push(this.initialize(new SettingsResourceInitializer(this.userDataProfileService, this.fileService, this.logService), profileTemplate.settings, ProfileResourceType.Settings));
		}
		if (profileTemplate?.globalState) {
			promises.push(this.initialize(new GlobalStateResourceInitializer(this.storageService), profileTemplate.globalState, ProfileResourceType.GlobalState));
		}
		await Promise.all(promises);
	}

	async initializeOtherResources(instantiationService: IInstantiationService): Promise<void> {
		try {
			this.logService.trace(`UserDataProfileInitializer#initializeOtherResources`);
			const promises = [];
			const profileTemplate = await this.getProfileTemplate();
			if (profileTemplate?.keybindings) {
				promises.push(this.initialize(new KeybindingsResourceInitializer(this.userDataProfileService, this.fileService, this.logService), profileTemplate.keybindings, ProfileResourceType.Keybindings));
			}
			if (profileTemplate?.tasks) {
				promises.push(this.initialize(new TasksResourceInitializer(this.userDataProfileService, this.fileService, this.logService), profileTemplate.tasks, ProfileResourceType.Tasks));
			}
			if (profileTemplate?.mcp) {
				promises.push(this.initialize(new McpResourceInitializer(this.userDataProfileService, this.fileService, this.logService), profileTemplate.mcp, ProfileResourceType.Mcp));
			}
			if (profileTemplate?.snippets) {
				promises.push(this.initialize(new SnippetsResourceInitializer(this.userDataProfileService, this.fileService, this.uriIdentityService, this.logService), profileTemplate.snippets, ProfileResourceType.Snippets));
			}
			promises.push(this.initializeInstalledExtensions(instantiationService));
			await Promises.settled(promises);
		} finally {
			this.initializationFinished.open();
		}
	}

	private initializeInstalledExtensionsPromise: Promise<void> | undefined;
	initializeInstalledExtensions(instantiationService: IInstantiationService): Promise<void> {
		if (!this.initializeInstalledExtensionsPromise) {
			const pending: { promise?: Promise<void> } = {};
			pending.promise = (async () => {
				const profileTemplate = await this.getProfileTemplate();
				if (!profileTemplate) {
					// A null template is a missed read, not a profile without extensions.
					// Drop this attempt so a later read that includes extensions still
					// creates and runs the initializer. In-flight callers share this promise.
					if (this.initializeInstalledExtensionsPromise === pending.promise) {
						this.initializeInstalledExtensionsPromise = undefined;
					}
					return;
				}
				if (!profileTemplate.extensions) {
					return;
				}
				try {
					await this.initialize(instantiationService.createInstance(ExtensionsResourceInitializer), profileTemplate.extensions, ProfileResourceType.Extensions);
				} finally {
					// initialize() logs and swallows failures, so this promise still fulfills.
					// Drop it when the template had extensions: the next call must create and
					// run the initializer again, or take the "initialized already" path.
					if (this.initializeInstalledExtensionsPromise === pending.promise) {
						this.initializeInstalledExtensionsPromise = undefined;
					}
				}
			})();
			this.initializeInstalledExtensionsPromise = pending.promise;
		}
		return this.initializeInstalledExtensionsPromise;
	}

	private profileTemplatePromise: Promise<IUserDataProfileTemplate | null> | undefined;
	private getProfileTemplate(): Promise<IUserDataProfileTemplate | null> {
		if (!this.profileTemplatePromise) {
			const pending: { promise?: Promise<IUserDataProfileTemplate | null> } = {};
			pending.promise = (async () => {
				try {
					const { template, retain } = await this.doGetProfileTemplate();
					// A template object stays cached. Null stays cached only when there
					// are no profile contents. Every other null is read again next time.
					if (!retain && this.profileTemplatePromise === pending.promise) {
						this.profileTemplatePromise = undefined;
					}
					return template;
				} catch (error) {
					if (this.profileTemplatePromise === pending.promise) {
						this.profileTemplatePromise = undefined;
					}
					throw error;
				}
			})();
			this.profileTemplatePromise = pending.promise;
		}
		return this.profileTemplatePromise;
	}

	private async doGetProfileTemplate(): Promise<{ template: IUserDataProfileTemplate | null; retain: boolean }> {
		if (!this.environmentService.options?.profile?.contents) {
			return { template: null, retain: true };
		}

		const fromParsed = (parsed: unknown): { template: IUserDataProfileTemplate | null; retain: boolean } => {
			if (isUserDataProfileTemplate(parsed)) {
				return { template: parsed, retain: true };
			}
			return { template: null, retain: false };
		};

		if (isString(this.environmentService.options.profile.contents)) {
			try {
				return fromParsed(JSON.parse(this.environmentService.options.profile.contents));
			} catch (error) {
				this.logService.error(error);
				return { template: null, retain: false };
			}
		}
		try {
			const url = URI.revive(this.environmentService.options.profile.contents).toString(true);
			const context = await this.requestService.request({ type: 'GET', url, callSite: 'userDataProfileInit.initializeProfile' }, CancellationToken.None);
			if (context.res.statusCode === 200) {
				return fromParsed(await asJson(context));
			} else {
				this.logService.warn(`UserDataProfileInitializer: Failed to get profile from URL: ${url}. Status code: ${context.res.statusCode}.`);
			}
		} catch (error) {
			this.logService.error(error);
		}
		return { template: null, retain: false };
	}

	private async initialize(initializer: IProfileResourceInitializer, content: string, profileResource: ProfileResourceType): Promise<void> {
		try {
			if (this.initialized.includes(profileResource)) {
				this.logService.info(`UserDataProfileInitializer: ${profileResource} initialized already.`);
				return;
			}
			this.logService.trace(`UserDataProfileInitializer: Initializing ${profileResource}`);
			await initializer.initialize(content);
			this.initialized.push(profileResource);
			this.logService.info(`UserDataProfileInitializer: Initialized ${profileResource}`);
		} catch (error) {
			this.logService.info(`UserDataProfileInitializer: Error while initializing ${profileResource}`);
			this.logService.error(error);
		}
	}

}
