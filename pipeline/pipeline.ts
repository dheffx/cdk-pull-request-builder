import cdk = require('@aws-cdk/core');

#!/usr/bin/env node
import "source-map-support/register";
import cdk = require("@aws-cdk/core");

const app = new cdk.App();

import cdk = require("@aws-cdk/core");
import codebuild = require("@aws-cdk/aws-codebuild");
import codecommit = require("@aws-cdk/aws-codecommit");

export class DeliveryPipeline extends cdk.Stack {
    private readonly repositoryName: string = "example-prb-impl";

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        new delivlib.Pipeline(this, 'MyPipeline', {
            repo: new delivlib.GitHubRepo({
                repository: this.repositoryName,
                token: cdk.SecretValue.secretsManager('cdk-pull-request-builder/github-token'),
            });
        });

    }
}

