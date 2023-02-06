import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as YAML from "yaml";
import * as fs from 'fs'
import {local} from "@pulumi/command";
import {Config, Output, provider} from "@pulumi/pulumi";
import {Service} from "../base/service";
import {moveFilesForService, BaseLayer, CollectionArgs} from "../base/baseLayer";


export class Services extends BaseLayer {
    constructor(name: string, args: CollectionArgs, opts?: pulumi.ComponentResourceOptions) {
        super(name, args, opts)

        const kubePrometheusStack = new Service("kube-prometheus-stack", {
            namespaceName: "monitoring",
            chart: "kube-prometheus-stack",
            chartVersion: "44.3.1",
            createNamespace: true,
            chartURL: "https://prometheus-community.github.io/helm-charts",
            values: {
                grafana: {
                    sidecar: {
                        dashboards: {
                            searchNamespace: "ALL",
                        }
                    },
                    enabled: true,
                    ingress: {
                        enabled: true,
                        ingressClassName: "contour",
                        annotations: {
                            "cert-manager.io/cluster-issuer": "letsencrypt-staging"
                        },
                        hosts: [
                            pulumi.interpolate`grafana.${args.dnsDomainName}`,
                        ],
                        tls: [
                            {
                                hosts: [
                                    pulumi.interpolate`grafana.${args.dnsDomainName}`,
                                ],
                                secretName: "grafana-tls-cert",
                            },
                        ],
                    },
                    serviceMonitor: {
                        enabled: true,
                    }
                },
                "kube-state-metrics": {
                    enabled: true,
                },
                kubeEtcd: {
                    enabled: true,
                },
                "prometheus-node-exporter": {
                    enabled: true,
                    prometheus: {
                        monitor: {
                            enabled: true,
                        }
                    }
                },
                prometheus: {
                    enabled: true,
                    ingress: {
                        enabled: true,
                        ingressClassName: "contour",
                        annotations: {
                            "cert-manager.io/cluster-issuer": "letsencrypt-staging"
                        },
                        hosts: [
                            pulumi.interpolate`prometheus.${args.dnsDomainName}`,
                        ],
                        tls: [
                            {
                                hosts: [
                                    pulumi.interpolate`prometheus.${args.dnsDomainName}`,
                                ],
                                secretName: "prometheus-tls-cert",
                            }
                        ]
                    },
                    prometheusSpec: {
                        ruleSelectorNilUsesHelmValues: false,
                        serviceMonitorSelectorNilUsesHelmValues: false,
                    }
                },
                alertmanager: {
                    enabled: true,
                    ingress: {
                        enabled: true,
                        ingressClassName: "contour",
                        annotations: {
                            "cert-manager.io/cluster-issuer": "letsencrypt-staging"
                        },
                        hosts: [
                            pulumi.interpolate`alertmanager.${args.dnsDomainName}`,
                        ],
                        tls: [
                            {
                                hosts: [
                                    pulumi.interpolate`alertmanager.${args.dnsDomainName}`,
                                ],
                                secretName: "alertmanager-tls-cert",
                            }
                        ]
                    }
                }
            }
        }, {
            parent: this,
        });
        moveFilesForService(args, kubePrometheusStack, this, name);

        const contour = new Service("contour", {
            namespaceName: "contour",
            chart: "contour",
            chartVersion: "10.2.1",
            createNamespace: true,
            chartURL: "https://charts.bitnami.com/bitnami",
            values: {
                //metrics.serviceMonitor.enabled
                metrics: {
                    serviceMonitor: {
                        enabled: true,
                    }
                }
            },
            dependsOn: [
                {
                    name: pulumi.interpolate`${kubePrometheusStack.serviceName}-helm-release`,
                    namespace: kubePrometheusStack.serviceArgs.namespaceName,
                }
            ]
        }, {
            parent: this,
        });
        moveFilesForService(args, contour, this, name);

        const certManager = new Service("cert-manager", {
            namespaceName: "cert-manager",
            chart: "cert-manager",
            chartVersion: "1.11.0",
            createNamespace: true,
            chartURL: "https://charts.jetstack.io",
            values: {
                serviceAccount: {
                    automountServiceAccountToken: true,
                },
                prometheus: {
                    enabled: true,
                    serviceMonitor: {
                        enabled: true,
                    }
                },
                installCRDs: true,
                replicaCount: 1,
            },
            dependsOn: [
                {
                    name: pulumi.interpolate`${kubePrometheusStack.serviceName}-helm-release`,
                    namespace: kubePrometheusStack.serviceArgs.namespaceName,
                }
            ]
        }, {
            parent: this,
        })
        moveFilesForService(args, certManager, this, name);

        const externalDns = new Service("external-dns", {
            namespaceName: "external-dns",
            chart: "external-dns",
            chartVersion: "1.12.0",
            createNamespace: true,
            chartURL: "https://kubernetes-sigs.github.io/external-dns/",
            values: {
                provider: "civo",
                env: [
                    {
                        name: "CIVO_TOKEN",
                        value: args.token
                    }
                ],
                image: {
                    tag: "v0.13.2"
                },
                serviceMonitor: {
                    enabled: true,
                }
            },
            dependsOn: [
                {
                    name: pulumi.interpolate`${kubePrometheusStack.serviceName}-helm-release`,
                    namespace: kubePrometheusStack.serviceArgs.namespaceName,
                }
            ]
        }, {
            parent: this,
        })
        moveFilesForService(args, externalDns, this, name);

        const sealedSecrets = new Service("sealed-secrets", {
            namespaceName: "sealed-secrets",
            chart: "sealed-secrets",
            chartVersion: "2.7.3",
            createNamespace: true,
            chartURL: "https://bitnami-labs.github.io/sealed-secrets",
            values: {
                fullnameOverride: "sealed-secrets-controller",
                metrics: {
                    serviceMonitor: {
                        enabled: true,
                    },
                    dashboards: {
                        create: true,
                        labels: {
                            grafana_dashboard: "1"
                        }
                    }
                }
            },
            dependsOn: [
                {
                    name: pulumi.interpolate`${kubePrometheusStack.serviceName}-helm-release`,
                    namespace: kubePrometheusStack.serviceArgs.namespaceName,
                }
            ]
        }, {
            parent: this,
        })
        moveFilesForService(args, sealedSecrets, this, name);

        const trivyOperator = new Service("trivy-operator", {
            namespaceName: "security",
            chart: "trivy-operator",
            chartVersion: "0.10.2",
            createNamespace: true,
            chartURL: "https://aquasecurity.github.io/helm-charts/",
            values: {
                trivy: {
                    ignoreUnfixed: true,
                },
                serviceMonitor: {
                    enabled: true,
                }
            },
            dependsOn: [
                {
                    name: pulumi.interpolate`${kubePrometheusStack.serviceName}-helm-release`,
                    namespace: kubePrometheusStack.serviceArgs.namespaceName,
                }
            ]
        }, {
            parent: this,
        });
        moveFilesForService(args, trivyOperator, this, name);

        const kyverno = new Service("kyverno", {
            namespaceName: "compliance",
            chart: "kyverno",
            chartVersion: "2.7.0",
            createNamespace: true,
            chartURL: "https://kyverno.github.io/kyverno/",
            values: {
                config: {
                    resourceFilters: [
                        "[Event,*,*]",
                        "[*,kube-system,*]",
                        "[*,kube-public,*]",
                        "[*,kube-node-lease,*]",
                        "[Node,*,*]",
                        "[APIService,*,*]",
                        "[TokenReview,*,*]",
                        "[SubjectAccessReview,*,*]",
                        "[SelfSubjectAccessReview,*,*]",
                        "[*,kyverno,kyverno*]",
                        "[Binding,*,*]",
                        "[ReplicaSet,*,*]",
                        "[ReportChangeRequest,*,*]",
                        "[ClusterReportChangeRequest,*,*]",
                        "[*,capv-system,*]",
                        "[*,capm3-system,*]",
                    ]
                },
                serviceMonitor: {
                    enabled: true,
                }
            },
            dependsOn: [
                {
                    name: pulumi.interpolate`${kubePrometheusStack.serviceName}-helm-release`,
                    namespace: kubePrometheusStack.serviceArgs.namespaceName,
                }
            ]
        }, {
            parent: this,
        })
        moveFilesForService(args, kyverno, this, name);

        const kyvernoPolicies = new Service("kyverno-policies", {
            namespaceName: "compliance",
            chart: "kyverno-policies",
            chartVersion: "2.7.0",
            createNamespace: false,
            chartURL: "https://kyverno.github.io/kyverno/",
            dependsOn: [
                {
                    name: pulumi.interpolate`${kyverno.serviceName}-helm-release`,
                    namespace: kyverno.serviceArgs.namespaceName,
                }
            ]
        }, {
            parent: this,
            dependsOn: [kyverno]
        })
        moveFilesForService(args, kyvernoPolicies, this, name);

        const kyvernoPocyReporter = new Service("kyverno-policy-reporter", {
            namespaceName: "compliance",
            chart: "policy-reporter",
            chartVersion: "2.16.0",
            createNamespace: false,
            chartURL: "https://kyverno.github.io/policy-reporter",
            values: {
                kyvernoPlugin: {
                    enabled: true,
                },
                global: {
                    plugins: {
                        kyverno: true,
                    }
                },
                ui: {
                    enabled: true,
                },
                metrics: {
                    enabled: true,
                },
                monitoring: {
                    enabled: true,
                }
            },
            dependsOn: [
                {
                    name: pulumi.interpolate`${kyverno.serviceName}-helm-release`,
                    namespace: kyverno.serviceArgs.namespaceName,
                }
            ]
        }, {
            parent: this,
            dependsOn: [kyverno]
        })
        moveFilesForService(args, kyvernoPocyReporter, this, name);

        const komodor = new Service("komodor", {
            namespaceName: "komodor",
            chart: "k8s-watcher",
            chartVersion: "1.3.16",
            createNamespace: true,
            chartURL: "https://helm-charts.komodor.io",
            values: {
                apiKey: "xxx",
                createNamespace: false,
                watcher: {
                    clusterName: "azure",
                    allowReadingPodLogs: true,
                    enableAgentTaskExecution: true,
                    enableAgentTaskExecutionV2: true,
                    enableHelm: true,
                }
            }
        }, {
            parent: this,
        })
        moveFilesForService(args, komodor, this, name);

        pulumi.all([]).apply(() => {
            fs.mkdir(`${args.targetDir}/${name}`, {recursive: true}, (err) => {
                fs.writeFileSync(`${args.targetDir}/${name}/kustomization.yaml`, YAML.stringify({
                        apiVersion: "kustomize.config.k8s.io/v1beta1",
                        kind: "Kustomization",

                        resources: [
                            `${contour.serviceName}`,
                            `${certManager.serviceName}`,
                            `${externalDns.serviceName}`,
                            `${sealedSecrets.serviceName}`,
                            `${kubePrometheusStack.serviceName}`,
                            `${trivyOperator.serviceName}`,
                            `${kyverno.serviceName}`,
                            `${kyvernoPolicies.serviceName}`,
                            `${kyvernoPocyReporter.serviceName}`,
                            `${komodor.serviceName}`,
                        ]
                    })
                );
            });
        });
    }
}
