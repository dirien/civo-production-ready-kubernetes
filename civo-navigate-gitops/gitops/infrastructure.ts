import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as YAML from "yaml";
import * as fs from 'fs'
import {local} from "@pulumi/command";
import {Config, Output, provider} from "@pulumi/pulumi";
import {Service} from "../base/service";
import {moveFilesForService, CollectionArgs, BaseLayer} from "../base/baseLayer";


export class Infrastructure extends BaseLayer {
    constructor(name: string, args: CollectionArgs, opts?: pulumi.ComponentResourceOptions) {
        super(name, args, opts);

        const metricsServer = new Service("metrics-server", {
            namespaceName: "kube-system",
            chart: "metrics-server",
            chartVersion: "3.8.3",
            createNamespace: false,
            chartURL: "https://kubernetes-sigs.github.io/metrics-server/",
        }, {
            parent: this,
        })
        moveFilesForService(args, metricsServer, this, name);

        const autoscaler = new Service("autoscaler", {
            namespaceName: "kube-system",
            chart: "cluster-autoscaler",
            chartVersion: "9.23.0",
            createNamespace: false,
            chartURL: "https://kubernetes.github.io/autoscaler",
            values: {
                cloudProvider: "civo",
                autoscalingGroups: [
                    {
                        name: "workers",
                        minSize: 1,
                        maxSize: 5,
                    }
                ],
                image: {
                    tag: "v1.25.0",
                },
                extraArgs: {
                    "skip-nodes-with-local-storage": "false",
                    "skip-nodes-with-system-pods": "false",
                },
                extraEnvSecrets: {
                    CIVO_API_URL: {
                        name: "civo-api-access",
                        key: "api-url",
                    },
                    CIVO_API_KEY: {
                        name: "civo-api-access",
                        key: "api-key",
                    },
                    CIVO_CLUSTER_ID: {
                        name: "civo-api-access",
                        key: "cluster-id",
                    },
                    CIVO_REGION: {
                        name: "civo-api-access",
                        key: "region",
                    }
                },
                podDisruptionBudget: {},
            }
        }, {
            parent: this,
            dependsOn: [metricsServer]
        });
        moveFilesForService(args, autoscaler, this, name);


        const kustomize = pulumi.all([])
            .apply(() => {
                fs.mkdir(`${args.targetDir}/${name}`, {recursive: true}, (err) => {
                    fs.writeFileSync(`${args.targetDir}/${name}/kustomization.yaml`, YAML.stringify({
                            apiVersion: "kustomize.config.k8s.io/v1beta1",
                            kind: "Kustomization",

                            resources: [
                                `${autoscaler.serviceName}`,
                                `${metricsServer.serviceName}`,
                            ]
                        })
                    );
                });
            });
    }
}
