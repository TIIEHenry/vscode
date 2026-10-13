/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ITextResourcePropertiesService } from '../../../../editor/common/services/textResourceConfiguration.js';
import { OperatingSystem, OS } from '../../../../base/common/platform.js';
import { Schemas } from '../../../../base/common/network.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IRemoteAgentEnvironment } from '../../../../platform/remote/common/remoteAgentEnvironment.js';
import { IRemoteAgentService } from '../../remote/common/remoteAgentService.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';

export class TextResourcePropertiesService implements ITextResourcePropertiesService {

	declare readonly _serviceBrand: undefined;

	private _remoteEnvironment: IRemoteAgentEnvironment | null = null;
	/** True after a fulfilled read, including `null` (no remote environment). Rejection does not set this. */
	private remoteEnvironmentSettled = false;
	private remoteEnvironmentInflight = false;

	private get remoteEnvironment(): IRemoteAgentEnvironment | null {
		return this._remoteEnvironment;
	}

	private set remoteEnvironment(remoteEnv: IRemoteAgentEnvironment | null) {
		this._remoteEnvironment = remoteEnv;
		this.remoteEnvironmentSettled = true;
	}

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IRemoteAgentService private readonly remoteAgentService: IRemoteAgentService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@IStorageService private readonly storageService: IStorageService
	) {
		this.readRemoteEnvironment();
	}

	private readRemoteEnvironment(): void {
		if (this.remoteEnvironmentSettled || this.remoteEnvironmentInflight) {
			return;
		}

		const remoteAgentService = this.remoteAgentService;
		// Double catch fulfills on rejection, so the promise is dropped and is not a failure cache.
		this.releaseRemoteEnvironmentAttempt(remoteAgentService.getEnvironment().then(remoteEnv => this.remoteEnvironment = remoteEnv).catch(onUnexpectedError).catch(onUnexpectedError));
	}

	private releaseRemoteEnvironmentAttempt(swallowed: Promise<unknown>): void {
		this.remoteEnvironmentInflight = true;
		swallowed.then(() => {
			this.remoteEnvironmentInflight = false;
		}, () => {
			this.remoteEnvironmentInflight = false;
		});
	}

	getEOL(resource?: URI, language?: string): string {
		const eol = this.configurationService.getValue('files.eol', { overrideIdentifier: language, resource });
		if (eol && typeof eol === 'string' && eol !== 'auto') {
			return eol;
		}
		const os = this.getOS(resource);
		return os === OperatingSystem.Linux || os === OperatingSystem.Macintosh ? '\n' : '\r\n';
	}

	private getOS(resource?: URI): OperatingSystem {
		let os = OS;

		const remoteAuthority = this.environmentService.remoteAuthority;
		if (remoteAuthority) {
			if (resource && resource.scheme !== Schemas.file) {
				this.readRemoteEnvironment();
				const osCacheKey = `resource.authority.os.${remoteAuthority}`;
				os = this.remoteEnvironment ? this.remoteEnvironment.os : /* Get it from cache */ this.storageService.getNumber(osCacheKey, StorageScope.WORKSPACE, OS);
				this.storageService.store(osCacheKey, os, StorageScope.WORKSPACE, StorageTarget.MACHINE);
			}
		}

		return os;
	}
}

registerSingleton(ITextResourcePropertiesService, TextResourcePropertiesService, InstantiationType.Delayed);
