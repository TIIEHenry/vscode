/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { dirname, joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';

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
