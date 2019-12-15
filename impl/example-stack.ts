import path = require("path");

import cdk = require("@aws-cdk/core");
import codebuild = require("@aws-cdk/aws-codebuild");
import codecommit = require("@aws-cdk/aws-codecommit");

import { PullRequestBuilder } from "../lib/pull-request-builder";

export class CdkPrBuilderStack extends cdk.Stack {
    private readonly projectName: string = "example-prb-impl";

    private appRepo: codecommit.Repository;
    private appTestBuildProject: codebuild.Project;

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.appRepo = new codecommit.Repository(this, "Repository", {
            description: "Example project",
            repositoryName: this.projectName
        });

        const buildSpecPath = path.join(__dirname, "../buildspecs/test_app.yml");

        this.appTestBuildProject = new codebuild.Project(this, "TestBuildProject", {
            buildSpec: codebuild.BuildSpec.fromSourceFilename(buildSpecPath),
            source: codebuild.Source.codeCommit({ repository: this.appRepo })
        });

        new PullRequestBuilder(this, "PullRequestBuilder", {
            enforceApproval: true,
            project: this.appTestBuildProject,
            repo: this.appRepo
        });
    }
}
