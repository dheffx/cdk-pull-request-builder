import CodeBuild = require('aws-sdk/clients/codebuild');

const codebuild = new CodeBuild();

export const handler = async (event: any = {}): Promise<any> => {
    return codebuild.startBuild({
      projectName: process.env.CODEBUILD_PROJECT_NAME,
      sourceVersion: event.detail.sourceCommit,
      environmentVariablesOverride: [
        {
          name: 'CODECOMMIT_REPOSITORY_NAME',
          value: event.detail.repositoryNames[0],
          type: 'PLAINTEXT'
        },
        {
          name: 'CODECOMMIT_PULL_REQUEST_ID',
          value: event.detail.pullRequestId,
          type: 'PLAINTEXT'
        },
        {
          name: 'CODECOMMIT_SOURCE_COMMIT_ID',
          value: event.detail.sourceCommit,
          type: 'PLAINTEXT'
        },
        {
          name: 'CODECOMMIT_DESTINATION_COMMIT_ID',
          value: event.detail.destinationCommit,
          type: 'PLAINTEXT'
        }
      ]
    }).promise();
};
