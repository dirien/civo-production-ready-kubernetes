import * as pulumi from "@pulumi/pulumi";
import {Services} from "./gitops/services";
import {Infrastructure} from "./gitops/infrastructure";
import {FluxCD} from "./base/fluxCD";
import {BaseConfig} from "./gitops/baseconfig";

const stackReference = new pulumi.Config("infra").require("stackReference");

const infra = new pulumi.StackReference(stackReference);

const clusterKubeConfig = infra.getOutput("clusterKubeConfig");
const clusterName = infra.getOutput("clusterName");
const bucketUrl = infra.getOutput("bucketUrl");
const bucketAccessKeyId = infra.getOutput("bucketAccessKeyId");
const bucketSecretAccessKey = infra.getOutput("bucketSecretAccessKey");
const bucketName = infra.getOutput("bucketName");
const bucketRegion = infra.getOutput("bucketRegion");
const civoToken = process.env["CIVO_TOKEN"];
const dnsDomainName = infra.getOutput("dns");

const gitOpsConfig = new pulumi.Config("gitops");

// render Kubernetes manifests for deploying to the bucket
const gitOpsDir = gitOpsConfig.require("directory")

const services = new Services("services", {
    targetDir: gitOpsDir,
    token: civoToken,
    dnsDomainName: dnsDomainName,
    clusterName: clusterName,
})

const infrastructure = new Infrastructure("infrastructure", {
    targetDir: gitOpsDir,
    clusterName: clusterName,
})

const baseConfig = new BaseConfig("config", {
    targetDir: gitOpsDir,
    clusterName: clusterName,
})

new FluxCD("flux-cd", {
    clusterKubeConfig: clusterKubeConfig,
    bucketAccessKeyId: bucketAccessKeyId,
    bucketSecretAccessKey: bucketSecretAccessKey,
    bucketName: bucketName,
    bucketRegion: bucketRegion,
    bucketUrl: bucketUrl,
    gitOpsDirectories: [
        {
            gitOpsDirectory: infrastructure.name,
        },
        {
            gitOpsDirectory: services.name,
            dependsOnName: infrastructure.name,
        },
        {
            gitOpsDirectory: baseConfig.name,
            dependsOnName: services.name,
        }
    ],
})

