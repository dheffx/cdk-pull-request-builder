import path = require('path');

import { Construct, Stack } from "@aws-cdk/core";
import { Project } from "@aws-cdk/aws-codebuild";
import { Repository } from "@aws-cdk/aws-codecommit";
import { LambdaFunction } from "@aws-cdk/aws-events-targets";
import {
    Effect, ManagedPolicy,
    PolicyStatement, Role, ServicePrincipal
} from "@aws-cdk/aws-iam";
import { Code, Function, Runtime } from "@aws-cdk/aws-lambda";

export interface PullRequestBuilderProps {
    readonly enforceApproval: boolean;
    readonly lambdaRole?: Role,
    readonly project: Project,
    readonly repo: Repository,
}

export class PullRequestBuilder extends Construct {
    private readonly handlersDir: string = 'handlers/dist';
    private serviceRole: Role;

    constructor(scope: Construct, id: string, props: PullRequestBuilderProps) {
        super(scope, id);

        this.serviceRole = props.lambdaRole || this.newServiceRole(props);

        this.startBuildOnPullRequestOpen(props.repo, props.project.projectName);
        this.postCommentOnBuildStateChange(props.project);

        if (props.enforceApproval) {
            this.approveOrRevokePullRequest(props.project);
        }
    }

    private newServiceRole(props: PullRequestBuilderProps): Role {
        const stack = Stack.of(this);
        const role = new Role(this, 'LambdaServiceRole', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('AWSLambdaBasicExecutionRole')
            ],
            roleName: `${props.repo.repositoryName}-prb-service-role`
        });

        const statements = [
            {
                actions: [
                    'codebuild:StartBuild'
                ],
                effect: Effect.ALLOW,
                resources: [ props.project.projectArn ]
            },
            {
                actions: [
                    'logs:GetLogEvents'
                ],
                effect: Effect.ALLOW,
                resources: [ `arn:aws:logs:${stack.region}:${stack.account}:*` ]
            },
            {
                actions: [
                    'codecommit:PostCommentForPullRequest'
                ],
                effect: Effect.ALLOW,
                resources: [ props.repo.repositoryArn ]
            }
        ];

        if (props.enforceApproval) {
            statements[2].actions.push('codecommit:UpdatePullRequestApprovalState');
        }

        statements.forEach((statement) => {
            role.addToPolicy(
                new PolicyStatement(statement)
            );
        });

        return role;
    }

    private startBuildOnPullRequestOpen(repo: Repository, projectName: string): void {
        const fn = new Function(this, 'StartBuildFunction', {
            code: Code.fromAsset(path.join(__dirname, this.handlersDir)),
            environment: {
                CODEBUILD_PROJECT_NAME: projectName
            },
            handler: 'start-build.handler',
            role: this.serviceRole,
            runtime: Runtime.NODEJS_10_X,
        });

        repo.onPullRequestStateChange('OnPullRequestCreate', {
            eventPattern: {
                detail: {
                    pullRequestStatus: [ 'Open']
                }
            },
            target: new LambdaFunction(fn)
        });
    }

    private postCommentOnBuildStateChange(project: Project): void {
        const fn = new Function(this, 'PostCommentFunction', {
            code: Code.fromAsset(path.join(__dirname, this.handlersDir)),
            handler: 'post-comment.handler',
            role: this.serviceRole,
            runtime: Runtime.NODEJS_10_X,
        });

        project.onStateChange('OnBuildStateChange', {
             target: new LambdaFunction(fn)
        });
    }

    private approveOrRevokePullRequest(project: Project): void {
        const fn = new Function(this, 'EnforceApprovalFunction', {
            code: Code.fromAsset(path.join(__dirname, this.handlersDir)),
            handler: 'enforce-approval.handler',
            role: this.serviceRole,
            runtime: Runtime.NODEJS_10_X,
        });
        const target = new LambdaFunction(fn);
        project.onBuildSucceeded('ApproveOnSuccess', {
             target: new LambdaFunction(fn)
        });
        project.onBuildFailed('RevokeOnFail', {
             target: new LambdaFunction(fn)
        });
    }
}
