import { App, Tags } from "aws-cdk-lib";
import { loadInfraConfig } from "./config.js";
import { AppStack } from "./stacks/app-stack.js";
import { SharedStack } from "./stacks/shared-stack.js";

const app = new App();
const config = loadInfraConfig();

const sharedStack = new SharedStack(app, `${config.stackPrefix}-shared`, {
  env: { account: config.account, region: config.region },
  config,
});

const appStack = new AppStack(app, `${config.stackPrefix}-app`, {
  env: { account: config.account, region: config.region },
  config,
  sharedResources: sharedStack.resources,
});
appStack.addDependency(sharedStack);

for (const stack of [sharedStack, appStack]) {
  for (const [key, value] of Object.entries(config.tags)) {
    Tags.of(stack).add(key, value);
  }
}
