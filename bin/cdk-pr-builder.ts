#!/usr/bin/env node
import "source-map-support/register";
import cdk = require("@aws-cdk/core");
import { CdkPrBuilderStack } from "../impl/example-stack";

const app = new cdk.App();
new CdkPrBuilderStack(app, "ExampleStack");