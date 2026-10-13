/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onUnexpectedError } from '../../../../base/common/errors.js';
import { IMcpGalleryManifest, IMcpGalleryManifestService, McpGalleryManifestStatus } from '../../../../platform/mcp/common/mcpGalleryManifest.js';
import { McpGalleryManifestService } from '../../../../platform/mcp/common/mcpGalleryManifestService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IRemoteAgentService } from '../../remote/common/remoteAgentService.js';
import { IRequestService } from '../../../../platform/request/common/request.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Emitter } from '../../../../base/common/event.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IMcpGalleryConfig, mcpGalleryServiceUrlConfig } from '../../../../platform/mcp/common/mcpManagement.js';

export class WorkbenchMcpGalleryManifestService extends McpGalleryManifestService implements IMcpGalleryManifestService {

	private mcpGalleryManifest: IMcpGalleryManifest | null = null;

	private _onDidChangeMcpGalleryManifest = this._register(new Emitter<IMcpGalleryManifest | null>());
	override readonly onDidChangeMcpGalleryManifest = this._onDidChangeMcpGalleryManifest.event;

	private _galleryChain: Promise<void> = Promise.resolve();

	private currentStatus: McpGalleryManifestStatus = McpGalleryManifestStatus.Unavailable;
	override get mcpGalleryManifestStatus(): McpGalleryManifestStatus { return this.currentStatus; }
	private _onDidChangeMcpGalleryManifestStatus = this._register(new Emitter<McpGalleryManifestStatus>());
	override readonly onDidChangeMcpGalleryManifestStatus = this._onDidChangeMcpGalleryManifestStatus.event;

	constructor(
		@IProductService productService: IProductService,
		@IRemoteAgentService remoteAgentService: IRemoteAgentService,
		@IRequestService requestService: IRequestService,
		@ILogService logService: ILogService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super(productService, requestService, logService);
		const remoteConnection = remoteAgentService.getConnection();
		if (remoteConnection) {
			const channel = remoteConnection.getChannel('mcpGalleryManifest');
			this.getMcpGalleryManifest().then(manifest => {
				channel.call('setMcpGalleryManifest', [manifest]);
				this._register(this.onDidChangeMcpGalleryManifest(manifest => channel.call('setMcpGalleryManifest', [manifest])));
			}).catch(onUnexpectedError).catch(onUnexpectedError);
		}
	}

	private initPromise: Promise<void> | undefined;
	private configurationListenerRegistered = false;

	override async getMcpGalleryManifest(): Promise<IMcpGalleryManifest | null> {
		if (!this.initPromise) {
			this.initPromise = this.startInit();
		}
		await this.initPromise;
		return this.mcpGalleryManifest;
	}

	private startInit(): Promise<void> {
		const pending: { promise?: Promise<void> } = {};
		// In-flight callers share this promise. Drop it when this attempt rejects
		// and it is still current, so the next read fetches again. Success stays cached.
		const promise = (async () => {
			try {
				await this.doGetMcpGalleryManifest();
			} catch (error) {
				if (this.initPromise === pending.promise) {
					this.initPromise = undefined;
				}
				throw error;
			}
		})();
		pending.promise = promise;
		return promise;
	}

	private async doGetMcpGalleryManifest(): Promise<void> {
		// Retries call doGet again. The listener must be attached even if the
		// fetch rejects, and a later attempt must not stack another one.
		if (!this.configurationListenerRegistered) {
			this.configurationListenerRegistered = true;
			this._register(this.configurationService.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration(mcpGalleryServiceUrlConfig) || e.affectsConfiguration('chat.mcp.gallery.version')) {
					this.getAndUpdateMcpGalleryManifest().catch(onUnexpectedError).catch(onUnexpectedError);
				}
			}));
		}

		await this.getAndUpdateMcpGalleryManifest();
	}

	private async getAndUpdateMcpGalleryManifest(): Promise<void> {
		const run = this._galleryChain.then(() => this.getAndUpdateMcpGalleryManifestNow());
		this._galleryChain = run.then(() => undefined, () => undefined);
		return run;
	}

	private async getAndUpdateMcpGalleryManifestNow(): Promise<void> {
		const mcpGalleryConfig = this.configurationService.getValue<IMcpGalleryConfig | undefined>('chat.mcp.gallery');
		if (mcpGalleryConfig?.serviceUrl) {
			this.update(await this.createMcpGalleryManifest(mcpGalleryConfig.serviceUrl, mcpGalleryConfig.version));
		} else {
			this.update(await super.getMcpGalleryManifest());
		}
	}

	private update(manifest: IMcpGalleryManifest | null): void {
		if (this.mcpGalleryManifest?.url === manifest?.url && this.mcpGalleryManifest?.version === manifest?.version) {
			return;
		}

		this.mcpGalleryManifest = manifest;
		if (this.mcpGalleryManifest) {
			this.logService.trace('MCP Registry configured:', this.mcpGalleryManifest.url);
		} else {
			this.logService.trace('No MCP Registry configured');
		}
		this.currentStatus = this.mcpGalleryManifest ? McpGalleryManifestStatus.Available : McpGalleryManifestStatus.Unavailable;
		this._onDidChangeMcpGalleryManifest.fire(this.mcpGalleryManifest);
		this._onDidChangeMcpGalleryManifestStatus.fire(this.currentStatus);
	}

}
