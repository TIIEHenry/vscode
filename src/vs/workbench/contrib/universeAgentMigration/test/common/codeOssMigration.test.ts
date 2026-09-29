/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { basename, dirname, isEqualOrParent, joinPath } from '../../../../../base/common/resources.js';
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

		const SOURCE_SETTINGS = '{"editor.fontSize":14}';
		const DEST_SETTINGS = '{"editor.fontSize":99}';
		const SOURCE_SNIPPET = '{"from":"source"}';
		const ONLY_DEST_SNIPPET = '{"only":"dest"}';
		const SOURCE_PROFILE = '{"window.zoomLevel":1}';
		const DEST_PROFILE = '{"window.zoomLevel":9}';

		function relativeUnder(root: URI, resource: URI): string {
			const prefix = root.path.endsWith('/') ? root.path : `${root.path}/`;
			assert.ok(resource.path.startsWith(prefix), `${resource.path} is not under ${root.path}`);
			return resource.path.slice(prefix.length);
		}

		async function readTree(fileService: FileService, resource: URI): Promise<Map<string, string>> {
			const stat = await fileService.resolve(resource);
			const files = new Map<string, string>();
			if (!stat.isDirectory) {
				files.set('', (await fileService.readFile(resource)).value.toString());
				return files;
			}
			const walk = async (uri: URI, prefix: string): Promise<void> => {
				const current = await fileService.resolve(uri);
				for (const child of current.children ?? []) {
					const relative = prefix ? `${prefix}/${child.name}` : child.name;
					if (child.isDirectory) {
						await walk(child.resource, relative);
					} else {
						files.set(relative, (await fileService.readFile(child.resource)).value.toString());
					}
				}
			};
			await walk(resource, '');
			return files;
		}

		function treesEqual(left: ReadonlyMap<string, string>, right: ReadonlyMap<string, string>): boolean {
			if (left.size !== right.size) {
				return false;
			}
			for (const [key, value] of left) {
				if (right.get(key) !== value) {
					return false;
				}
			}
			return true;
		}

		async function assertNoStaging(fileService: FileService, root: URI): Promise<void> {
			for (const path of await collectRelativePaths(fileService, root)) {
				assert.ok(!path.includes('.ua-migration-'), path);
			}
		}

		async function seedOverwriteFixture(fileService: FileService, source: URI, dest: URI, profileOnly: boolean): Promise<void> {
			const sourceUser = joinPath(source, 'User');
			const destUser = joinPath(dest, 'User');
			await writeFile(fileService, joinPath(sourceUser, 'settings.json'), SOURCE_SETTINGS);
			await writeFile(fileService, joinPath(sourceUser, 'snippets', 'from-source.json'), SOURCE_SNIPPET);
			await writeFile(fileService, joinPath(sourceUser, 'profiles', 'p1', 'settings.json'), SOURCE_PROFILE);
			if (!profileOnly) {
				await writeFile(fileService, joinPath(destUser, 'settings.json'), DEST_SETTINGS);
				await writeFile(fileService, joinPath(destUser, 'snippets', 'only-dest.json'), ONLY_DEST_SNIPPET);
			}
			await writeFile(fileService, joinPath(destUser, 'profiles', 'p1', 'settings.json'), DEST_PROFILE);
		}

		async function assertConflictBytesUnchanged(fileService: FileService, dest: URI): Promise<void> {
			assert.strictEqual((await fileService.readFile(joinPath(dest, 'User', 'settings.json'))).value.toString(), DEST_SETTINGS);
			assert.strictEqual((await fileService.readFile(joinPath(dest, 'User', 'snippets', 'only-dest.json'))).value.toString(), ONLY_DEST_SNIPPET);
			assert.strictEqual(await fileService.exists(joinPath(dest, 'User', 'snippets', 'from-source.json')), false);
			assert.strictEqual((await fileService.readFile(joinPath(dest, 'User', 'profiles', 'p1', 'settings.json'))).value.toString(), DEST_PROFILE);
			await assertNoStaging(fileService, dest);
		}

		class StagingProbeFileService extends FileService {
			readonly staged: string[] = [];
			failCopy = false;
			tempExistedBeforeThrow = false;

			constructor(
				private readonly sourceRoot: URI,
				private readonly destRoot: URI,
			) {
				super(new NullLogService());
			}

			override async copy(source: URI, target: URI, overwrite?: boolean) {
				assert.notStrictEqual(overwrite, true);
				const stat = await super.copy(source, target, overwrite);
				if (this.failCopy) {
					this.tempExistedBeforeThrow = await this.exists(target);
					throw new Error('temp copy failed');
				}
				await this.assertCompleteTemp(source, target);
				this.staged.push(relativeUnder(this.sourceRoot, source));
				return stat;
			}

			override async move(source: URI, target: URI, overwrite?: boolean) {
				assert.notStrictEqual(overwrite, true);
				return super.move(source, target, overwrite);
			}

			private async assertCompleteTemp(source: URI, temp: URI): Promise<void> {
				const relative = relativeUnder(this.sourceRoot, source);
				const finalTarget = joinPath(this.destRoot, ...relative.split('/'));
				assert.ok(temp.path.includes('.ua-migration-staging-'), temp.path);
				assert.strictEqual(isEqualOrParent(temp, finalTarget), false, temp.path);
				assert.strictEqual(isEqualOrParent(temp, dirname(finalTarget)), false, temp.path);
				assert.ok(treesEqual(await readTree(this, source), await readTree(this, temp)), relative);

				if (relative === 'User/settings.json') {
					assert.strictEqual((await this.readFile(joinPath(this.destRoot, 'User', 'settings.json'))).value.toString(), DEST_SETTINGS);
				} else if (relative === 'User/snippets') {
					assert.strictEqual((await this.readFile(joinPath(this.destRoot, 'User', 'snippets', 'only-dest.json'))).value.toString(), ONLY_DEST_SNIPPET);
					assert.strictEqual(await this.exists(joinPath(this.destRoot, 'User', 'snippets', 'from-source.json')), false);
				} else if (relative === 'User/profiles/p1/settings.json') {
					assert.strictEqual((await this.readFile(joinPath(this.destRoot, 'User', 'profiles', 'p1', 'settings.json'))).value.toString(), DEST_PROFILE);
				} else {
					assert.fail(`unexpected staging copy ${relative}`);
				}
			}
		}

		function createProbe(source: URI, dest: URI, failCopy = false): StagingProbeFileService {
			const fileService = store.add(new StagingProbeFileService(source, dest));
			fileService.failCopy = failCopy;
			store.add(fileService.registerProvider(ROOT.scheme, store.add(new InMemoryFileSystemProvider())));
			return fileService;
		}

		test('existing settings and a dest-only snippet stay unchanged until overwrite is confirmed', async () => {
			const source = joinPath(ROOT, 'code-oss-dev-conflict');
			const dest = joinPath(ROOT, 'universe-agent-studio-dev-conflict');
			const fileService = createFileService();
			const logService = new NullLogService();
			await seedOverwriteFixture(fileService, source, dest, false);

			const skipped = await migrateCodeOssUserData(fileService, logService, source, dest);
			assert.strictEqual(skipped, 0);
			await assertConflictBytesUnchanged(fileService, dest);

			let seen: readonly URI[] = [];
			const declined = await migrateCodeOssUserData(fileService, logService, source, dest, async targets => {
				seen = targets;
				return false;
			});
			assert.strictEqual(declined, 0);
			assert.ok(seen.some(uri => uri.path.endsWith('/User/settings.json') && !uri.path.includes('/profiles/')));
			assert.ok(seen.some(uri => uri.path.endsWith('/User/snippets')));
			assert.ok(seen.some(uri => uri.path.endsWith('/User/profiles/p1/settings.json')));
			await assertConflictBytesUnchanged(fileService, dest);
		});

		test('a named profile target blocks every copy when the default User files are absent', async () => {
			const source = joinPath(ROOT, 'code-oss-dev-profile-only');
			const dest = joinPath(ROOT, 'universe-agent-studio-dev-profile-only');
			const fileService = createFileService();
			await seedOverwriteFixture(fileService, source, dest, true);

			const copied = await migrateCodeOssUserData(fileService, new NullLogService(), source, dest);

			assert.strictEqual(copied, 0);
			assert.strictEqual(await fileService.exists(joinPath(dest, 'User', 'settings.json')), false);
			assert.strictEqual(await fileService.exists(joinPath(dest, 'User', 'snippets')), false);
			assert.strictEqual((await fileService.readFile(joinPath(dest, 'User', 'profiles', 'p1', 'settings.json'))).value.toString(), DEST_PROFILE);
			await assertNoStaging(fileService, dest);
		});

		test('confirmed overwrite stages a complete copy outside the target, then replaces snippets wholesale', async () => {
			const source = joinPath(ROOT, 'code-oss-dev-confirmed');
			const dest = joinPath(ROOT, 'universe-agent-studio-dev-confirmed');
			const fileService = createProbe(source, dest);
			await seedOverwriteFixture(fileService, source, dest, false);

			const copied = await migrateCodeOssUserData(fileService, new NullLogService(), source, dest, async () => true);

			assert.strictEqual(copied, 3);
			assert.deepStrictEqual(fileService.staged.slice().sort(), [
				'User/profiles/p1/settings.json',
				'User/settings.json',
				'User/snippets',
			]);
			assert.strictEqual((await fileService.readFile(joinPath(dest, 'User', 'settings.json'))).value.toString(), SOURCE_SETTINGS);
			assert.strictEqual((await fileService.readFile(joinPath(dest, 'User', 'snippets', 'from-source.json'))).value.toString(), SOURCE_SNIPPET);
			assert.strictEqual(await fileService.exists(joinPath(dest, 'User', 'snippets', 'only-dest.json')), false);
			assert.strictEqual((await fileService.readFile(joinPath(dest, 'User', 'profiles', 'p1', 'settings.json'))).value.toString(), SOURCE_PROFILE);
			await assertNoStaging(fileService, dest);
		});

		test('a failed staging copy leaves the original target bytes and removes the temp', async () => {
			const source = joinPath(ROOT, 'code-oss-dev-temp-fail');
			const dest = joinPath(ROOT, 'universe-agent-studio-dev-temp-fail');
			const fileService = createProbe(source, dest, true);
			await seedOverwriteFixture(fileService, source, dest, false);

			await assert.rejects(
				() => migrateCodeOssUserData(fileService, new NullLogService(), source, dest, async () => true),
				(error: Error) => error.message === 'temp copy failed',
			);

			assert.strictEqual(fileService.tempExistedBeforeThrow, true);
			assert.strictEqual(fileService.staged.length, 0);
			await assertConflictBytesUnchanged(fileService, dest);
		});
	});
});
