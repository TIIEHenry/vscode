/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../base/common/buffer.js';
import { basename, dirname, isEqualOrParent, joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ILogService } from '../../../../platform/log/common/log.js';

/**
 * Hard-coded Code OSS userData folder names. I5 must not read the current
 * `nameShort` so it stays decoupled from the I2 rename.
 */
export const CODE_OSS_USER_DATA_FOLDER_DEV = 'code-oss-dev';
export const CODE_OSS_USER_DATA_FOLDER_RELEASE = 'Code - OSS';

export const MIGRATION_OFFERED_STORAGE_KEY = 'universeAgent.migration.offered';
export const MIGRATE_FROM_CODE_OSS_COMMAND_ID = 'universeAgent.migrateFromCodeOss';

export const USER_FOLDER_NAME = 'User';
export const PROFILES_FOLDER_NAME = 'profiles';
export const SETTINGS_FILE_NAME = 'settings.json';

/**
 * The only user-data files I5 copies (plan §3.2). `globalStorage/`,
 * `state.vscdb`, and `workspaceStorage/` are intentionally absent.
 */
export const MIGRATION_PROFILE_FILES = ['settings.json', 'keybindings.json'] as const;
export const MIGRATION_PROFILE_DIRECTORIES = ['snippets'] as const;

export function getCodeOssUserDataFolderName(isBuilt: boolean): string {
	return isBuilt ? CODE_OSS_USER_DATA_FOLDER_RELEASE : CODE_OSS_USER_DATA_FOLDER_DEV;
}

/**
 * Resolves the hard-coded sibling Code OSS userData folder for the current dest.
 */
export function resolveCodeOssUserDataUri(currentUserData: URI, isBuilt: boolean): URI {
	return joinPath(dirname(currentUserData), getCodeOssUserDataFolderName(isBuilt));
}

export function getDestSettingsResource(currentUserData: URI): URI {
	return joinPath(currentUserData, USER_FOLDER_NAME, SETTINGS_FILE_NAME);
}

export interface ICodeOssMigrationOfferInput {
	readonly alreadyOffered: boolean;
	readonly sourceExists: boolean;
	readonly sourceEqualsDest: boolean;
	readonly isNewApplication: boolean;
	readonly hasDestSettingsJson: boolean;
}

/**
 * One-shot offer: new APPLICATION storage (or no dest settings yet), old
 * folder present, and source is not the current userData.
 */
export function shouldOfferCodeOssMigration(input: ICodeOssMigrationOfferInput): boolean {
	if (input.alreadyOffered || !input.sourceExists || input.sourceEqualsDest) {
		return false;
	}

	return input.isNewApplication || !input.hasDestSettingsJson;
}

export interface ICodeOssMigrationCopy {
	readonly source: URI;
	readonly target: URI;
}

/**
 * Builds the §3.2 allow-list copies for one profile root (`User/` or `User/profiles/<id>/`).
 */
export function getProfileMigrationCopies(sourceProfileHome: URI, targetProfileHome: URI): ICodeOssMigrationCopy[] {
	const copies: ICodeOssMigrationCopy[] = [];

	for (const name of MIGRATION_PROFILE_FILES) {
		copies.push({ source: joinPath(sourceProfileHome, name), target: joinPath(targetProfileHome, name) });
	}

	for (const name of MIGRATION_PROFILE_DIRECTORIES) {
		copies.push({ source: joinPath(sourceProfileHome, name), target: joinPath(targetProfileHome, name) });
	}

	return copies;
}

export type CodeOssMigrationOverwriteConfirm = (existingTargets: readonly URI[]) => boolean | Promise<boolean>;

interface IMigrationStagingFile {
	readonly relativePath: string;
	readonly bytes: VSBuffer;
}

/**
 * `fileService.copy` / `move` with `overwrite: true` deletes the target before the
 * write (`FileService.doMoveCopy`). Stage outside the target directory, then rename.
 */
export async function copyIfExists(fileService: IFileService, logService: ILogService, item: ICodeOssMigrationCopy): Promise<boolean> {
	if (!(await fileService.exists(item.source))) {
		return false;
	}

	const token = generateUuid();
	const outside = dirname(dirname(item.target));
	const stagingDir = joinPath(outside, `.ua-migration-staging-${token}`);
	const temp = joinPath(stagingDir, basename(item.target));
	const backup = joinPath(outside, `.ua-migration-backup-${token}`);
	if (isEqualOrParent(temp, item.target) || isEqualOrParent(temp, dirname(item.target))) {
		throw new Error(`[universeAgentMigration] refusing to stage inside ${item.target.toString()}`);
	}

	const targetExisted = await fileService.exists(item.target);
	let replaced = false;
	try {
		await fileService.copy(item.source, temp, false);
		const sourceFiles = await readStagingFiles(fileService, item.source);
		const tempFiles = await readStagingFiles(fileService, temp);
		if (!stagingFilesEqual(sourceFiles, tempFiles)) {
			throw new Error(`[universeAgentMigration] staging copy incomplete for ${item.source.toString()}`);
		}
		await replaceTargetFromStaging(fileService, temp, item.target, backup);
		replaced = true;
		logService.info(`[universeAgentMigration] copied ${item.source.toString()} -> ${item.target.toString()}`);
		return true;
	} finally {
		await deleteIfExists(fileService, stagingDir);
		if (replaced) {
			await deleteIfExists(fileService, backup);
		} else if (targetExisted && await fileService.exists(backup)) {
			try {
				if (await fileService.exists(item.target)) {
					await fileService.del(item.target, { recursive: true });
				}
				await fileService.move(backup, item.target, false);
			} catch (error) {
				logService.error(`[universeAgentMigration] could not restore ${item.target.toString()}`, error);
			}
		} else if (!targetExisted) {
			await deleteIfExists(fileService, item.target);
		}
	}
}

async function readStagingFiles(fileService: IFileService, resource: URI): Promise<IMigrationStagingFile[]> {
	const stat = await fileService.resolve(resource);
	if (!stat.isDirectory) {
		const content = await fileService.readFile(resource);
		return [{ relativePath: '', bytes: content.value }];
	}

	const files: IMigrationStagingFile[] = [];
	const walk = async (directory: URI, prefix: string): Promise<void> => {
		const current = await fileService.resolve(directory);
		for (const child of current.children ?? []) {
			const relativePath = prefix.length === 0 ? child.name : `${prefix}/${child.name}`;
			if (child.isDirectory) {
				await walk(child.resource, relativePath);
			} else {
				const content = await fileService.readFile(child.resource);
				files.push({ relativePath, bytes: content.value });
			}
		}
	};
	await walk(resource, '');
	files.sort((left, right) => left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0);
	return files;
}

function stagingFilesEqual(left: readonly IMigrationStagingFile[], right: readonly IMigrationStagingFile[]): boolean {
	if (left.length !== right.length) {
		return false;
	}
	for (let index = 0; index < left.length; index++) {
		if (left[index].relativePath !== right[index].relativePath || !left[index].bytes.equals(right[index].bytes)) {
			return false;
		}
	}
	return true;
}

async function replaceTargetFromStaging(fileService: IFileService, temp: URI, target: URI, backup: URI): Promise<void> {
	if (await fileService.exists(target)) {
		await fileService.move(target, backup, false);
	}
	await fileService.move(temp, target, false);
}

async function deleteIfExists(fileService: IFileService, resource: URI): Promise<void> {
	try {
		if (await fileService.exists(resource)) {
			await fileService.del(resource, { recursive: true });
		}
	} catch {
		// Staging cleanup must not hide the copy result or drop a backup that still holds the previous bytes.
	}
}

export async function copyProfileAllowList(fileService: IFileService, logService: ILogService, sourceProfileHome: URI, targetProfileHome: URI): Promise<number> {
	let copied = 0;

	for (const item of getProfileMigrationCopies(sourceProfileHome, targetProfileHome)) {
		if (await copyIfExists(fileService, logService, item)) {
			copied++;
		}
	}

	return copied;
}

interface IMigrationProfileHome {
	readonly source: URI;
	readonly target: URI;
}

async function listMigrationProfileHomes(fileService: IFileService, sourceUserData: URI, targetUserData: URI): Promise<IMigrationProfileHome[]> {
	const sourceUserHome = joinPath(sourceUserData, USER_FOLDER_NAME);
	const targetUserHome = joinPath(targetUserData, USER_FOLDER_NAME);
	const homes: IMigrationProfileHome[] = [{ source: sourceUserHome, target: targetUserHome }];

	const sourceProfilesHome = joinPath(sourceUserHome, PROFILES_FOLDER_NAME);
	if (!(await fileService.exists(sourceProfilesHome))) {
		return homes;
	}

	const stat = await fileService.resolve(sourceProfilesHome);
	for (const child of stat.children ?? []) {
		if (!child.isDirectory) {
			continue;
		}
		homes.push({
			source: child.resource,
			target: joinPath(targetUserHome, PROFILES_FOLDER_NAME, child.name),
		});
	}
	return homes;
}

/**
 * Allow-list targets this migration would overwrite, including named profiles.
 * Checking only the default `User/` folder is not enough.
 */
export async function findExistingMigrationTargets(fileService: IFileService, sourceUserData: URI, targetUserData: URI): Promise<URI[]> {
	const existing: URI[] = [];
	for (const home of await listMigrationProfileHomes(fileService, sourceUserData, targetUserData)) {
		for (const item of getProfileMigrationCopies(home.source, home.target)) {
			if (await fileService.exists(item.source) && await fileService.exists(item.target)) {
				existing.push(item.target);
			}
		}
	}
	return existing;
}

/**
 * Copies only settings.json, keybindings.json, and snippets/ from the default
 * profile and each named profile. Never copies globalStorage, state.vscdb, or
 * workspaceStorage. When any of those targets already exist, `confirmOverwrite`
 * must accept or nothing is copied.
 */
export async function migrateCodeOssUserData(fileService: IFileService, logService: ILogService, sourceUserData: URI, targetUserData: URI, confirmOverwrite?: CodeOssMigrationOverwriteConfirm): Promise<number> {
	const existingTargets = await findExistingMigrationTargets(fileService, sourceUserData, targetUserData);
	if (existingTargets.length > 0) {
		const confirmed = confirmOverwrite ? await confirmOverwrite(existingTargets) : false;
		if (!confirmed) {
			return 0;
		}
	}

	let copied = 0;
	for (const home of await listMigrationProfileHomes(fileService, sourceUserData, targetUserData)) {
		copied += await copyProfileAllowList(fileService, logService, home.source, home.target);
	}
	return copied;
}
