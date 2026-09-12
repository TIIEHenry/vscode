/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { basename } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	getCodeOssUserDataFolderName,
	getProfileMigrationCopies,
	ICodeOssMigrationOfferInput,
	shouldOfferCodeOssMigration,
} from '../../common/codeOssMigration.js';

const EXCLUDED_PATH_FRAGMENTS = ['globalStorage', 'state.vscdb', 'workspaceStorage'] as const;
const ALLOWED_COPY_NAMES = ['settings.json', 'keybindings.json', 'snippets'] as const;

function offerInput(overrides: Partial<ICodeOssMigrationOfferInput> = {}): ICodeOssMigrationOfferInput {
	return {
		alreadyOffered: false,
		sourceExists: true,
		sourceEqualsDest: false,
		isNewApplication: true,
		hasDestSettingsJson: true,
		...overrides,
	};
}

function copyPathStrings(sourceProfileHome: URI, targetProfileHome: URI): string[] {
	const paths: string[] = [];
	for (const copy of getProfileMigrationCopies(sourceProfileHome, targetProfileHome)) {
		paths.push(copy.source.path, copy.target.path, copy.source.toString(), copy.target.toString());
	}
	return paths;
}

suite('codeOssMigration (I5 windowless contract)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suite('shouldOfferCodeOssMigration', () => {

		test('alreadyOffered gate is false even when the remaining offer cells would be true', () => {
			assert.strictEqual(shouldOfferCodeOssMigration(offerInput({ alreadyOffered: true })), false);
			assert.strictEqual(shouldOfferCodeOssMigration(offerInput({
				alreadyOffered: true,
				isNewApplication: false,
				hasDestSettingsJson: false,
			})), false);
		});

		test('!sourceExists gate is false even when the remaining offer cells would be true', () => {
			assert.strictEqual(shouldOfferCodeOssMigration(offerInput({ sourceExists: false })), false);
		});

		test('sourceEqualsDest gate is false even when the remaining offer cells would be true', () => {
			assert.strictEqual(shouldOfferCodeOssMigration(offerInput({ sourceEqualsDest: true })), false);
		});

		test('isNewApplication or !hasDestSettingsJson is true after the three false gates pass', () => {
			assert.strictEqual(shouldOfferCodeOssMigration(offerInput({
				isNewApplication: true,
				hasDestSettingsJson: true,
			})), true);
			assert.strictEqual(shouldOfferCodeOssMigration(offerInput({
				isNewApplication: true,
				hasDestSettingsJson: false,
			})), true);
			assert.strictEqual(shouldOfferCodeOssMigration(offerInput({
				isNewApplication: false,
				hasDestSettingsJson: false,
			})), true);
		});

		test('returning application with dest settings.json is false once the three false gates pass', () => {
			assert.strictEqual(shouldOfferCodeOssMigration(offerInput({
				isNewApplication: false,
				hasDestSettingsJson: true,
			})), false);
		});
	});

	suite('getProfileMigrationCopies', () => {

		test('allow-list is only settings.json, keybindings.json, and snippets', () => {
			const copies = getProfileMigrationCopies(
				URI.file('/tmp/code-oss-dev/User'),
				URI.file('/tmp/universe-agent-studio-dev/User'),
			);
			assert.deepStrictEqual(
				copies.map(copy => basename(copy.source)),
				[...ALLOWED_COPY_NAMES],
			);
			assert.deepStrictEqual(
				copies.map(copy => basename(copy.target)),
				[...ALLOWED_COPY_NAMES],
			);
		});

		test('path strings do not contain globalStorage, state.vscdb, or workspaceStorage', () => {
			const paths = copyPathStrings(
				URI.file('/tmp/code-oss-dev/User'),
				URI.file('/tmp/universe-agent-studio-dev/User'),
			);
			assert.ok(paths.length > 0);
			for (const path of paths) {
				for (const fragment of EXCLUDED_PATH_FRAGMENTS) {
					assert.ok(!path.includes(fragment), `${path} must not contain ${fragment}`);
				}
			}
		});
	});

	suite('getCodeOssUserDataFolderName', () => {

		test('dev (isBuilt=false) is code-oss-dev', () => {
			assert.strictEqual(getCodeOssUserDataFolderName(false), 'code-oss-dev');
		});

		test('release (isBuilt=true) is Code - OSS', () => {
			assert.strictEqual(getCodeOssUserDataFolderName(true), 'Code - OSS');
		});
	});
});
