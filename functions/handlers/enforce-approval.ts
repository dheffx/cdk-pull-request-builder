/* tslint:disable:no-console */
import CodeCommit = require('aws-sdk/clients/codecommit');
import { Context } from 'aws-lambda';
import { getBuildEnvironment, isFailedBuild } from './common';

const codecommit = new CodeCommit();

export const handler = async (event: any = {}, context: Context): Promise<any> => {
    const buildenv = getBuildEnvironment(event.detail['additional-information'].environment['environment-variables']);
    console.log(buildenv);

    if (!buildenv.CODECOMMIT_PULL_REQUEST_ID) {
        throw new Error("Not a pull request build");
        return;
    }
    return codecommit.getPullRequest({
        pullRequestId: buildenv.CODECOMMIT_PULL_REQUEST_ID,
    }).promise()
        .then((resp) => {
            const revisionId = resp.pullRequest.revisionId;
            return codecommit.updatePullRequestApprovalState({
                approvalState: isFailedBuild(event.detail['build-status']) ?
                    'REVOKE' : 'APPROVE',
                pullRequestId: buildenv.CODECOMMIT_PULL_REQUEST_ID,
                revisionId
            }).promise();
        });
};
