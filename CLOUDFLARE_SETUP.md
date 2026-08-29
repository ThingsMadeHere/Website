# Cloudflare Configuration for mchsrobotics.dev

Your domain is now on Cloudflare, which is excellent for production! Here's how to configure it properly for your Matrix server.

## Current Status
- **Domain**: mchsrobotics.dev
- **Server IP**: 98.248.24.208
- **Cloudflare Status**: Active (pointing to Cloudflare IPs)

## Cloudflare DNS Configuration

### Step 1: Update DNS Records in Cloudflare Dashboard

1. Go to Cloudflare Dashboard → DNS → Records
2. Update the A record to point to your server:

```
Type: A
Name: @ (or mchsrobotics.dev)
IPv4 address: 98.248.24.208
Proxy status: Proxied (Orange cloud) ← IMPORTANT for SSL
TTL: Auto
```

3. Add CNAME for www (optional):
```
Type: CNAME
Name: www
Target: mchsrobotics.dev
Proxy status: Proxied (Orange cloud)
TTL: Auto
```

### Step 2: Configure SSL/TLS Settings

1. Go to SSL/TLS → Overview
2. Set SSL/TLS encryption mode to **"Full"** (recommended for now)
   - **Full**: Cloudflare to origin is encrypted but origin certificate can be self-signed
   - **Full Strict**: Requires valid SSL certificate on origin (recommended for production)

For now, use **"Full"** mode since Caddy will handle SSL.

### Step 3: Configure Cloudflare for Matrix

Matrix federation requires special handling in Cloudflare:

#### Option A: Grey Cloud Matrix Federation Port (Recommended)
Create a separate DNS record for Matrix federation:

```
Type: A
Name: matrix-federation (or _matrix)
IPv4 address: 98.248.24.208
Proxy status: DNS only (Grey cloud) ← IMPORTANT
TTL: Auto
```

#### Option B: Use Cloudflare API for Matrix (Advanced)
Cloudflare can proxy Matrix traffic but requires additional configuration.

### Step 4: Update Caddyfile for Cloudflare

Since you're using Cloudflare, update the Caddyfile to work behind it:

```caddyfile
# Cloudflare configuration
mchsrobotics.dev {
    # Trust Cloudflare's IPs
    trusted_proxies 173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 172.64.0.0/13 131.0.72.0/22
    
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

# Federation port (if using grey cloud approach)
matrix-federation.mchsrobotics.dev:8448 {
    reverse_proxy dendrite:8008
}
```

### Step 5: Update Docker Compose for Cloudflare

Update `docker-compose.yml` to use standard ports:

```yaml
caddy:
  image: caddy:latest
  container_name: mchs-caddy
  restart: unless-stopped
  ports:
    - "80:80"    # Cloudflare will proxy this
    - "443:443"  # Cloudflare will proxy this
    - "8448:8448" # Federation port
  volumes:
    - ./caddy_data:/data
    - ./caddy_config:/config
    - ./Caddyfile:/etc/caddy/Caddyfile
  networks:
    - matrix
  environment:
    - ACME_AGREE=true
```

### Step 6: Update Matrix Configuration

**dendrite-config/dendrite.yaml:**
```yaml
server_name: mchsrobotics.dev
```

**src/config/matrix.js:**
```javascript
export const matrixConfig = {
  homeserverUrl: 'https://mchsrobotics.dev',
  userId: '@mchs_robotics:mchsrobotics.dev',
  accessToken: 'NEW_TOKEN', // Will need to recreate user
  roomId: '!rV5ADbihXBvRfYTe:mchsrobotics.dev',
};
```

### Step 7: Update Caddyfile

Replace the current Caddyfile with the Cloudflare-compatible version.

## Important Cloudflare Settings for Matrix

### Page Rules (Optional but Recommended)
Create these page rules in Cloudflare:

1. **Disable Caching for Matrix API:**
   - Pattern: `mchsrobotics.dev/_matrix/*`
   - Settings: Cache Level: Bypass

2. **Disable Rocket Loader for Matrix:**
   - Pattern: `mchsrobotics.dev/_matrix/*`
   - Settings: Rocket Loader: Off

### Security Settings
- **Firewall Rules**: Consider adding rate limiting for Matrix endpoints
- **Bot Fight Mode**: Can interfere with Matrix federation, consider disabling
- **Security Level**: Set to "Medium" or "Low" to avoid blocking legitimate Matrix traffic

## Migration Steps

1. **Update Cloudflare DNS** (as described above)
2. **Wait for DNS propagation** (usually minutes with Cloudflare)
3. **Update configuration files** on your server
4. **Restart Docker services**
5. **Recreate Matrix user** with new domain
6. **Test connectivity**

## Testing Cloudflare Configuration

### Test DNS Resolution
```bash
dig mchsrobotics.dev
# Should return Cloudflare IPs
```

### Test SSL
```bash
curl -I https://mchsrobotics.dev
# Should return 200/301/302 with Cloudflare headers
```

### Test Matrix Well-Known
```bash
curl https://mchsrobotics.dev/.well-known/matrix/server
curl https://mchsrobotics.dev/.well-known/matrix/client
```

## Advantages of Cloudflare

1. **DDoS Protection**: Cloudflare provides excellent DDoS protection
2. **SSL Termination**: Handles SSL efficiently
3. **CDN**: Caches static content globally
4. **Performance**: Fast DNS resolution and global network
5. **Security**: Web Application Firewall (WAF)

## Potential Issues and Solutions

### Matrix Federation Issues
If federation doesn't work:
- Use the grey cloud approach for federation port
- Check Cloudflare firewall rules
- Verify SSL certificate is valid

### Certificate Issues
If SSL certificate errors occur:
- Set Cloudflare SSL mode to "Full" (not Full Strict)
- Check Caddy logs for certificate errors
- Ensure ports 80/443 are accessible

### Performance Issues
If Matrix performance is slow:
- Disable Cloudflare caching for Matrix endpoints
- Check Cloudflare analytics for bottlenecks
- Consider using Cloudflare's Argo Smart Routing

## Rollback Plan

If Cloudflare causes issues, you can:
1. Set DNS record to "DNS only" (grey cloud)
2. This bypasses Cloudflare proxy
3. Your server will handle traffic directly
4. SSL will still work via Caddy