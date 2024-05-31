# Subgraph Deployment Guide

Bu subgraphın subgraph yaml dosyasının apıVersionu yükseltildiği için schema ve mappings altında güncellemeler yapılmıştır genel olarak güncellemeler null kontrolü için vardır.

Deploy için:

1. Authenticate with your deploy key:
    ```bash
    graph auth --studio <deploy key>
    ```

2. Code Generation and Build:
    ```bash
    graph codegen && graph build
    ```

3. Deployment:
    ```bash
    graph deploy --studio <studio name>
    ```

Steps:
- `graph auth --studio <deploy key>`
- `graph codegen && graph build`
- `graph deploy --studio <studio name>`





----------------------------------------------


The subgraph's `subgraph.yaml` file has been upgraded for `apiVersion`, necessitating updates in the schema and mappings primarily for null checks.

For deployment:

1. Authenticate with your deploy key:
    ```bash
    graph auth --studio <deploy key>
    ```

2. Code Generation and Build:
    ```bash
    graph codegen && graph build
    ```

3. Deployment:
    ```bash
    graph deploy --studio <studio name>
    ```

Steps:
- `graph auth --studio <deploy key>`
- `graph codegen && graph build`
- `graph deploy --studio <studio name>`
