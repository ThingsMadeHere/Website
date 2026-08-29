# DNS Configuration for mchsrobotics.dev

To connect your domain `mchsrobotics.dev` to the Matrix server, you need to configure the following DNS records with your domain registrar.

## Current Status: Local Development

The server is currently configured for local development using `localhost`. Once you have configured your DNS records and they have propagated, you can switch to the domain configuration.

## When to Switch to Domain Configuration

Only switch to the domain configuration after:
1. ✅ DNS records are configured (see below)
2. ✅ DNS has propagated (can take up to 48 hours)
3. ✅ Domain is pointing to your server's public IP
4. ✅ Ports 80, 443, and 8448 are accessible from the internet

## Switching to Domain Configuration

Once DNS is ready, follow these steps:

1. Update `dendrite-config/dendrite.yaml`:
   ```yaml
   server_name: mchsrobotics.dev
   ```

2. Update `Caddyfile` (uncomment the domain section):
   ```caddyfile
   mchsrobotics.dev {
       # Matrix Client API
       reverse_proxy /_matrix/* dendrite:8008
       reverse_proxy /_synapse/* dendrite:8008
       
       # Well-known Matrix configuration
       handle /.well-known/matrix/server {
           respond `{"m.server": "mchsrobotics.dev:443"}`
       }
       
       handle /.well-known/matrix/client {
           header Access-Control-Allow-Origin *
           respond `{"m.homeserver": {"base_url": "https://mchsrobotics.dev"}}`
       }
   }
   ```

3. Update `src/config/matrix.js`:
   ```javascript
   export const matrixConfig = {
     homeserverUrl: 'https://mchsrobotics.dev',
     userId: '@mchs_robotics:mchsrobotics.dev',
     accessToken: 'YOUR_ACCESS_TOKEN',
     roomId: '!rV5ADbihXBvRfYTe:mchsrobotics.dev',
   };
   ```

4. Restart services:
   ```bash
   docker compose down
   docker compose up -d
   ```

5. Recreate Matrix user with new domain:
   ```bash
   curl -X POST https://mchsrobotics.dev/_matrix/client/v3/register \
     -H "Content-Type: application/json" \
     -d '{"username": "mchs_robotics", "password": "robotics_secure_password", "auth": {"type": "m.login.dummy"}}'
   ```

6. Rebuild web app:
   ```bash
   npm run build
   ```

## Required DNS Records for mchsrobotics.dev

## Required DNS Records

### A Record (for the main domain)
```
Type: A
Name: @ (or leave blank)
Value: YOUR_PUBLIC_IP_ADDRESS
TTL: 3600 (or as low as your registrar allows)
```

### A Record (for the Matrix federation port)
```
Type: A
Name: @ (or leave blank) 
Value: YOUR_PUBLIC_IP_ADDRESS
TTL: 3600
```

### SRV Record (for Matrix federation - optional but recommended)
```
Type: SRV
Name: _matrix._tcp
Priority: 10
Weight: 0
Port: 8448
Target: mchsrobotics.dev
TTL: 3600
```

## Step-by-Step Configuration

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
- **A Record**: `@` → `YOUR_PUBLIC_IP`
- **A Record**: `www` → `YOUR_PUBLIC_IP` (if you want www subdomain)

#### Matrix Federation Setup (Recommended)
- **SRV Record**: `_matrix._tcp.mchsrobotics.dev` → `mchsrobotics.dev:8448`

### 3. Example Configuration

If your public IP is `123.45.67.89`, your DNS records should look like:

```
Type  Name            Value              TTL
A     @               123.45.67.89        3600
A     www             123.45.67.89        3600
SRV   _matrix._tcp    10 0 8448 mchsrobotics.dev  3600
```

### 4. DNS Propagation

After making changes, DNS can take anywhere from a few minutes to 48 hours to propagate worldwide. You can check propagation status using:

```bash
# Check if DNS has propagated
dig mchsrobotics.dev
nslookup mchsrobotics.dev
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
nslookup mchsrobotics.dev
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
curl -I https://mchsrobotics.dev
```

## Well-Known Matrix Configuration

The Caddyfile I've created includes the necessary `.well-known` Matrix configuration that tells Matrix clients how to connect to your server:

- `/.well-known/matrix/server` - Tells other Matrix servers how to federate with yours
- `/.well-known/matrix/client` - Tells Matrix clients how to connect

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

After DNS is configured:

1. Restart the Docker services:
   ```bash
   docker compose down
   docker compose up -d
   ```

2. Update the Matrix client configuration to use the new domain

3. Test connectivity from your web app

4. Verify Matrix federation works (optional)