# Matrix Server Transfer Guide

This guide explains how to transfer the Dendrite Matrix server from this machine to another server.

## Current Setup

- **Matrix Server**: Dendrite (running in Docker)
- **Database**: PostgreSQL 15
- **Data Storage**: Docker volumes
- **Configuration**: Local files
- **Domain**: mchsrobotics.dev (configured but not yet active due to DNS)
- **Current Mode**: Local development (localhost)

## Domain Configuration Status

The server is configured to support `mchsrobotics.dev` but currently running in local development mode. To switch to the domain:

1. Configure DNS records (see DNS_CONFIGURATION.md)
2. Wait for DNS propagation
3. Update configuration files to use domain instead of localhost
4. Recreate Matrix user with new domain
5. Update web app configuration

## Server Transfer Process

### 1. Export Docker Volumes

On the current machine, export the Docker volumes that contain the Matrix data:

```bash
# Export PostgreSQL database
docker run --rm -v website_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data_backup.tar.gz -C /data .

# Export Dendrite data
docker run --rm -v website_dendrite_data:/data -v $(pwd):/backup alpine tar czf /backup/dendrite_data_backup.tar.gz -C /data .
```

### 2. Export Configuration Files

Copy the configuration files:

```bash
# Create a backup directory
mkdir -p matrix_backup

# Copy configuration files
cp -r dendrite-config matrix_backup/
cp docker-compose.yml matrix_backup/
```

### 3. Transfer to New Machine

Use SCP or any file transfer method to move the backup files:

```bash
# From current machine
scp postgres_data_backup.tar.gz dendrite_data_backup.tar.gz matrix_backup/ user@new-server:/path/to/destination/
```

### 4. Setup on New Machine

On the new machine (16GB RAM, i5-8500):

#### Install Docker and Docker Compose:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

#### Import Docker Volumes:
```bash
# Create volumes
docker volume create website_postgres_data
docker volume create website_dendrite_data

# Import PostgreSQL data
docker run --rm -v website_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_data_backup.tar.gz -C /data

# Import Dendrite data
docker run --rm -v website_dendrite_data:/data -v $(pwd):/backup alpine tar xzf /backup/dendrite_data_backup.tar.gz -C /data
```

#### Restore Configuration:
```bash
# Extract configuration
cp -r matrix_backup/dendrite-config .
cp matrix_backup/docker-compose.yml .
```

#### Update Configuration (if needed):
- Edit `dendrite-config/dendrite.yaml` if server name changes
- Update `docker-compose.yml` if port mappings need adjustment

#### Start the Server:
```bash
docker compose up -d
```

### 5. Update Client Configuration

Update the Matrix client configuration in your React app:

```javascript
// src/config/matrix.js
export const matrixConfig = {
  homeserverUrl: 'http://NEW_SERVER_IP:8008', // Update to new server IP
  userId: '@mchs_robotics:localhost', // May need to update if server name changes
  accessToken: 'ntjfMCPtSrxBwEUyTUwuxlJXlUWAX5NRCIC1PYrG3DM', // Keep existing token
  roomId: '!rV5ADbihXBvRfYTe:localhost', // May need to update if server name changes
};
```

### 6. Rebuild and Deploy the Web App

```bash
npm run build
# Deploy the dist/ folder to your web server
```

## Important Notes

### Server Name Changes
If you change the server name in `dendrite.yaml`, you'll need to:
1. Create new user accounts
2. Create new rooms
3. Update all configuration files with the new user IDs and room IDs

### Database Credentials
The current PostgreSQL credentials are:
- User: `dendrite`
- Password: `mchs_robotics_secure_password`
- Database: `dendrite`

**Security**: Change these passwords before production deployment.

### Performance on New Hardware
With 16GB RAM and i5-8500, Dendrite will perform excellently:
- Expected RAM usage: 100-500MB idle, up to 2GB under load
- CPU usage: Very low with normal traffic
- Plenty of headroom for growth

### Backup Strategy
After transfer, implement regular backups:
```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker run --rm -v website_postgres_data:/data -v /backups:/backup alpine tar czf /backup/postgres_$DATE.tar.gz -C /data .
docker run --rm -v website_dendrite_data:/data -v /backups:/backup alpine tar czf /backup/dendrite_$DATE.tar.gz -C /data .
```

### Monitoring
Monitor server health:
```bash
# Check container status
docker ps

# View logs
docker logs mchs-dendrite
docker logs dendrite-postgres

# Check resource usage
docker stats
```

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker logs mchs-dendrite

# Common issues:
# - Volume permissions: Ensure volumes are properly imported
# - Port conflicts: Check if port 8008 is available
# - Database connection: Verify PostgreSQL is healthy
```

### Connection Issues
```bash
# Test Matrix server availability
curl http://localhost:8008/_matrix/client/versions

# Check if port is accessible from outside
netstat -tlnp | grep 8008
```

### Data Integrity
After transfer, verify:
```bash
# Connect to PostgreSQL and check tables
docker exec -it dendrite-postgres psql -U dendrite -d dendrite -c "\dt"

# Check Dendrite logs for errors
docker logs mchs-dendrite
```

## Current Configuration Files

### docker-compose.yml
- Uses PostgreSQL 15 Alpine
- Dendrite monolith image
- Network: `website_matrix`
- Volumes: `website_postgres_data`, `website_dendrite_data`

### dendrite-config/dendrite.yaml
- Server name: `localhost`
- Database: PostgreSQL connection
- Open registration enabled (with warning flag)
- JetStream storage: `/var/dendrite/jetstream`

## Security Recommendations for Production

1. **Change all passwords** before production deployment
2. **Enable HTTPS** using a reverse proxy (Caddy/Nginx)
3. **Restrict registration** or implement proper authentication
4. **Configure firewall** to limit access
5. **Enable federation** only if needed
6. **Implement rate limiting**
7. **Regular security updates** for Docker images
8. **Monitor logs** for suspicious activity

## Support

For issues with:
- **Dendrite**: https://github.com/matrix-org/dendrite
- **Matrix SDK**: https://github.com/matrix-org/matrix-js-sdk
- **Docker**: https://docs.docker.com/