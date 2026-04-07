#!/bin/bash
# Usage: ./scripts/setup-ssl.sh yourdomain.com
DOMAIN=$1
if [ -z "$DOMAIN" ]; then echo "Usage: ./setup-ssl.sh yourdomain.com"; exit 1; fi

# Install certbot
sudo dnf install -y certbot
# Get cert (standalone mode - stop nginx first)
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod stop nginx
sudo certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod start nginx

echo "SSL cert obtained. Update nginx.conf to use it, then restart nginx."
echo "Cert: /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo "Key: /etc/letsencrypt/live/$DOMAIN/privkey.pem"
