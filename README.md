# Obsidian: A full decentralized, load-balancing, and redundant RPC
# Also comes built in a packet Indexer (Index data with only your package ID !)

A comprehensive platform that combines Lava Network, SUI blockchain indexing (sui-indexer-alt),a SUI Full Node, and Supabase database services in a unified Docker Compose setup.

## Project Structure

```
MasterProject/
├── docker-compose.yml                  # Main compose file with service integrations
├── docker-compose.override.yml         # Service definitions for containers that need to share volumes networks
├── lava/
│   ├── docker/
│   │   ├── common/
│   │   │   ├── consumer.yml
│   │   │   ├── new_node_init.sh
│   │   │   ├── post_node_init.sh       # Script responsible for the creating and stake of the provider
│   │   │   ├── provider_lava.yml
│   │   │   ├── provider_sui.yml
│   │   ├── simple-provider/
│   │   │   ├── docker-compose.yml      # Lava docker services definition
│   │   │   └── nginx/
│   │   │       └── default.conf
├── full-node/                          # SUI Full Node directory
│   ├── fullnode-template.yaml          # SUI Full Node configuration
│   └── docker-compose.yml              # SUI Full Node docker services definition
├── sui_indexer_checkpointTx/
│   ├── Dockerfile                      # Indexer Dockerfile definition
│   └── docker-compose.yml              # SUI indexer services definition
├── supabase/
│   └── docker/
│       └── docker-compose.yml          # Supabase docker services definition
└── sui-tool/
    ├── data/
    │   └── genesis.blob
    ├── docker-compose.yml              # Sui-tool docker services definition
    └── Dockerfile                      # Sui-tool Dockerfile definition

```

## Components Overview

### 1. Lava Node
Provides blockchain node services for the Lava Network. Handles the consensus and the state of the SUI providers (availability, load-balancing, fault tolerance, decentralization, QoS)

### 2. Lava Provider
Acts as a gateway for RPC requests. Serves RPC requests from an arbitray number of SUI Full Nodes and unites them under the lava network. They can be either a local SUI Full Node or an already existing external RPC (we use both here)

### 3. SUI Full Node
Serves as the primary data source for the SUI blockchain. Provides RPC endpoints that the Lava Provider relays to clients, and also checkpoint for the ingestion of the Indexer.

### 4. SUI Indexer (sui-indexer-alt)
Processes SUI blockchain data from the SUI Full Node and stores it in the Supabase database. Depends on both the Supabase database and SUI Full Node being available (in local mode, external checkpoint reader mode also supported).

### 5. Supabase
Provides PostgreSQL database services and auto-generates REST endpoints from the database schema, which are used by the Lava Provider to serve indexed data.

## Dependencies Flow

![image](https://github.com/user-attachments/assets/f48f8b1d-9981-482d-a41f-89a9a4af6d17)

## Docker Containers

| Image                                | Command                   | Ports                                                                                     | Name                            |
|-------------------------------------|---------------------------|-------------------------------------------------------------------------------------------|---------------------------------|
| nginx:latest                        | /docker-entrypoint.…      | 80/tcp, 0.0.0.0:443->443/tcp                                                               | master-project-nginx-1         |
| ghcr.io/lavanet/lava/lavap:v5.2.1   | lavap rpcprovider p…      | 1317, 8080, 9090-9091, 26656-26657                                                         | master-project-provider2-1     |
| ghcr.io/lavanet/lava/lavap:v5.2.1   | lavap rpcprovider p…      | 1317, 8080, 9090-9091, 26656-26657                                                         | master-project-provider1-1     |
| ghcr.io/lavanet/lava/lavap:v5.2.1   | lavap rpcconsumer c…      | 2220→2220, 1317, 8080, 9090-91, 26656-57, 3334-3336→3334-3336                              | master-project-consumer-1      |
| supabase/postgres-meta:v0.86.1      | docker-entrypoint.s…      | 8080/tcp                                                                                   | supabase-meta                  |
| master-project-indexer              | /app/entrypoint.sh        |                                                                                           | master-project-indexer-1       |
| postgrest/postgrest:v12.2.8         | postgrest                 | 3000/tcp                                                                                   | supabase-rest                  |
| supabase/supavisor:2.4.12           | /usr/bin/tini -s -g…      |                                                                                           | supabase-pooler                |
| supabase/gotrue:v2.170.0            | auth                      |                                                                                           | supabase-auth                  |
| ghcr.io/lavanet/lava/lavad:v5.2.1   | lavad start --pruni…      | 1317→1317, 8080, 9090→9090, 26656-57→26656-57, 9091                                        | lava-node                      |
| supabase/postgres:15.8.1.044        | docker-entrypoint.s…      | 5432/tcp                                                                                   | supabase-db                    |
| supabase/studio:20250224-d10db0f    | docker-entrypoint.s…      | 3000/tcp                                                                                   | supabase-studio                |
| kong:2.8.1                          | bash -c 'eval "echo…      | 8000→8000, 8001, 8443→8443, 8444                                                            | supabase-kong                  |
| timberio/vector:0.28.1-alpine       | /usr/local/bin/vect…      |                                                                                           | supabase-vector                |
| supabase/logflare:1.12.5            | sh run.sh                 | 4000→4000                                                                                  | supabase-analytics             |
| mysten/sui-node:mainnet             | /opt/sui/bin/sui-no…      | 8080→8080, 9000→9000, 9184→9184, 8084/udp                                                  | master-project-sui-node-1      |

## Setup Instructions

### Prerequisites

- Docker and Docker Compose v2+ installed
- At least 16GB RAM available for all services

## Sui Hardware requirements (if running in local mode)
Suggested minimum hardware to run a Sui Full node:

CPUs: 8 physical cores / 16 vCPUs
RAM: 128 GB
Storage (SSD): 4 TB NVMe drive

### Installation Steps

1. Clone the repository:
   ```bash
   git clone git@github.com:Project-Magma-Monorepo/Monorepo.git
   cd Monorepo
   ```

2. Configure your environment:
   - Review and modify `lava/docker/common/provider_sui.yml` as needed (put rpc url, can be local or external rpc)
   - Configure `full-node/fullnode-template.yaml` with appropriate network settings
   - Configure `.env` by taking inspiration from the `.env.example` file. This env file should override all local env files and act as a single env config when ran from root
   - Check any environment variables in the individual docker-compose files (shouldn't be needed if ran from root)


3. Start all services (from root):
   ```bash
   docker compose up -d
   ```

5. Check service status:
   ```bash
   docker ps
   ```

## Service Dependencies

The system is designed with the following dependency chain:

1. Supabase DB starts first and waits until healthy
2. SUI Full Node starts independently 
3. SUI Indexer starts after both Supabase DB is healthy and SUI Full Node is available
4. Lava Provider starts after both SUI Full Node and Supabase REST services are available
5. Lava Node runs independently but connects to the Lava Provider

## Supabase REST API Integration

Supabase automatically generates RESTful API endpoints from your database tables. These endpoints are leveraged by the Lava Provider to serve indexed blockchain data.

### How it works:

1. The SUI Indexer stores blockchain data in structured tables within Supabase
2. Supabase's `postgrest` service generates REST endpoints for each table
3. The Lava Provider is configured to proxy specific API requests to these endpoints
4. External applications access this data through the Lava Network

### Setting up Supabase auto-generated REST endpoints:

1. Create appropriate database schemas in Supabase
2. Configure proper roles and permissions for API access
3. Use the Supabase Studio interface to manage and test endpoints


## Common Commands

### Start all services
```bash
docker compose up -d
```

### List running services
```bash
docker ps
```

### Stop all services
```bash
docker compose down 
```

### Restart a specific service
```bash
docker compose restart <service-name>
```

### View logs for all services
```bash
docker compose logs
```

### View logs for a specific service
```bash
docker compose logs -f <service-name>
```

### Check resource usage
```bash
docker stats
```

## Data Flows

1. **SUI Blockchain → SUI Full Node**: The Full Node syncs with the SUI blockchain network.
2. **SUI Full Node → SUI Indexer**: The indexer retrieves data from the local SUI Full Node by ingesting its checkpoints.
3. **SUI Indexer → Supabase DB**: Processed blockchain data is stored in the Supabase PostgreSQL database.
4. **Supabase DB → REST Endpoints**: Supabase automatically generates REST APIs from the database schema.
5. **External Applications → Lava Network → Lava Provider**: Applications make requests through the Lava Network RPC endpoints (gateway).
6. **Lava Provider → SUI Full Node**: Direct RPC requests to the Lava gateway are forwarded to the SUI Full Node.
7. **Lava Provider → Supabase REST**: Indexed data requests are forwarded to Supabase's auto-generated REST endpoints.


## SUI Full Node Setup

The SUI Full Node requires specific configuration:

1. Download the appropriate genesis blob for your network:
   ```bash
   # For mainnet
   curl -fLJO https://github.com/MystenLabs/sui-genesis/raw/main/mainnet/genesis.blob
   ```

2. Configure the fullnode.yaml file:
   ```yaml
   # Basic configuration for SUI Full Node
   p2p-config:
     seed-peers:
       # Add appropriate seed peers for your network
       - address: /dns/sui-mainnet-seed-0.mysten.io/udp/8084
         peer-id: [peer-id]
   
   genesis:
     genesis-file-location: "/sui/genesis.blob"
   
   db-path: "/sui/db"
   metrics-address: "0.0.0.0:9184"
   json-rpc-address: "0.0.0.0:9000"
   ```

## Lava Provider Setup

The Lava Provider serves as a gateway between client applications and blockchain data sources:

1. Configure the Lava Provider for its RPC (important to disable TLS, nginx handles TLS):
   ```yaml
   # lava/docker/common/
   endpoints:
  - api-interface: jsonrpc
    chain-id: SUIJSONRPC
    network-address:
      address: 0.0.0.0:2220 #important to match ports for provider
      disable-tls: true
    node-urls: 
      - url: http://sui-node:9000
      # - url : https://sui-mainnet.nodeinfra.com
      # - url : https://fullnode.mainnet.sui.io:443
    disable-tls: true
   ```

## Troubleshooting

### Lava Provider Connection Issues
If the Lava Provider cannot connect to data sources:
1. Check if both SUI Full Node and Supabase services are running
2. Verify network connectivity between containers
3. Confirm endpoint configurations in the Lava Provider

### SUI Full Node Synchronization Issues
If the SUI Full Node is not synchronizing:
1. Check if the Full Node is syncing: `docker compose logs full-node`
2. Verify the genesis blob is correct for your network
3. Check the fullnode.yaml configuration
4. Ensure enough disk space is available for blockchain data

### Database Connection Issues
If the SUI Indexer cannot connect to the database:
1. Check if the Supabase DB container is healthy: `docker compose ps`
2. Verify network connectivity between containers
3. Ensure database credentials are correct

### REST Endpoint Issues
If the auto-generated REST endpoints aren't working:
1. Check Supabase REST service logs: `docker compose logs supabase-rest`
2. Verify database schema and permissions
3. Test endpoints directly using the Supabase Studio interface

### General Troubleshooting
```bash
# Restart all services
docker compose down && docker compose up -d

# Check container logs
docker compose logs -f

# Inspect a specific container
docker inspect <container-id>
```

## Maintenance

### Updating Services
```bash
# Pull latest images
docker compose pull

# Restart with new images
docker compose down && docker compose up -d
```

### Backing Up Data
```bash
# Backup Supabase database
docker compose exec supabase-db pg_dump -U postgres -d postgres > backup.sql

### Monitoring Services
```bash
# Check SUI Full Node sync status
curl -s -X POST http://localhost:9000 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"sui_getLatestCheckpointSequenceNumber","params":[]}'

# Check Supabase REST endpoint
curl -s http://localhost:3000/rest/v1/health
```
