import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as YAML from "yaml";
import * as fs from 'fs'
import {local} from "@pulumi/command";
import {Config, Output, provider} from "@pulumi/pulumi";
import {Service} from "../base/service";
import {moveFilesForService, CollectionArgs, BaseLayer} from "../base/baseLayer";


export class BaseConfig extends BaseLayer {
    constructor(name: string, args: CollectionArgs, opts?: pulumi.ComponentResourceOptions) {
        super(name, args, opts);

        const provider = new k8s.Provider(`k8s-${name}`, {
            renderYamlToDirectory: `rendered/${name}`,
            enableServerSideApply: true
        }, {
            parent: this
        });
        const issuer = new k8s.apiextensions.CustomResource(`issuer`, {
            metadata: {
                name: new Config("issuer").get("name"),
                namespace: "cert-manager"
            },
            apiVersion: "cert-manager.io/v1",
            kind: new Config("issuer").get("kind") || "Issuer",
            spec: {
                acme: {
                    email: new Config("acme").get("email"),
                    server: new Config("acme").get("server"),
                    privateKeySecretRef: {
                        name: new Config("issuer").get("name")
                    },
                    solvers: [
                        {
                            http01: {
                                ingress: {
                                    class: "contour"
                                }
                            }
                        }
                    ]
                },
            }
        }, {
            provider: provider,
            parent: this,
            deleteBeforeReplace: true,
        });


        const subFolder = new local.Command(`mkdir-${name}`, {
            create: `mkdir -p ${args.targetDir}/${name}`,
            update: `mkdir -p ${args.targetDir}/${name}`,
        }, {
            parent: this,
            dependsOn: [issuer]
        });

        new local.Command(`mv-${name}`, {
            create: `cp rendered/${name}/*/** ${args.targetDir}/${name}/`,
        }, {
            parent: this,
            dependsOn: [issuer, subFolder]
        });


        const kustomize = pulumi.all([issuer.metadata.name])
            .apply((issuerName) => {
                fs.mkdir(`${args.targetDir}/${name}`, {recursive: true}, (err) => {
                    let content : string;
                    fs.readdir(`rendered/${name}/1-manifest/`, (err, files) => {
                        let yamlFiles = files.filter(file => {
                            return file.endsWith('.yaml') && file !== 'kustomization.yaml';
                        });

                        content = YAML.stringify({
                            apiVersion: "kustomize.config.k8s.io/v1beta1",
                            kind: "Kustomization",

                            resources: yamlFiles,
                        })
                        fs.writeFileSync(`rendered/${name}/1-manifest/kustomization.yaml`, content);
                    });
                });
            });
    }
}
