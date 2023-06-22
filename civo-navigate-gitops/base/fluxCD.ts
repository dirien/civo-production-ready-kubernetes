import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface KustomizationArgs {
    gitOpsDirectory: pulumi.Input<string>;
    dependsOnName?: pulumi.Input<string>;
}

export interface FluxCDArgs {
    clusterKubeConfig: pulumi.Input<string>;
    bucketAccessKeyId: pulumi.Input<string>;
    bucketSecretAccessKey: pulumi.Input<string>;
    bucketName: pulumi.Input<string>;
    bucketRegion: pulumi.Input<string>;
    bucketUrl: pulumi.Input<string>;
    gitOpsDirectories: KustomizationArgs[];
}

export class FluxCD extends pulumi.ComponentResource {
    constructor(name: string, args: FluxCDArgs, opts?: pulumi.ComponentResourceOptions) {
        super(`fluxcd:index:${name}`, name, {}, opts);

        const provider = new k8s.Provider("k8s", {
            kubeconfig: args.clusterKubeConfig,
        });

        const fluxNS = new k8s.core.v1.Namespace("flux", {
            metadata: {
                name: "flux-system",
            },
        }, {
            provider: provider
        });

        const flux = new k8s.helm.v3.Release("flux2", {
            name: "flux2",
            chart: "flux2",
            version: "2.7.0",
            namespace: fluxNS.metadata.name,
            repositoryOpts: {
                repo: "https://fluxcd-community.github.io/helm-charts"
            },
        }, {
            provider: provider
        })

        const bucketSecret = new k8s.core.v1.Secret("bucket-secret", {
            metadata: {
                name: "bucket-secret",
                namespace: fluxNS.metadata.name,
            },
            type: "Opaque",
            stringData: {
                "accesskey": args.bucketAccessKeyId,
                "secretkey": args.bucketSecretAccessKey,
            },
        }, {
            provider: provider,
            parent: flux
        });

        const bucketCR = new k8s.apiextensions.CustomResource("flux-bucket", {
                metadata: {
                    name: "flux-bucket",
                    namespace: fluxNS.metadata.name,
                },
                apiVersion: "source.toolkit.fluxcd.io/v1beta2",
                kind: "Bucket",
                spec: {
                    interval: "1m0s",
                    provider: "generic",
                    bucketName: args.bucketName,
                    endpoint: args.bucketUrl,
                    region: args.bucketRegion,
                    secretRef: {
                        name: bucketSecret.metadata.name
                    }
                },
            }, {
                provider: provider,
                parent: flux,
                dependsOn: [bucketSecret]
            }
        )

        for (const gitOpsDirectory of args.gitOpsDirectories) {
            new k8s.apiextensions.CustomResource(`demo-${gitOpsDirectory.gitOpsDirectory}`, {
                metadata: {
                    name: `demo-${gitOpsDirectory.gitOpsDirectory}`,
                    namespace: fluxNS.metadata.name,
                },
                apiVersion: "kustomize.toolkit.fluxcd.io/v1beta2",
                kind: "Kustomization",
                spec: {
                    interval: "1m0s",
                    path: `./${gitOpsDirectory.gitOpsDirectory}`,
                    prune: true,
                    sourceRef: {
                        kind: bucketCR.kind,
                        name: bucketCR.metadata.name,
                        namespace: fluxNS.metadata.name,
                    },
                    dependsOn: gitOpsDirectory.dependsOnName ? [
                        {
                            name: pulumi.interpolate`demo-${gitOpsDirectory.dependsOnName}`,
                            namespace: "flux-system"
                        }
                    ] : []
                },
            }, {
                provider: provider,
                parent: flux
            })
        }
    }
}
