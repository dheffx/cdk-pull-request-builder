import { expect as expectCDK, matchTemplate, MatchStyle } from "@aws-cdk/assert";
import cdk = require("@aws-cdk/core");
import ExampleStack = require("../impl/example-stack");

test("Empty Stack", () => {
    const app = new cdk.App();
    // WHEN
    const stack = new ExampleStack.CdkExampleStack(app, "MyTestStack");
    // THEN
    expectCDK(stack).to(matchTemplate({
      Resources: {}
    }, MatchStyle.EXACT));
});