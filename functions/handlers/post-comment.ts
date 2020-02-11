/* tslint:disable:no-console */
import CloudWatchLogs = require('aws-sdk/clients/cloudwatchlogs');
import CodeCommit = require('aws-sdk/clients/codecommit');

import { getBuildEnvironment, getBuildJobUrl, isFailedBuild } from './common';

const cloudwatchlogs = new CloudWatchLogs();
const codecommit = new CodeCommit();

export const handler = async (event: any = {}): Promise<any> => {
    const requestToken = event.detail['build-id'] + event.detail['build-status'];
    const buildenv = getBuildEnvironment(event.detail['additional-information'].environment['environment-variables']);
    return new Promise((resolve, reject) => {
        if (!buildenv.CODECOMMIT_PULL_REQUEST_ID) {
            reject("Not a pull request build");
            return;
        }
        resolve(createComment(event.detail, buildenv));
    }).then((comment: string) => {
        return codecommit.postCommentForPullRequest({
            afterCommitId: buildenv.CODECOMMIT_DESTINATION_COMMIT_ID,
            beforeCommitId: buildenv.CODECOMMIT_SOURCE_COMMIT_ID,
            clientRequestToken: requestToken,
            content: comment,
            pullRequestId: buildenv.CODECOMMIT_PULL_REQUEST_ID,
            repositoryName: buildenv.CODECOMMIT_REPOSITORY_NAME
        }).promise();
    });
};

async function createComment(detail, buildenv) {
  const buildStatus = detail['build-status'];
  const url = getBuildJobUrl(detail['build-id']);
  let comment = `# Pull Request Builder\n\n**${buildStatus}**\n\n${url}\n\nSource Commit: ${buildenv.CODECOMMIT_SOURCE_COMMIT_ID}`;
  const logs = detail['additional-information'].logs;
  const artifact = detail['additional-information'].artifact;
  try {
    if (isFailedBuild(buildStatus) && logs) {
        comment += "\n\nYou must resolve the issue before the branch can be merged.\n\n";
        const rawEvents = await getLogEvents(logs['group-name'], logs['stream-name']);
        const logLines  = rawEvents.events.map(event => event.message).join("");
        comment += "\n```\n" + logLines + "\n```\n";
    }
    if (buildStatus !== 'IN_PROGRESS' && hasS3Artifact(artifact)) {
      comment += "\n\n## Results\n\nArtifact: " + getArtifactUrl(artifact);
    }
  } catch (e) {
    comment += `Error creating comment text:\n${e.message}\n\n${e.stack}`;
  }
  return comment;
}

const getLogEvents = (groupName: string, streamName: string) => {
  return cloudwatchlogs.getLogEvents({
    logGroupName: groupName,
    logStreamName: streamName,
    limit: 30,
    startFromHead: false
  }).promise();
};

const getS3Artifact = (artifact): string => {
    return artifact.location.split(':')[5];
};

const hasS3Artifact = (artifact): boolean => {
    return artifact.location.substr(0, 10) === 'arn:aws:s3';
};

const getArtifactUrl = (artifact) => {
    const s3Artifact = getS3Artifact(artifact);
    return `https://s3.console.aws.amazon.com/s3/buckets/${s3Artifact}/?region=${process.env.AWS_REGION}&tab=overview`;
};
