/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { basename, joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { FileService } from '../../../../../platform/files/common/fileService.js';
import { InMemoryFileSystemProvider } from '../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import {
	getCodeOssUserDataFolderName,
	getDestSettingsResource,
	getProfileMigrationCopies,
	ICodeOssMigrationOfferInput,
	MIGRATE_FROM_CODE_OSS_COMMAND_ID,
	MIGRATION_OFFERED_STORAGE_KEY,
	migrateCodeOssUserData,
	resolveCodeOssUserDataUri,
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

	const store = ensureNoDisposablesAreLeakedInTestSuite();

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

	suite('resolveCodeOssUserDataUri', () => {

		test('dev sibling of dest folder is hard-coded code-oss-dev, not dest nameShort', () => {
			const resolved = resolveCodeOssUserDataUri(URI.file('/tmp/universe-agent-studio-dev'), false);
			assert.ok(resolved.path.endsWith('/code-oss-dev'), `${resolved.path} must end with /code-oss-dev`);
			assert.ok(
				!resolved.path.includes('universe-agent-studio-dev'),
				`${resolved.path} must not contain dest name universe-agent-studio-dev`,
			);
		});

		test('release sibling of dest folder is hard-coded Code - OSS', () => {
			const resolved = resolveCodeOssUserDataUri(URI.file('/tmp/UniverseAgentStudio'), true);
			assert.ok(resolved.path.endsWith('/Code - OSS'), `${resolved.path} must end with /Code - OSS`);
		});
	});

	suite('getDestSettingsResource', () => {

		test('dest settings.json is User/settings.json under current userData', () => {
			assert.strictEqual(
				getDestSettingsResource(URI.file('/tmp/universe-agent-studio-dev')).path,
				'/tmp/universe-agent-studio-dev/User/settings.json',
			);
		});
	});

	suite('MIGRATE_FROM_CODE_OSS_COMMAND_ID / MIGRATION_OFFERED_STORAGE_KEY', () => {

		test('command id is universeAgent.migrateFromCodeOss', () => {
			assert.strictEqual(MIGRATE_FROM_CODE_OSS_COMMAND_ID, 'universeAgent.migrateFromCodeOss');
		});

		test('offered storage key is universeAgent.migration.offered', () => {
			assert.strictEqual(MIGRATION_OFFERED_STORAGE_KEY, 'universeAgent.migration.offered');
		});
	});

	suite('migrateCodeOssUserData', () => {

		const ROOT = URI.file('tests').with({ scheme: 'vscode-tests' });

		function createFileService(): FileService {
			const fileService = store.add(new FileService(new NullLogService()));
			store.add(fileService.registerProvider(ROOT.scheme, store.add(new InMemoryFileSystemProvider())));
			return fileService;
		}

		async function writeFile(fileService: FileService, resource: URI, contents: string): Promise<void> {
			await fileService.writeFile(resource, VSBuffer.fromString(contents));
		}

		async function seedSourceUser(fileService: FileService, sourceUser: URI, includeDefaultKeybindings: boolean): Promise<void> {
			await writeFile(fileService, joinPath(sourceUser, 'settings.json'), '{"editor.fontSize":14}');
			if (includeDefaultKeybindings) {
				await writeFile(fileService, joinPath(sourceUser, 'keybindings.json'), '[]');
			}
			await writeFile(fileService, joinPath(sourceUser, 'snippets', 'x.json'), '{}');
			await writeFile(fileService, joinPath(sourceUser, 'profiles', 'p1', 'settings.json'), '{"window.zoomLevel":1}');
			await writeFile(fileService, joinPath(sourceUser, 'globalStorage', 'foo'), 'secret');
			await writeFile(fileService, joinPath(sourceUser, 'state.vscdb'), 'db');
			await writeFile(fileService, joinPath(sourceUser, 'workspaceStorage', 'ws'), 'ws-state');
		}

		async function collectRelativePaths(fileService: FileService, root: URI): Promise<string[]> {
			const paths: string[] = [];
			async function walk(uri: URI, prefix: string): Promise<void> {
				const stat = await fileService.resolve(uri);
				for (const child of stat.children ?? []) {
					const relative = prefix ? `${prefix}/${child.name}` : child.name;
					paths.push(relative);
					if (child.isDirectory) {
						await walk(child.resource, relative);
					}
				}
			}
			if (await fileService.exists(root)) {
				await walk(root, '');
			}
			return paths;
		}

		test('copies allow-list including named profile settings and skips excluded families', async () => {
			const fileService = createFileService();
			const logService = new NullLogService();
			const source = joinPath(ROOT, 'code-oss-dev');
			const dest = joinPath(ROOT, 'universe-agent-studio-dev');
			await seedSourceUser(fileService, joinPath(source, 'User'), true);

			const copied = await migrateCodeOssUserData(fileService, logService, source, dest);
			const destPaths = await collectRelativePaths(fileService, dest);

			assert.strictEqual(copied, 4);
			assert.ok(destPaths.includes('User/settings.json'));
			assert.ok(destPaths.includes('User/keybindings.json'));
			assert.ok(destPaths.includes('User/snippets/x.json'));
			assert.ok(destPaths.includes('User/profiles/p1/settings.json'));
			assert.strictEqual((await fileService.readFile(joinPath(dest, 'User', 'settings.json'))).value.toString(), '{"editor.fontSize":14}');
			assert.strictEqual((await fileService.readFile(joinPath(dest, 'User', 'profiles', 'p1', 'settings.json'))).value.toString(), '{"window.zoomLevel":1}');
			for (const path of destPaths) {
				for (const fragment of EXCLUDED_PATH_FRAGMENTS) {
					assert.ok(!path.includes(fragment), `${path} must not contain ${fragment}`);
				}
			}
			assert.strictEqual(await fileService.exists(joinPath(dest, 'User', 'globalStorage', 'foo')), false);
			assert.strictEqual(await fileService.exists(joinPath(dest, 'User', 'state.vscdb')), false);
			assert.strictEqual(await fileService.exists(joinPath(dest, 'User', 'workspaceStorage', 'ws')), false);
		});

		test('missing allow-list files are skipped and not counted', async () => {
			const fileService = createFileService();
			const logService = new NullLogService();
			const source = joinPath(ROOT, 'code-oss-dev-partial');
			const dest = joinPath(ROOT, 'universe-agent-studio-dev-partial');
			await seedSourceUser(fileService, joinPath(source, 'User'), false);

			const copied = await migrateCodeOssUserData(fileService, logService, source, dest);

			assert.strictEqual(copied, 3);
			assert.strictEqual(await fileService.exists(joinPath(dest, 'User', 'settings.json')), true);
			assert.strictEqual(await fileService.exists(joinPath(dest, 'User', 'keybindings.json')), false);
			assert.strictEqual(await fileService.exists(joinPath(dest, 'User', 'snippets', 'x.json')), true);
			assert.strictEqual(await fileService.exists(joinPath(dest, 'User', 'profiles', 'p1', 'settings.json')), true);
			assert.strictEqual(await fileService.exists(joinPath(dest, 'User', 'globalStorage', 'foo')), false);
			assert.strictEqual(await fileService.exists(joinPath(dest, 'User', 'state.vscdb')), false);
			assert.strictEqual(await fileService.exists(joinPath(dest, 'User', 'workspaceStorage', 'ws')), false);
		});
	});
});
