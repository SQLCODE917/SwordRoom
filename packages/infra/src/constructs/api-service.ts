import { Duration, Stack } from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { InfraConfig } from "../config.js";

export interface ApiServiceProps {
  readonly config: InfraConfig;
  readonly gameStateTableName: string;
  readonly commandLogTableName: string;
  readonly commandsQueueUrl: string;
  readonly uploadsBucketName: string;
  readonly userPoolIssuerUrl: string;
  readonly userPoolClientId: string;
}

export class ApiService extends Construct {
  public readonly function: nodejs.NodejsFunction;
  public readonly httpApi: apigwv2.CfnApi;
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiServiceProps) {
    super(scope, id);

    this.function = new nodejs.NodejsFunction(this, "ApiLambda", {
      entry: `${props.config.repoRoot}/packages/services/api/src/lambda.ts`,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        target: "node20",
        sourceMap: true,
      },
      depsLockFilePath: `${props.config.repoRoot}/pnpm-lock.yaml`,
      projectRoot: props.config.repoRoot,
      environment: {
        GAMESTATE_TABLE: props.gameStateTableName,
        COMMANDLOG_TABLE: props.commandLogTableName,
        COMMANDS_QUEUE_URL: props.commandsQueueUrl,
        UPLOADS_BUCKET: props.uploadsBucketName,
        AUTH_MODE: "oidc",
        OIDC_ISSUER: props.userPoolIssuerUrl,
        OIDC_AUDIENCE: props.userPoolClientId,
      },
    });

    this.httpApi = new apigwv2.CfnApi(this, "HttpApi", {
      name: `${props.config.stackPrefix}-http-api`,
      protocolType: "HTTP",
      corsConfiguration: {
        allowCredentials: true,
        allowHeaders: ["authorization", "content-type"],
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowOrigins: [props.config.webOrigin],
        maxAge: 3600,
      },
    });

    const integration = new apigwv2.CfnIntegration(this, "LambdaIntegration", {
      apiId: this.httpApi.ref,
      integrationType: "AWS_PROXY",
      integrationUri: this.function.functionArn,
      integrationMethod: "POST",
      payloadFormatVersion: "2.0",
    });

    const authorizer = new apigwv2.CfnAuthorizer(this, "JwtAuthorizer", {
      apiId: this.httpApi.ref,
      authorizerType: "JWT",
      identitySource: ["$request.header.Authorization"],
      name: "jwt-authorizer",
      jwtConfiguration: {
        audience: [props.userPoolClientId],
        issuer: props.userPoolIssuerUrl,
      },
    });

    const rootRoute = new apigwv2.CfnRoute(this, "RootRoute", {
      apiId: this.httpApi.ref,
      routeKey: "ANY /",
      target: `integrations/${integration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    const proxyRoute = new apigwv2.CfnRoute(this, "ProxyRoute", {
      apiId: this.httpApi.ref,
      routeKey: "ANY /{proxy+}",
      target: `integrations/${integration.ref}`,
      authorizationType: "JWT",
      authorizerId: authorizer.ref,
    });

    const defaultStage = new apigwv2.CfnStage(this, "DefaultStage", {
      apiId: this.httpApi.ref,
      stageName: "$default",
      autoDeploy: true,
    });
    defaultStage.addDependency(rootRoute);
    defaultStage.addDependency(proxyRoute);

    this.function.addPermission("AllowHttpApiInvoke", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      sourceArn: `arn:${Stack.of(this).partition}:execute-api:${Stack.of(this).region}:${Stack.of(this).account}:${this.httpApi.ref}/*/*`,
    });

    this.apiUrl = `https://${this.httpApi.ref}.execute-api.${props.config.region}.${Stack.of(this).urlSuffix}`;
  }
}
