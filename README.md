# Project Magma: Blockchain Data Indexing Platform

A comprehensive platform that combines Lava Network, SUI blockchain indexing, SUI Full Node, Lava Provider, and Supabase database services in a unified Docker Compose setup.

## Project Structure

```
MasterProject/
├── docker-compose.yml             # Main compose file with service integrations
├── lava/
│   ├── config.yml                 # Lava node configuration
│   └── docker/
│       └── state-sync/
│           └── docker-compose.yml  # Lava node services definition
├── lava-provider/                 # Lava Provider configuration
│   └── docker-compose.yml         # Lava provider services definition
├── sui-fullnode/                  # SUI Full Node directory
│   ├── fullnode.yaml              # SUI Full Node configuration
│   └── docker-compose.yml         # SUI Full Node services definition
├── sui-sender-indexer/
│   └── docker-compose.yml         # SUI indexer services definition
└── supabase/
    └── docker/
        └── docker-compose.yml     # Supabase services definition
```

## Components Overview

### 1. Lava Node
Provides blockchain node services for the Lava Network. Includes state synchronization capabilities for fast bootstrapping.

### 2. Lava Provider
Acts as a relay for blockchain data requests. Serves RPC requests to the SUI Full Node and leverages auto-generated REST endpoints from Supabase.

### 3. SUI Full Node
Serves as the primary data source for the SUI blockchain. Provides RPC endpoints that the Lava Provider relays to clients.

### 4. SUI Indexer
Processes SUI blockchain data from the SUI Full Node and stores it in the Supabase database. Depends on both the Supabase database and SUI Full Node being available.

### 5. Supabase
Provides PostgreSQL database services and auto-generates REST endpoints from the database schema, which are used by the Lava Provider to serve indexed data.

## Dependencies Flow

```
                       ┌───────────────┐
                       │  SUI Full Node│
                       └───────┬───────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
┌────────────┐   feeds    ┌────────────┐   serves RPC   ┌────────────┐
│ SUI Indexer │◄──────────┤ Blockchain │───────────────►│Lava Provider│
└──────┬─────┘    data    │    Data    │               └──────┬─────┘
       │                  └────────────┘                      │
       │ stores                                               │
       ▼                                                      │
┌─────────────┐  auto-generates   ┌────────────────┐          │
│ Supabase DB │─────────────────►│  REST Endpoints │◄─────────┘
└─────┬───────┘                  └────────────────┘    serves REST
      │
      │ provides
      ▼
┌────────────────┐              ┌────────────┐
│  Data Storage  │◄─────────────┤  Lava Node │
│  & API Services│              └────────────┘
└────────────────┘
```

## Containers

| Service Name | Description | Ports |
|-------------|-------------|-------|
| lava-node | Lava blockchain node | 1317, 9090, 9091, 26656, 26657 |
| lava-node-init | Initializes the Lava node | - |
| lava-node-config | Configures the Lava node | - |
| lava-provider | Lava Provider for relaying blockchain requests | 7777 |
| sui-fullnode | SUI blockchain full node | 9000, 9184 |
| sui-indexer | Indexes SUI blockchain data | (depends on implementation) |
| supabase-db | PostgreSQL database | 5432 |
| supabase-kong | API Gateway | 8000 |
| supabase-auth | Authentication service | - |
| supabase-rest | RESTful API service | 3000 |
| supabase-studio | Admin UI | 3001 |
| supabase-storage | File storage | - |
| supabase-realtime | Real-time subscriptions | - |
| supabase-vector | Vector embeddings | - |
| supabase-supavisor | Connection pooler | - |

## Setup Instructions

### Prerequisites

- Docker and Docker Compose v2+ installed
- At least 16GB RAM available for all services
- At least 200GB storage space (SUI Full Node requires significant storage)

### Installation Steps

1. Clone the repository:
   ```bash
   git clone <repository-url> MasterProject
   cd MasterProject
   ```

2. Configure your environment:
   - Review and modify `lava/config.yml` as needed
   - Configure `sui-fullnode/fullnode.yaml` with appropriate network settings
   - Configure `lava-provider/config.yml` to point to SUI Full Node and Supabase endpoints
   - Check any environment variables in the individual docker-compose files

3. Update the main docker-compose file:
   ```yaml
   # MasterProject/docker-compose.yml
   include:
     - path: ./lava/docker/state-sync/docker-compose.yml
       project_directory: ./lava/docker/state-sync
       name: lava
       
     - path: ./lava-provider/docker-compose.yml
       project_directory: ./lava-provider
       name: lava-provider
       
     - path: ./sui-fullnode/docker-compose.yml
       project_directory: ./sui-fullnode
       name: sui-fullnode
       
     - path: ./sui-sender-indexer/docker-compose.yml
       project_directory: ./sui-sender-indexer
       name: sui
       
     - path: ./supabase/docker/docker-compose.yml
       project_directory: ./supabase/docker
       name: supabase
   ```

4. Start all services:
   ```bash
   docker compose up -d
   ```

5. Check service status:
   ```bash
   docker compose ps
   ```

## Service Dependencies

The system is designed with the following dependency chain:

1. Supabase DB starts first and waits until healthy
2. SUI Full Node starts independently 
3. SUI Indexer starts after both Supabase DB is healthy and SUI Full Node is available
4. Lava Provider starts after both SUI Full Node and Supabase REST services are available
5. Lava Node runs independently but connects to the Lava Provider

To set up these dependencies in docker-compose.yml:

```yaml
# Update services in docker-compose.yml
sui-indexer:
  depends_on:
    supabase-db:
      condition: service_healthy
    sui-fullnode:
      condition: service_healthy

lava-provider:
  depends_on:
    sui-fullnode:
      condition: service_healthy
    supabase-rest:
      condition: service_healthy
```

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

Example configuration in the Lava Provider to use Supabase REST endpoint:

```yaml
endpoints:
  - name: sui_getTransactionsByAddress
    target: http://supabase-rest:3000/rest/v1/transactions?address=eq.{{.address}}&limit={{.limit}}
    method: GET
    headers:
      apikey: ${SUPABASE_ANON_KEY}
```

## Common Commands

### Start all services
```bash
docker compose up -d
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
2. **SUI Full Node → SUI Indexer**: The indexer retrieves data from the local SUI Full Node.
3. **SUI Indexer → Supabase DB**: Processed blockchain data is stored in the Supabase PostgreSQL database.
4. **Supabase DB → REST Endpoints**: Supabase automatically generates REST APIs from the database schema.
5. **External Applications → Lava Network → Lava Provider**: Applications make requests through the Lava Network.
6. **Lava Provider → SUI Full Node**: Direct RPC requests are forwarded to the SUI Full Node.
7. **Lava Provider → Supabase REST**: Indexed data requests are forwarded to Supabase's auto-generated REST endpoints.

## Volumes

The setup maintains persistent data through Docker volumes:

- `lava_data`: Stores blockchain data for the Lava node
- `sui_fullnode_data`: Stores the SUI blockchain data for the Full Node
- Supabase-related volumes for database, storage, etc.

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

1. Configure the Lava Provider to connect to the Lava Network:
   ```yaml
   # lava-provider/config.yml
   provider:
     chain: sui
     network: mainnet
     moniker: "my-sui-provider"
     # Lava staking details
     stake: "5000000000ulava"
   ```

2. Set up endpoints mapping:
   ```yaml
   # Simple RPC endpoints forwarded to SUI Full Node
   endpoints:
     - name: sui_getObject
       target: http://sui-fullnode:9000
       method: POST
     
     # REST endpoints from Supabase
     - name: sui_getIndexedBlocks
       target: http://supabase-rest:3000/rest/v1/sui_blocks
       method: GET
       headers:
         apikey: ${SUPABASE_ANON_KEY}
   ```

## Troubleshooting

### Lava Provider Connection Issues
If the Lava Provider cannot connect to data sources:
1. Check if both SUI Full Node and Supabase services are running
2. Verify network connectivity between containers
3. Confirm endpoint configurations in the Lava Provider

### SUI Full Node Synchronization Issues
If the SUI Full Node is not synchronizing:
1. Check if the Full Node is syncing: `docker compose logs sui-fullnode`
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

# Backup SUI configuration (not blockchain data)
cp sui-fullnode/fullnode.yaml sui-fullnode/fullnode.yaml.backup
```

### Monitoring Services
```bash
# Check SUI Full Node sync status
curl -s -X POST http://localhost:9000 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"sui_getLatestCheckpointSequenceNumber","params":[]}'

# Check Supabase REST endpoint
curl -s http://localhost:3000/rest/v1/health
```