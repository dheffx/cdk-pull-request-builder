#!/usr/bin/env node
import "source-map-support/register";
import cdk = require("@aws-cdk/core");

import { CdkExampleStack } from './example-stack';

const app = new cdk.App();
new CdkExampleStack(app, "ExampleStack");