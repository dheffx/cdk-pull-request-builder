/* tslint:disable:no-console */
import CodeCommit = require('aws-sdk/clients/codecommit');
import SES = require('aws-sdk/clients/ses');
import SSM = require('aws-sdk/clients/ssm');

import { Context } from 'aws-lambda';
import { getBuildEnvironment, getBuildJobUrl } from './common';

const codecommit = new CodeCommit();
const ses = new SES();
const ssm = new SSM();

interface SsmParams {
    SOURCE_EMAIL?: string,
    CC_EMAIL?: string
}

const getSsmParams = async (source: string, cc?: string) => {
    console.log(`Fetching SSM params (source: ${source}), (cc: ${cc})`);
    const paramNames = [source];
    if (cc) {
        paramNames.push(cc);
    }

    const resp =  await ssm.getParameters({
        Names: paramNames,
        WithDecryption: true
    }).promise();

    const paramMap: SsmParams = {};
    resp.Parameters.forEach((param) => {
        if (param.Name === source) {
            paramMap.SOURCE_EMAIL = param.Value;
        } else if (cc && param.Name === cc) {
            paramMap.CC_EMAIL = param.Value;
        }
    });
    return paramMap;
};

const ssmParams = getSsmParams(
    process.env.SOURCE_EMAIL_ADDR_PARAM,
    process.env.CC_EMAIL_ADDR_PARAM
) as SsmParams;

if (!ssmParams.SOURCE_EMAIL) {
    throw new Error("Could not retrieve source email address, unable to use SES without it");
}

export const handler = async (event: any = {}, context: Context): Promise<any> => {
    const buildenv = getBuildEnvironment(event.detail['additional-information'].environment['environment-variables']);
    if (!buildenv.CODECOMMIT_PULL_REQUEST_ID) {
        throw new Error("Not a pull request build");
    }
    console.log(`Processing request for pull request ${buildenv.CODECOMMIT_PULL_REQUEST_ID} on ${buildenv.CODECOMMIT_SOURCE_COMMIT_ID}`);
    return codecommit.getCommit({
        commitId: buildenv.CODECOMMIT_SOURCE_COMMIT_ID,
        repositoryName: buildenv.CODECOMMIT_REPOSITORY_NAME
    }).promise()
        .then((resp) => {
            const emailAddr = resp.commit.committer.email;
            const userName = resp.commit.committer.name;
            console.log(`Notifying ${userName} at ${emailAddr}`);

            const subject =  `Build failed on pull request ${buildenv.CODECOMMIT_PULL_REQUEST_ID}`;
            const url = getBuildJobUrl(event.detail['build-id']);
            const message = `Hey ${userName},

            Bad news! A build for ${buildenv.CODECOMMIT_REPOSITORY_NAME} has failed!

            Source Commit: ${resp.commit.commitId}

            ${resp.commit.message}

            ${url}
            `;

            return ses.sendEmail({
                Source: ssmParams.SOURCE_EMAIL,
                Destination: {
                    ToAddresses: [
                        emailAddr,
                    ],
                    CcAddresses: [ ssmParams.CC_EMAIL ],
                },
                Message: {
                    Body: {
                        Text: {
                            Data: message
                        }
                    },
                    Subject: {
                        Data: subject
                    }
                }
            }).promise();
        });
};