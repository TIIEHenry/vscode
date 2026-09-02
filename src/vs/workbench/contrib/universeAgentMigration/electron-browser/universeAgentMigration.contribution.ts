/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { isEqual, joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IHostService } from '../../../services/host/browser/host.js';
import {
	getDestSettingsResource,
	getProfileMigrationCopies,
	ICodeOssMigrationCopy,
	MIGRATE_FROM_CODE_OSS_COMMAND_ID,
	MIGRATION_OFFERED_STORAGE_KEY,
	PROFILES_FOLDER_NAME,
	resolveCodeOssUserDataUri,
	shouldOfferCodeOssMigration,
	USER_FOLDER_NAME,
} from '../common/codeOssMigration.js';

async function copyIfExists(fileService: IFileService, logService: ILogService, item: ICodeOssMigrationCopy): Promise<boolean> {
	if (!(await fileService.exists(item.source))) {
		return false;
	}

	await fileService.copy(item.source, item.target, true);
	logService.info(`[universeAgentMigration] copied ${item.source.toString()} -> ${item.target.toString()}`);
	return true;
}

async function copyProfileAllowList(fileService: IFileService, logService: ILogService, sourceProfileHome: URI, targetProfileHome: URI): Promise<number> {
	let copied = 0;

	for (const item of getProfileMigrationCopies(sourceProfileHome, targetProfileHome)) {
		if (await copyIfExists(fileService, logService, item)) {
			copied++;
		}
	}

	return copied;
}

/**
 * Copies only settings.json, keybindings.json, and snippets/ from the default
 * profile and each named profile. Never copies globalStorage, state.vscdb, or
 * workspaceStorage.
 */
async function migrateCodeOssUserData(fileService: IFileService, logService: ILogService, sourceUserData: URI, targetUserData: URI): Promise<number> {
	const sourceUserHome = joinPath(sourceUserData, USER_FOLDER_NAME);
	const targetUserHome = joinPath(targetUserData, USER_FOLDER_NAME);
	let copied = await copyProfileAllowList(fileService, logService, sourceUserHome, targetUserHome);

	const sourceProfilesHome = joinPath(sourceUserHome, PROFILES_FOLDER_NAME);
	if (await fileService.exists(sourceProfilesHome)) {
		const stat = await fileService.resolve(sourceProfilesHome);
		for (const child of stat.children ?? []) {
			if (!child.isDirectory) {
				continue;
			}

			copied += await copyProfileAllowList(
				fileService,
				logService,
				child.resource,
				joinPath(targetUserHome, PROFILES_FOLDER_NAME, child.name)
			);
		}
	}

	return copied;
}

async function runMigrateFromCodeOss(accessor: ServicesAccessor): Promise<void> {
	const environmentService = accessor.get(INativeEnvironmentService);
	const fileService = accessor.get(IFileService);
	const logService = accessor.get(ILogService);
	const notificationService = accessor.get(INotificationService);
	const productService = accessor.get(IProductService);
	const hostService = accessor.get(IHostService);

	const dest = URI.file(environmentService.userDataPath);
	const source = resolveCodeOssUserDataUri(dest, environmentService.isBuilt);

	if (isEqual(source, dest)) {
		notificationService.info(localize('universeAgent.migration.sameFolder', "Current user data is already the Code - OSS folder; nothing to migrate."));
		return;
	}

	if (!await fileService.exists(source)) {
		notificationService.info(localize('universeAgent.migration.noSource', "No Code - OSS user data folder was found."));
		return;
	}

	try {
		const copied = await migrateCodeOssUserData(fileService, logService, source, dest);
		if (copied === 0) {
			notificationService.info(localize('universeAgent.migration.empty', "No settings, keybindings, or snippets were found in the Code - OSS data folder."));
			return;
		}

		notificationService.prompt(
			Severity.Info,
			localize('universeAgent.migration.done', "Migrated settings, keybindings, and snippets from Code - OSS. Reload {0} to apply them?", productService.nameLong),
			[{
				label: localize('universeAgent.migration.reload', "Reload"),
				run: () => hostService.reload()
			}]
		);
	} catch (error) {
		logService.error('[universeAgentMigration] migrate failed', error);
		notificationService.error(localize('universeAgent.migration.failed', "Could not migrate settings from Code - OSS."));
	}
}

export class UniverseAgentMigrationContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.universeAgentMigration';

	constructor(
		@INativeEnvironmentService private readonly nativeEnvironmentService: INativeEnvironmentService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@IStorageService private readonly storageService: IStorageService,
		@IFileService private readonly fileService: IFileService,
		@INotificationService private readonly notificationService: INotificationService,
		@IProductService private readonly productService: IProductService,
		@ICommandService private readonly commandService: ICommandService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		void this.maybeOffer();
	}

	private async maybeOffer(): Promise<void> {
		if (this.environmentService.isSessionsWindow) {
			return;
		}

		const dest = URI.file(this.nativeEnvironmentService.userDataPath);
		const source = resolveCodeOssUserDataUri(dest, this.nativeEnvironmentService.isBuilt);
		const alreadyOffered = this.storageService.getBoolean(MIGRATION_OFFERED_STORAGE_KEY, StorageScope.APPLICATION, false);
		const sourceEqualsDest = isEqual(source, dest);

		let sourceExists = false;
		let hasDestSettingsJson = false;
		try {
			[sourceExists, hasDestSettingsJson] = await Promise.all([
				this.fileService.exists(source),
				this.fileService.exists(getDestSettingsResource(dest)),
			]);
		} catch (error) {
			this.logService.error('[universeAgentMigration] failed to probe user data folders', error);
			return;
		}

		if (!shouldOfferCodeOssMigration({
			alreadyOffered,
			sourceExists,
			sourceEqualsDest,
			isNewApplication: this.storageService.isNew(StorageScope.APPLICATION),
			hasDestSettingsJson,
		})) {
			return;
		}

		this.storageService.store(MIGRATION_OFFERED_STORAGE_KEY, true, StorageScope.APPLICATION, StorageTarget.MACHINE);

		this.notificationService.prompt(
			Severity.Info,
			localize('universeAgent.migration.offer', "Code - OSS settings, keybindings, and snippets were found. Migrate them to {0}? Secrets, extensions, and window state are not copied.", this.productService.nameLong),
			[{
				label: localize('universeAgent.migration.migrate', "Migrate"),
				run: () => this.commandService.executeCommand(MIGRATE_FROM_CODE_OSS_COMMAND_ID)
			}],
			{ sticky: true }
		);
	}
}

registerAction2(class MigrateFromCodeOssAction extends Action2 {
	constructor() {
		super({
			id: MIGRATE_FROM_CODE_OSS_COMMAND_ID,
			title: localize2('universeAgent.migrateFromCodeOss', "Migrate from Code - OSS"),
			category: Categories.Preferences,
			f1: true
		});
	}

	override run(accessor: ServicesAccessor): Promise<void> {
		return runMigrateFromCodeOss(accessor);
	}
});

registerWorkbenchContribution2(UniverseAgentMigrationContribution.ID, UniverseAgentMigrationContribution, WorkbenchPhase.AfterRestored);
