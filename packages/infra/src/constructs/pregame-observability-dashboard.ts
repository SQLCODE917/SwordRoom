import { Stack } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export interface PregameObservabilityDashboardProps {
  readonly stackPrefix: string;
  readonly apiFunctionName: string;
  readonly dispatcherFunctionName: string;
  readonly commandsDlqMetric: cloudwatch.IMetric;
  readonly apiErrorsMetric: cloudwatch.IMetric;
  readonly dispatcherErrorsMetric: cloudwatch.IMetric;
}

export class PregameObservabilityDashboard extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly dashboardUrl: string;

  constructor(scope: Construct, id: string, props: PregameObservabilityDashboardProps) {
    super(scope, id);

    const apiLogGroup = logs.LogGroup.fromLogGroupName(this, "ApiLogGroup", `/aws/lambda/${props.apiFunctionName}`);
    const dispatcherLogGroup = logs.LogGroup.fromLogGroupName(
      this,
      "DispatcherLogGroup",
      `/aws/lambda/${props.dispatcherFunctionName}`
    );

    this.dashboard = new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName: `${props.stackPrefix}-pregame-observability`,
    });

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Service Health",
        left: [props.apiErrorsMetric, props.dispatcherErrorsMetric, props.commandsDlqMetric],
        width: 12,
      }),
      new cloudwatch.LogQueryWidget({
        title: "Pregame Metric Totals",
        width: 12,
        logGroupNames: [apiLogGroup.logGroupName, dispatcherLogGroup.logGroupName],
        view: cloudwatch.LogQueryVisualizationType.TABLE,
        queryLines: [
          "fields metricName, metricValue",
          'filter event = "PREGAME_METRIC"',
          "stats sum(metricValue) as total by metricName",
          "sort total desc",
        ],
      }),
      new cloudwatch.LogQueryWidget({
        title: "Creator Sessions by Entry Source",
        width: 12,
        logGroupNames: [apiLogGroup.logGroupName],
        view: cloudwatch.LogQueryVisualizationType.BAR,
        queryLines: [
          "fields metricName, metricValue, metricDimensions.entrySource as entrySource",
          'filter event = "PREGAME_METRIC" and metricName = "CREATOR_SESSION_STARTED"',
          "stats sum(metricValue) as sessions by entrySource",
          "sort sessions desc",
        ],
      }),
      new cloudwatch.LogQueryWidget({
        title: "Draft Shares, Replies, and Reactions",
        width: 12,
        logGroupNames: [dispatcherLogGroup.logGroupName],
        view: cloudwatch.LogQueryVisualizationType.BAR,
        queryLines: [
          "fields metricName, metricValue",
          'filter event = "PREGAME_METRIC" and metricName in ["SHARED_CHARACTER_DRAFT_PUBLISHED","SHARED_CHARACTER_DRAFT_REPLY_PUBLISHED","SHARED_CHARACTER_DRAFT_REACTION_PUBLISHED"]',
          "stats sum(metricValue) as total by metricName",
          "sort total desc",
        ],
      }),
      new cloudwatch.LogQueryWidget({
        title: "GM Prompts vs Responses",
        width: 12,
        logGroupNames: [dispatcherLogGroup.logGroupName],
        view: cloudwatch.LogQueryVisualizationType.PIE,
        queryLines: [
          "fields metricName, metricValue",
          'filter event = "PREGAME_METRIC" and metricName in ["GM_PROMPT_PUBLISHED","GM_PROMPT_RESPONSE_PUBLISHED"]',
          "stats sum(metricValue) as total by metricName",
        ],
      }),
      new cloudwatch.LogQueryWidget({
        title: "Recent Pregame Trace Correlations",
        width: 12,
        logGroupNames: [apiLogGroup.logGroupName, dispatcherLogGroup.logGroupName],
        view: cloudwatch.LogQueryVisualizationType.TABLE,
        queryLines: [
          "fields @timestamp, svc, event, apiRequestId, clientSessionId, clientRequestId, commandId, metricName, errorCode",
          "filter ispresent(apiRequestId) or ispresent(clientSessionId)",
          "sort @timestamp desc",
          "limit 50",
        ],
      }),
      new cloudwatch.LogQueryWidget({
        title: "Recent Pregame Metric Events",
        width: 12,
        logGroupNames: [apiLogGroup.logGroupName, dispatcherLogGroup.logGroupName],
        view: cloudwatch.LogQueryVisualizationType.TABLE,
        queryLines: [
          "fields @timestamp, svc, metricName, metricDimensions.entrySource, metricDimensions.responseKind, metricContext.gameId, metricContext.characterId",
          'filter event = "PREGAME_METRIC"',
          "sort @timestamp desc",
          "limit 50",
        ],
      })
    );

    this.dashboardUrl = `https://${Stack.of(this).region}.console.aws.amazon.com/cloudwatch/home?region=${Stack.of(this).region}#dashboards:name=${this.dashboard.dashboardName}`;
  }
}
