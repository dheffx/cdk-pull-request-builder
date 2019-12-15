import CodeCommit = require('aws-sdk/clients/codecommit');
import { Context } from 'aws-lambda';
import { getBuildEnvironment, isFailedBuild } from './common';

const codecommit = new CodeCommit();

export const handler = async (event: any = {}, context: Context): Promise<any> => {
    const buildenv = getBuildEnvironment(event.detail['additional-information'].environment['environment-variables']);

    return new Promise((resolve, reject) => {
        if (!buildenv.CODECOMMIT_PULL_REQUEST_ID) {
            reject("Not a pull request build");
            return;
        }
        resolve();
    }).then((comment: string) => {
        return codecommit.updatePullRequestApprovalState({
            approvalState: isFailedBuild(event.detail['build-status']) ?
                'REVOKE' : 'APPROVE',
            pullRequestId: buildenv.CODECOMMIT_PULL_REQUEST_ID,
            revisionId: buildenv.CODECOMMIT_SOURCE_COMMIT_ID
        }).promise();
    });
};
