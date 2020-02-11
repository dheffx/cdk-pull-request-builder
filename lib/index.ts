import path = require('path');

import { Construct, Stack } from "@aws-cdk/core";
import { Project } from "@aws-cdk/aws-codebuild";
import { Repository } from "@aws-cdk/aws-codecommit";
import { Rule } from "@aws-cdk/aws-events";
import { LambdaFunction } from "@aws-cdk/aws-events-targets";
import {
    Effect, ManagedPolicy,
    PolicyStatement, PolicyStatementProps,
    Role, ServicePrincipal
} from "@aws-cdk/aws-iam";
import { Code, Function, LayerVersion, Runtime } from "@aws-cdk/aws-lambda";

export interface BuildFailureEmailProps {
    readonly sourceEmailParam: string;
    readonly notificationEmailParam?: string;
}

export interface CommonFunctionProps {
    readonly code: Code;
    readonly runtime: Runtime;
    readonly role: Role;
}

export interface PullRequestBuilderProps {
    readonly enforceApproval: boolean;
    readonly buildFailureEmailSettings?: BuildFailureEmailProps;
    readonly lambdaRole?: Role;
    readonly project: Project;
    readonly repo: Repository;
}

/**
 * CDK PullRequestBuilder
 *
 * Implements an event-driven workflow using
 * CodeBuild, CodeCommit, CloudWatchEvents,
 * CloudWatchLogs, and Lambda to achieve a basic
 * automated test cycle for pull requests.
 *
 * CodeBuild is started when a pull request is opened
 * or updated. The PR is updated with comments as
 * the build changes its state.
 *
 * Optionally, the job can enforce an approval rule on
 * the PR by configuring PullRequestBuilderProps.enforceApproval
 */
export class PullRequestBuilder extends Construct {
    private readonly handlersDir: string = 'handlers';
    private readonly layersDir: string = 'layers';

    private repo: Repository;
    private project: Project;
    private serviceRole: Role;
    private commonFunctionProps: CommonFunctionProps;
    private isExternalRole: boolean = false;
    private cloudwatchEvents: { [ key: string]: Rule } = {};

    constructor(scope: Construct, id: string, props: PullRequestBuilderProps) {
        super(scope, id);

        this.repo = props.repo;
        this.project = props.project;
        this.isExternalRole = !!props.lambdaRole;

        const stack = Stack.of(this);
        this.serviceRole = props.lambdaRole || this.newServiceRole();
        this.setCloudWatchEvents();

        this.commonFunctionProps = {
            code: Code.fromAsset(path.join(__dirname, this.handlersDir)),
            role: this.serviceRole,
            runtime: Runtime.NODEJS_12_X
        };

        this.startBuildOnPullRequestOpen();
        this.postCommentOnBuildStateChange(stack);

        if (props.buildFailureEmailSettings) {
            this.notifyCommitterByEmailOnBuildFailed(props.buildFailureEmailSettings, stack);
        }

        if (props.enforceApproval) {
            this.enforceApprovalOnPullRequest(stack);
        }
    }

    /**
     * Creates CloudWatch Events on the CodeBuild project
     * and CodeCommit pull requests
     */
    private setCloudWatchEvents(): void {
        this.cloudwatchEvents.onPullRequestOpen =
            this.repo.onPullRequestStateChange('OnPullRequestCreate', {
                eventPattern: {
                    detail: {
                        pullRequestStatus: [ 'Open']
                    }
                }
            }
        );

        this.cloudwatchEvents.onBuildStateChange =
            this.project.onStateChange('OnBuildStateChange');

        this.cloudwatchEvents.onBuildSucceeded =
            this.project.onBuildSucceeded('OnBuildSucceeded');
        this.cloudwatchEvents.onBuildFailed =
            this.project.onBuildFailed('OnBuildFailed');
    }

    /**
     *   Creates a cdk.iam.Role and policies for
     *   the Lambda functions to use.
     *
     *   Requires permissions:
     *   - codebuild:StartBuild
     *   - codecommit:GetCommit
     *   - codecommit:PostCommentOnPullRequest
     *   - logs:GetLogEvents
     *   - ses:SendEmail
     *
     *   If props.enforceApproval is true:
     *   - codecommit:GetPullRequest
     *   - codecommit:UpdatePullRequestApprovalState
     *
     */
    private newServiceRole(stack?: Stack): Role {
        stack = stack || Stack.of(this);

        const role = new Role(this, 'LambdaServiceRole', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                ManagedPolicy.fromAwsManagedPolicyName('AWSXrayWriteOnlyAccess')
            ],
            roleName: `${this.repo.repositoryName}-prb-service-role`
        });
        return role;
    }

    /**
     * Appends the class'es serviceRole with a passed in policy
     *
     * This no-ops if using an external IAM role for the service.
     */
    private appendServiceRole(statements: PolicyStatementProps[]): void {
        if (this.isExternalRole) {
            return;
        }
        statements.forEach((statement) => {
            this.serviceRole.addToPolicy(
                new PolicyStatement(statement)
            );
        });
    }

    /**
     * Sets up a CloudWatchEvent to invoke a Lambda function
     * when a pull request is created in a CodeCommit repository.
     * The lambda function will then start a CodeBuild job
     * and supply data about the pull request as environment variables.
     *
     * This function intentionally does not use tryFindChild since each
     * project needs its own function, since there is no way for
     * the Lambda function to know which CodeBuild job to start from the
     * CodeCommit pull request without setting it as an environment
     * variable in the function
     *
     */
    private startBuildOnPullRequestOpen(): void {
        const fn = new Function(this, 'StartBuildFunction', {
            ...this.commonFunctionProps,
            ...{
                environment: {
                    CODEBUILD_PROJECT_NAME: this.project.projectName
                },
                functionName: `PullRequestBuilder-StartBuild-${this.project.projectName}`,
                handler: 'start-build.handler',
            }
        });

        this.cloudwatchEvents.onPullRequestOpen.addTarget(new LambdaFunction(fn));

        this.appendServiceRole([
            {
                actions: [
                    'codebuild:StartBuild'
                ],
                effect: Effect.ALLOW,
                resources: [ this.project.projectArn ]
            }
        ]);
    }

    /**
     * Sets up a CloudWatch Event that invokes a Lambda function
     * when a CodeBuild job changes its state. The function
     * will read the build's environment variables to determine
     * the pull request, and then post a comment on it with information
     * regarding the build and its status
     *
     * @param stack? cdk.Stack
     * The stack to check if function already exists
     */
    private postCommentOnBuildStateChange(stack?: Stack): void {
        stack = stack || Stack.of(this);

        const uid = 'PostCommentFunction';
        // tslint:disable-next-line:ban-types
        const fn = stack.node.tryFindChild(uid) as Function ||
            new Function(this, uid, {
                ...this.commonFunctionProps,
                ...{
                    functionName: 'PullRequestBuilder-PostComment',
                    handler: 'post-comment.handler'
                }
            });

        this.cloudwatchEvents.onBuildStateChange.addTarget(new LambdaFunction(fn));

        this.appendServiceRole([
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
                resources: [ this.repo.repositoryArn ]
            }
        ]);
    }

    /**
     * Sets up a CloudWatchEvent to invoke a Lambda function
     * when a CodeBuild project suceeds or fails
     *
     * The function will approve or revoke the pull request based
     * on the build status
     *
     * @param stack? cdk.Stack
     * The stack to check if function already exists
     */
    private enforceApprovalOnPullRequest(stack?: Stack): void {
        stack = stack || Stack.of(this);

        const layerUid = 'UpdatedAwsSdkLayer';
        const updatedAwsSdkLayer = stack.node.tryFindChild(layerUid) as LayerVersion ||
            new LayerVersion(this, layerUid, {
                code: Code.fromAsset(path.join(__dirname, this.layersDir)),
                compatibleRuntimes: [
                    this.commonFunctionProps.runtime
                ],
                description: "NodeJS 12_X layer that includes newer AWS SDK (for Approval Template support)",
                layerVersionName: "nodejs12x-updated-sdk"
            });

        const fnUid = 'EnforceApprovalFunction';
        // tslint:disable-next-line:ban-types
        const fn = stack.node.tryFindChild(fnUid) as Function ||
            new Function(this, fnUid, {
                ...this.commonFunctionProps,
                ...{
                    functionName: 'PullRequestBuilder-EnforceApproval',
                    handler: 'enforce-approval.handler',
                    layers: [ updatedAwsSdkLayer ]
                }
            });

        const target = new LambdaFunction(fn);
        this.cloudwatchEvents.onBuildSucceeded.addTarget(target);
        this.cloudwatchEvents.onBuildFailed.addTarget(target);

        this.appendServiceRole([
            {
                actions: [
                    'codecommit:GetPullRequest',
                    'codecommit:UpdatePullRequestApprovalState'
                ],
                effect: Effect.ALLOW,
                resources: [ this.repo.repositoryArn ]
            }
        ]);
    }

    /**
     * When the CodeBuild job fails, email the
     * person who opened the pull request
     *
     * Conditionally CC a configured email address on all failures
     *
     * @param emailSettings? BuildFailureEmailProps
     * @param stack? cdk.Stack
     * The stack to check if function already exists
     */
    private notifyCommitterByEmailOnBuildFailed(emailSettings: BuildFailureEmailProps, stack?: Stack): void {
        stack = stack || Stack.of(this);

        const environment: { [k: string]: string } = {
            SOURCE_EMAIL_ADDR_PARAM: emailSettings.sourceEmailParam,
        };
        if (emailSettings.notificationEmailParam) {
            environment.CC_EMAIL_ADDR_PARAM = emailSettings.notificationEmailParam;
        }

        const fnUid = 'NotifyByEmailOnBuildFailureFunction';
        // tslint:disable-next-line:ban-types
        const fn = stack.node.tryFindChild(fnUid) as Function ||
            new Function(this, fnUid, {
                ...this.commonFunctionProps,
                ...{
                    environment,
                    functionName: 'PullRequestBuilder-NotifyCommitterByEmailFunction',
                    handler: 'notify-committer.handler',
                }
            });

        this.cloudwatchEvents.onBuildFailed.addTarget(new LambdaFunction(fn));

        this.appendServiceRole([
            {
                actions: [
                    'codecommit:GetCommit',
                ],
                effect: Effect.ALLOW,
                resources: [ this.repo.repositoryArn ]
            },
            {
                actions: [
                    'ses:SendEmail',
                ],
                effect: Effect.ALLOW
            }
        ]);
    }
}
