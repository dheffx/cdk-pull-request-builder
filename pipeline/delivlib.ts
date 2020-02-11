import cdk = require('@aws-cdk/core');
import delivlib = require('aws-delivlib');

interface PipelineProps {
    pipelineName: string;
    repositoryName: string;
    notificationEmail: string;

    githubTokenSecret: string;

    npmTokenSecret: string;
    npmTokenARN: string;

    pyPiCredsSecret: string;
    pyPiCredsARN: string;

    nugetApiKeySecret: string;
    nugetApiKeyARN: string;
}

const app = new cdk.App();

const pp: PipelineProps = {
    pipelineName: app.node.tryGetContext('projectName'),
    notificationEmail: app.node.tryGetContext('notificationEmail'),
    repositoryName: app.node.tryGetContext('repositoryName'),

    githubTokenSecret: app.node.tryGetContext('githubTokenSecret'),

    npmTokenSecret: app.node.tryGetContext('npmTokenSecret'),
    npmTokenARN: app.node.tryGetContext('npmTokenARN'),

    pyPiCredsSecret: app.node.tryGetContext('pyPiCredsSecret'),
    pyPiCredsARN: app.node.tryGetContext('pyPiCredsARN'),

    nugetApiKeySecret: app.node.tryGetContext('nugetApiKeySecret'),
    nugetApiKeyARN: app.node.tryGetContext('nugetApiKeyARN')
};

export class DelivLibPipelineStack extends cdk.Stack {

    constructor(parent: cdk.App, id: string, props: cdk.StackProps = { }) {
        super(parent, id, props);

        const github = new delivlib.GitHubRepo({
            repository: pp.repositoryName,
            token: cdk.SecretValue.secretsManager(pp.githubTokenSecret)
        });

        const pipeline = new delivlib.Pipeline(this, 'GitHubPipeline', {
            title: `${pp.pipelineName} production pipeline`,
            repo: github,
            pipelineName: pp.pipelineName,
            notificationEmail: pp.notificationEmail
        });

        // pipeline.addTest('TSLintAll', {
        //     platform: delivlib.ShellPlatform.LinuxUbuntu,
        //     scriptDirectory: '../',
        //     entrypoint: 'npm run all:lint',
        // });

        pipeline.publishToNpm({
            npmTokenSecret: { secretArn: pp.npmTokenARN }
        });

        pipeline.publishToPyPI({
            loginSecret: { secretArn: pp.pyPiCredsARN }
        });

        pipeline.publishToNuGet({
            nugetApiKeySecret: { secretArn: pp.nugetApiKeyARN }
        });
    }
}

// this pipeline is mastered in a specific account where all the secrets are stored
new DelivLibPipelineStack(app, 'cdk-pull-request-builder-pipeline', {
  env: { region: 'us-east-2' }
});

app.synth();
