import cdk = require('@aws-cdk/core');
import delivlib = require('aws-delivlib/lib');

export class PipelineStack extends cdk.Stack {
    private readonly repositoryName: string = "dheffx/cdk-pull-request-builder";
    private readonly secretGithubToken: string = "cdk-pull-request-builder/github-token";
    private readonly secretNpmToken: string = "cdk-pull-request-builder/npm-publishing-token";

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const githubRepo = new delivlib.GitHubRepo({
            repository: this.repositoryName,
            token: cdk.SecretValue.secretsManager(this.secretGithubToken),
        });

        const pipeline = new delivlib.Pipeline(this, 'DeliveryPipeline', {
            repo: githubRepo
        });

        pipeline.addTest('TSLintAll', {
            platform: delivlib.ShellPlatform.LinuxUbuntu(),
            scriptDirectory: '../',
            entrypoint: 'npm run all:lint',
        });

        pipeline.publishToNpm({
            npmTokenSecret: { secretArn: 'arn:aws:secretsmanager:us-east-2:941006981671:secret:cdk-pull-request-builder/npm-publishing-token-kDKAmD' }
        });

        // pipeline.publishToNuGet({
        //     nugetApiKeySecret: { secretArn: 'my-nuget-token-secret-arn' }
        // });

        // pipeline.publishToMaven({
        //     mavenLoginSecret: { secretArn: 'my-maven-credentials-secret-arn' },
        //     signingKey: mavenSigningKey,
        //     stagingProfileId: '11a33451234521'
        // });

        // pipeline.publishToPyPi({
        //     loginSecret: { secretArn: 'my-pypi-credentials-secret-arn' }
        // });

        // pipeline.publishToGitHub({
        //     githubRepo: targetRepository,
        //     signingKey: releaseSigningKey
        // });

        // pipeline.publishToGitHubPages({
        //     githubRepo,
        //     sshKeySecret: { secretArn: 'github-ssh-key-secret-arn' },
        //     commitEmail: 'foo@bar.com',
        //     commitUsername: 'foobar',
        //     branch: 'gh-pages' // default
        // });
    }
}
