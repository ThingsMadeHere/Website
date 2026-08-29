# DNS Configuration for mchsrobotics.dev

To connect your domain `mchsrobotics.dev` to the Matrix server, you need to configure the following DNS records with your domain registrar.

## Current Status: Production Ready

The server is now configured for production use with the domain `mchsrobotics.dev` and the Matrix subdomain `matrix.mchsrobotics.dev`.

## Required DNS Records

### A Records (for both domains)
```
Type: A
Name: @ (or leave blank)
Value: YOUR_PUBLIC_IP_ADDRESS
TTL: 3600 (or as low as your registrar allows)
```

You need two A records:
- `mchsrobotics.dev` → YOUR_PUBLIC_IP
- `matrix.mchsrobotics.dev` → YOUR_PUBLIC_IP

### SRV Record (for Matrix federation - optional but recommended)
```
Type: SRV
Name: _matrix._tcp
Priority: 10
Weight: 0
Port: 8448
Target: matrix.mchsrobotics.dev
TTL: 3600
```

## When to Deploy

Only deploy after:
1. ✅ DNS records are configured (see below)
2. ✅ DNS has propagated (can take up to 48 hours)
3. ✅ Domain is pointing to your server's public IP
4. ✅ Ports 80, 443, and 8448 are accessible from the internet

## Deployment Steps

Once DNS is ready, follow these steps:

1. Verify configuration files are correct (already done):
   - `dendrite-config/dendrite.yaml`: server_name is `mchsrobotics.dev`
   - `Caddyfile`: configured for both `mchsrobotics.dev` and `matrix.mchsrobotics.dev`
   - `src/config/matrix.js`: homeserverUrl is `https://matrix.mchsrobotics.dev`

2. Restart services:
   ```bash
   docker compose down
   docker compose up -d
   ```

3. Create Matrix user:
   ```bash
   curl -X POST https://matrix.mchsrobotics.dev/_matrix/client/v3/register \
     -H "Content-Type: application/json" \
     -d '{"username": "mchs_robotics", "password": "robotics_secure_password", "auth": {"type": "m.login.dummy"}}'
   ```

4. Update the access token in `src/config/matrix.js` with the token from the registration response

5. Rebuild web app:
   ```bash
   npm run build
   ```

## Step-by-Step DNS Configuration

### 1. Get Your Public IP Address
First, find the public IP address of the machine where you'll run the server:

```bash
# From the server machine
curl ifconfig.me
# or
curl ipinfo.io/ip
```

### 2. Configure DNS Records

Go to your domain registrar (where you bought mchsrobotics.dev) and add these records:

#### Basic Setup (Minimum Required)
- **A Record**: `@` → `YOUR_PUBLIC_IP` (for mchsrobotics.dev)
- **A Record**: `matrix` → `YOUR_PUBLIC_IP` (for matrix.mchsrobotics.dev)

#### Matrix Federation Setup (Recommended)
- **SRV Record**: `_matrix._tcp.mchsrobotics.dev` → `matrix.mchsrobotics.dev:8448`

### 3. Example Configuration

If your public IP is `123.45.67.89`, your DNS records should look like:

```
Type  Name            Value              TTL
A     @               123.45.67.89        3600
A     matrix          123.45.67.89        3600
SRV   _matrix._tcp    10 0 8448 matrix.mchsrobotics.dev  3600
```

### 4. DNS Propagation

After making changes, DNS can take anywhere from a few minutes to 48 hours to propagate worldwide. You can check propagation status using:

```bash
# Check if DNS has propagated
dig mchsrobotics.dev
dig matrix.mchsrobotics.dev
nslookup mchsrobotics.dev
nslookup matrix.mchsrobotics.dev
```

Or use online tools like:
- https://dnschecker.org/
- https://whatsmydns.net/

## Port Forwarding (If behind a router)

If your server is behind a NAT/router, you need to forward these ports:

### Required Ports:
- **Port 80**: HTTP (for Caddy to obtain SSL certificate)
- **Port 443**: HTTPS (for secure web traffic)
- **Port 8448**: Matrix Federation (optional, for server-to-server communication)

### Router Configuration:
1. Access your router's admin panel (usually 192.168.1.1 or 192.168.0.1)
2. Find "Port Forwarding" or "Virtual Server" section
3. Forward the following ports to your server's local IP:
   - `80:80` → `YOUR_SERVER_LOCAL_IP:80`
   - `443:443` → `YOUR_SERVER_LOCAL_IP:443` 
   - `8448:8448` → `YOUR_SERVER_LOCAL_IP:8448`

## Testing DNS Configuration

### 1. Test DNS Resolution
```bash
# Test if domain resolves to your IP
dig mchsrobotics.dev
dig matrix.mchsrobotics.dev
nslookup mchsrobotics.dev
nslookup matrix.mchsrobotics.dev
```

### 2. Test Port Accessibility
```bash
# Test if ports are accessible from outside
telnet mchsrobotics.dev 80
telnet mchsrobotics.dev 443
telnet mchsrobotics.dev 8448
```

### 3. Test SSL Certificate
Once Caddy is running, it will automatically obtain SSL certificates from Let's Encrypt. You can test:
```bash
curl -I https://matrix.mchsrobotics.dev
```

## Well-Known Matrix Configuration

The Caddyfile includes the necessary `.well-known` Matrix configuration that tells Matrix clients how to connect to your server:

- `/.well-known/matrix/server` - Tells other Matrix servers how to federate with yours (points to `matrix.mchsrobotics.dev:443`)
- `/.well-known/matrix/client` - Tells Matrix clients how to connect (points to `https://matrix.mchsrobotics.dev`)

These are required for proper Matrix federation and client discovery.

## Troubleshooting

### DNS Not Propagating
- Wait longer (up to 48 hours)
- Check your registrar's DNS settings
- Ensure you're editing the correct DNS zone

### Ports Not Accessible
- Check firewall settings on the server:
  ```bash
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw allow 8448/tcp
  ```
- Verify port forwarding in router
- Check if ISP blocks these ports

### SSL Certificate Issues
- Ensure port 80 is accessible (required for Let's Encrypt)
- Check Caddy logs: `docker logs mchs-caddy`
- Verify DNS is properly pointing to your server

## Security Considerations

1. **Firewall**: Only open necessary ports
2. **DDoS Protection**: Consider using Cloudflare or similar service
3. **DNSSEC**: Enable DNSSEC if your registrar supports it
4. **Regular Updates**: Keep Docker images updated

## Next Steps

After DNS is configured and services are running:

1. Test connectivity from your web app
2. Verify Matrix federation works (optional)
3. Update the `accessToken` in `src/config/matrix.js` with a real token
4. Rebuild and deploy the web application
