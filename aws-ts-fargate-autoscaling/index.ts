import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

import * as iam from "./iam"
import * as networking from "./networking";

const repo = new awsx.ecr.Repository("repo",{
    forceDelete: true
});

const image = new awsx.ecr.Image("app-image", {
    repositoryUrl: repo.url,
    path: "./app"
});

const logGroup = new aws.cloudwatch.LogGroup("fargate-loggroup");

const cluster = new aws.ecs.Cluster("fargate-autoscaling");

const appTd = new aws.ecs.TaskDefinition("appdemoTd", {
    family: "app-demo",
    cpu: "256",
    memory: "512",
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    executionRoleArn: iam.fargateRoleArn,
    taskRoleArn: iam.fargateRoleArn,
    containerDefinitions: pulumi.all([image.imageUri, logGroup.name]).apply(([imageUri, logGroupName]) => JSON.stringify([{
        name: "app",
        image: imageUri,
        portMappings: [{
            containerPort: 3000,
            protocol: "tcp",
        }],
        logConfiguration: {
            logDriver: "awslogs",
            options: {
                "awslogs-create-group": "true",
                "awslogs-group": logGroupName,
                "awslogs-region": "eu-west-1",
                "awslogs-stream-prefix": "app"
            }
        }
    }]))
});

const fargateService = new aws.ecs.Service("appdemoService", {
    cluster: cluster.arn,
    desiredCount: 1,
    launchType: "FARGATE",
    taskDefinition: appTd.arn,
    networkConfiguration: {
        assignPublicIp: true,
        subnets: networking.publicSubnetIds,
        securityGroups: [networking.taskSecurityGroupId]
    },
    loadBalancers: [{
        containerName: "app",
        containerPort: 3000,
        targetGroupArn: networking.targetGroupArn
    }],
    deploymentMaximumPercent: 200,
    deploymentMinimumHealthyPercent: 100
});

const autoScalingTarget = new aws.appautoscaling.Target("appScalingTarget", {
    maxCapacity: 5,
    minCapacity: 1,
    resourceId: pulumi.interpolate`service/${cluster.name}/${fargateService.name}`,
    scalableDimension: "ecs:service:DesiredCount",
    serviceNamespace: "ecs"
});

const memoryASPolicy = new aws.appautoscaling.Policy("memoryASPolicy", {
    policyType: "TargetTrackingScaling",
    resourceId: autoScalingTarget.resourceId,
    scalableDimension: autoScalingTarget.scalableDimension,
    serviceNamespace: autoScalingTarget.serviceNamespace,
    targetTrackingScalingPolicyConfiguration: {
        predefinedMetricSpecification: {
            predefinedMetricType: "ECSServiceAverageMemoryUtilization"
        },
        targetValue: 80
    }
});

const cpuASPolicy = new aws.appautoscaling.Policy("cpuASPolicy", {
    policyType: "TargetTrackingScaling",
    resourceId: autoScalingTarget.resourceId,
    scalableDimension: autoScalingTarget.scalableDimension,
    serviceNamespace: autoScalingTarget.serviceNamespace,
    targetTrackingScalingPolicyConfiguration: {
        predefinedMetricSpecification: {
            predefinedMetricType: "ECSServiceAverageCPUUtilization"
        },
        targetValue: 60
    }
});

export const lbDns = networking.lbDnsName;