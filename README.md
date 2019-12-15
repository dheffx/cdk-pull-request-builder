# Welcome to your CDK TypeScript project!

This is a blank project for TypeScript development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

## How to build

For CDK Construct

```shell
npm run fn:lint
npm run fn:build
npm run lint
npm run build
npm run package
```

For Example Stack

```shell
npm run fn:lint
npm run fn:build
npm run lint
npm run build
cdk deploy
```

`fn:lint` and `fn:build` create the dist files for the three lambda handlers. these are assets used in the cdk build.

## Reasoning for bundling AWS-SDK - short term

NODE 12_X bundles 2.536.0 and approval templates were added in 2.576.0
maybe make layer later
