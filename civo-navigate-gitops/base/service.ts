import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as YAML from "yaml";
import * as fs from 'fs'

export interface ServiceArgs {
    chart: pulumi.Input<string>;
    chartVersion: pulumi.Input<string>;
    chartURL: pulumi.Input<string>;
    createNamespace: pulumi.Input<boolean>;
    namespaceName: pulumi.Input<string>;
    values?: pulumi.Input<any>;
    dependsOn?: pulumi.Input<any>;

    extraResources?: (service: Service) => void;
}


export class Service extends pulumi.ComponentResource {
    readonly serviceName: pulumi.Input<string>;
    readonly chartVersion: pulumi.Input<string>;
    readonly values: pulumi.Input<any>;
    readonly provider: pulumi.ProviderResource;
    readonly serviceArgs: ServiceArgs;

    constructor(name: string, args: ServiceArgs, opts?: pulumi.ComponentResourceOptions) {
        super(`services:index:${name}`, name, {}, opts);
        this.serviceArgs = args;
        this.provider = new k8s.Provider(`k8s-${name}`, {
            renderYamlToDirectory: `rendered/${name}`,
            enableServerSideApply: true
        }, {
            parent: this
        });

        if (args.createNamespace) {
            new k8s.core.v1.Namespace(`${name}-ns`, {
                metadata: {
                    name: args.namespaceName,
                },
            }, {
                parent: this,
                provider: this.provider,
                deleteBeforeReplace: true,
            });
        }

        const helmRepo = new k8s.apiextensions.CustomResource(`${name}-helm-repo`, {
            metadata: {
                name: `${name}-helm-repo`,
                namespace: args.namespaceName,
            },
            apiVersion: "source.toolkit.fluxcd.io/v1beta2",
            kind: "HelmRepository",
            spec: {
                interval: "1m0s",
                url: args.chartURL,
            },
        }, {
            parent: this,
            provider: this.provider,
            deleteBeforeReplace: true,
        })

        const helmRelease = new k8s.apiextensions.CustomResource(`${name}-helm-release`, {
            metadata: {
                name: `${name}-helm-release`,
                namespace: args.namespaceName,
            },
            apiVersion: "helm.toolkit.fluxcd.io/v2beta1",
            kind: "HelmRelease",
            spec: {
                releaseName: name,
                install: {
                    createNamespace: false,
                },
                targetNamespace: args.namespaceName,
                chart: {
                    spec: {
                        chart: args.chart,
                        sourceRef: {
                            kind: helmRepo.kind,
                            name: helmRepo.metadata.name,
                            namespace: args.namespaceName,
                        },
                        version: args.chartVersion,
                    }
                },
                dependsOn: args.dependsOn,
                values: args.values,
                interval: "10m0s",
            }
        }, {
            parent: this,
            provider: this.provider,
            deleteBeforeReplace: true,
        })
        args.extraResources?.(this);
        pulumi.all([args.namespaceName, helmRelease.metadata.name])
            .apply(([namespaceName]) => {
                let content: string;
                fs.readdir(`rendered/${name}/1-manifest/`, (_err, files) => {
                    let yamlFiles = files.filter(file => {
                        return file.endsWith('.yaml') && file !== 'kustomization.yaml';
                    });

                    content = YAML.stringify({
                        apiVersion: "kustomize.config.k8s.io/v1beta1",
                        kind: "Kustomization",

                        namespace: namespaceName,

                        resources: yamlFiles,
                    })
                    fs.writeFileSync(`rendered/${name}/1-manifest/kustomization.yaml`, content);
                });

            });

        this.serviceName = name;
        this.chartVersion = args.chartVersion;
        this.values = args.values;
        this.registerOutputs({
            serviceName: name,
            chartVersion: args.chartVersion,
            values: args.values,
        })
    }
}


