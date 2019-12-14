#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { CdkPrBuilderStack } from '../lib/cdk-pr-builder-stack';

const app = new cdk.App();
new CdkPrBuilderStack(app, 'CdkPrBuilderStack');
