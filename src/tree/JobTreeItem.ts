/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IncomingMessage } from 'ms-rest';
import * as path from 'path';
import { gitHubWebResource } from 'vscode-azureappservice/out/src/github/connectToGitHub';
import { requestUtils } from 'vscode-azureappservice/out/src/utils/requestUtils';
import { AzExtParentTreeItem, AzExtTreeItem, IActionContext, openReadOnlyContent, TreeItemIconPath } from "vscode-azureextensionui";
import { githubApiEndpoint } from '../constants';
import { createGitHubRequestOptions, getRepoFullname } from '../utils/gitHubUtils';
import { localize } from '../utils/localize';
import { treeUtils } from "../utils/treeUtils";
import { ActionTreeItem } from './ActionTreeItem';
import { GitHubStep, StepTreeItem } from './StepTreeItem';

export type GitHubJob = {
    id: number;
    run_id: number;
    run_url: string;
    node_id: string;
    head_sha: string;
    url: string;
    html_url: string;
    status: string;
    conclusion: string;
    started_at: Date;
    completed_at: Date;
    name: string;
    steps: GitHubStep[];
    check_run_url: string;
};

export class JobTreeItem extends AzExtParentTreeItem {

    public static contextValue: string = 'azureStaticJob';
    public readonly contextValue: string = JobTreeItem.contextValue;
    public parent: ActionTreeItem;
    public data: GitHubJob;

    constructor(parent: ActionTreeItem, data: GitHubJob) {
        super(parent);
        this.data = data;
    }

    public get iconPath(): TreeItemIconPath {
        return this.data.conclusion ? treeUtils.getThemedIconPath(path.join('conclusions', this.data.conclusion)) : treeUtils.getThemedIconPath(path.join('statuses', this.data.status));
    }

    public get id(): string {
        return `${this.parent.parent.id}/${this.data.id}`;
    }

    public get name(): string {
        return this.data.name;
    }

    public get label(): string {
        return this.name;
    }

    public get description(): string {
        return this.data.conclusion;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean, _context: IActionContext): Promise<AzExtTreeItem[]> {
        return this.data.steps.map((step => {
            return new StepTreeItem(this, step);
        }));
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async refreshImpl(): Promise<void> {
        const gitHubRequest: gitHubWebResource = await createGitHubRequestOptions(undefined, this.data.url);
        const githubResponse: IncomingMessage & { body: string } = await requestUtils.sendRequest(gitHubRequest);
        this.data = <GitHubJob>JSON.parse(githubResponse.body);
    }

    public compareChildrenImpl(ti1: StepTreeItem, ti2: StepTreeItem): number {
        return ti1.data.number < ti2.data.number ? -1 : 1;
    }

    public async getLogs(): Promise<string> {
        const { owner, name } = getRepoFullname(this.parent.parent.repositoryUrl);
        const gitHubRequest: gitHubWebResource = await createGitHubRequestOptions(undefined, `${githubApiEndpoint}/repos/${owner}/${name}/actions/jobs/${this.data.id}/logs`);
        const githubResponse: IncomingMessage & { body: string } = await requestUtils.sendRequest(gitHubRequest);
        return githubResponse.body;
    }

    public async showLogs(): Promise<void> {
        await this.runWithTemporaryDescription(localize('loadingLogs', 'Loading Job logs...'), async (): Promise<void> => {
            await openReadOnlyContent(this, await this.getLogs(), '.log');
        });
    }
}
