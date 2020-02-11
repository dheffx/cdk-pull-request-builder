# CDK Pull Request Builder

This is a rewrite of https://github.com/dheffx/aws-pull-request-builder to use AWS CDK + Typescript + jsii + aws-delivlib.

## usage

This construct provides functionality for CodeCommit pull requests to start CodeBuild projects. State changes on the job will write comments back to the pull request, including logs and artifacts on failure.

By default, the construct will create an IAM service role for lambda. This is required for the enabled functions to execute. Optionally, you can provide a `lambdaRole` attribute which must be a `@aws-cdk/aws-iam.Role`.

The required default permissions are:

- codebuild:StartBuild
- codecommit:PostCommentOnPullRequest
- logs:GetLogEvents

If provided an argument of `enforceApproval`, a pull request approval will be approved if the build job succeeds, and rejected if it fails.

Using this feature also requires these permissions:

- codecommit:GetPullRequest
- codecommit:UpdatePullRequestApprovalState

If provided `buildFailureEmailSettings` of `sourceEmailParam`, the committer will be directly notified via email when the build fails. This is based on the git commit's email address.

Optionally you can provide a `notificationEmailParam` which will be CC'd on all emails sent.

Using this feature also requires these permissions:

- codecommit:GetCommit
- ses:SendEmail

### example

```typescript
repo = new codecommit.Repository(this, "Repository", {
    description: "Example project",
    repositoryName: "example-typescript-impl"
});

buildProject = new codebuild.Project(this, "TestBuildProject", {
    source: codebuild.Source.codeCommit({ repository: repo })
});

const sourceEmailParam = '/example-app/pull-request-builder/source-email';
const notificationEmailParam = '/example-app/pull-request-builder/notification-email';

new PullRequestBuilder(this, "PullRequestBuilder", {
    enforceApproval: true,
    project: buildProject,
    repo: repo,
    buildFailureEmailSettings: {
        sourceEmailParam,
        notificationEmailParam
    }
});
```

## dist

Currrently, this is distributed through Nuget, NPM, PyPi. Example implementations for Typescript and Python using this library can be found:
https://github.com/dheffx/cdk-pull-request-builder-impl

- typescript (npm): cdk-pull-request-builder
- dotnet (nuget): CdkPullRequestBuilder
- python (pypi) cdk-prb
    - Note: jsii will flatten camelCaseVariables into snake_case_variables in python

## build

## cdk package

```shell
npm run all
```

## cicd pipeline stack

```shell
cicd:deploy
```
