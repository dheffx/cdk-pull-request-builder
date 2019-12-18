//
// This app manages the delivery pipeline for aws-delivlib itself. Very meta.
//
// To update the pipeline, you'll need AWS credentials for this account and
// then run:
//
//     npm run pipeline-update
//
// import codebuild = require('@aws-cdk/aws-codebuild');
import cdk = require('@aws-cdk/core');
import delivlib = require('../lib');

export class DelivLibPipelineStack extends cdk.Stack {
    // private readonly botEmail: string = 'name@bot.com'
    // private readonly botName: string = 'cdk-pull-request-builder-bot'
    // private readonly notificationEmail: string = 'dheff84@gmail.com'
    // private readonly repositoryName: string = "dheffx/cdk-pull-request-builder";
    // private readonly secretGithubToken: string = "cdk-pull-request-builder/github-token";
    // private readonly secretNpmToken: string = "cdk-pull-request-builder/npm-publishing-token";

    constructor(parent: cdk.App, id: string, props: cdk.StackProps = { }) {
        super(parent, id, props);

        const github = new delivlib.GitHubRepo({
            repository: 'dheffx/cdk-pull-request-builder',
            token: cdk.SecretValue.secretsManager('cdk-pull-request-builder/github-token'),
            // commitEmail: 'aws-cdk-dev+delivlib@amazon.com',
            // commitUsername: 'aws-cdk-dev',
            // sshKeySecret: { secretArn: 'arn:aws:secretsmanager:us-east-1:712950704752:secret:delivlib/github-ssh-lwzfjW' }
        });

        const pipeline = new delivlib.Pipeline(this, 'GitHubPipeline', {
            title: 'cdk-pull-request-builder production pipeline',
            repo: github,
            pipelineName: 'cdk-pull-request-builder',
            notificationEmail: 'dheff84@gmail.com'
        });

        pipeline.publishToNpm({
            // cdk-pull-request-builder/npm-publishing-token
            npmTokenSecret: { secretArn: 'arn:aws:secretsmanager:us-east-2:941006981671:secret:cdk-pull-request-builder/npm-publishing-token/v2-piuMVv' }
        });

        // pipeline.autoBump({
        //     bumpCommand: 'npm i && npm run bump',
        //     branch: 'master'
        // });
    }
}

const app = new cdk.App();

// this pipeline is mastered in a specific account where all the secrets are stored
new DelivLibPipelineStack(app, 'cdk-pull-request-builder-pipeline', {
  env: { region: 'us-east-2' }
});

app.synth();
