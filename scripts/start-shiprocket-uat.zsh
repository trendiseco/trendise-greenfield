#!/bin/zsh
set -e
cd "${0:A:h:h}"

export SHIPROCKET_RATE_ENV=${1:-sandbox}
if [[ "$SHIPROCKET_RATE_ENV" != sandbox && "$SHIPROCKET_RATE_ENV" != production ]]; then
  printf '%s\n' 'Use sandbox or production as the lookup environment.' >&2
  exit 1
fi

IFS= read -rs 'db_password?Mumbai Supabase database password: '
printf '\n'
IFS= read -r 'SHIPROCKET_API_EMAIL?Shiprocket API user email: '
IFS= read -rs 'SHIPROCKET_API_PASSWORD?Shiprocket API user password: '
printf '\n'
if [[ -z "$db_password" || -z "$SHIPROCKET_API_EMAIL" || -z "$SHIPROCKET_API_PASSWORD" ]]; then
  printf '%s\n' 'All three entries are required.' >&2
  exit 1
fi

cert_dir=$(mktemp -d)
trap 'rm -f "$cert_dir/supabase-ca.crt"; rmdir "$cert_dir"' EXIT
curl -fsS 'https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt' -o "$cert_dir/supabase-ca.crt"

db_encoded=$(TRENDISE_DB_PASSWORD="$db_password" node -p 'encodeURIComponent(process.env.TRENDISE_DB_PASSWORD)')
ca_encoded=$(TRENDISE_CA_FILE="$cert_dir/supabase-ca.crt" node -p 'encodeURIComponent(process.env.TRENDISE_CA_FILE)')
export DATABASE_URL="postgresql://postgres.lddnaqffzszqvhxgxjje:${db_encoded}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=verify-full&sslrootcert=${ca_encoded}"
unset db_password db_encoded

export SHIPROCKET_API_EMAIL SHIPROCKET_API_PASSWORD
export SHIPROCKET_RATE_LOOKUP=true SHIPROCKET_PICKUP_PIN=501505
export TRENDISE_ENV=development MOCK_ONLY=true
export API_PORT=4100 NEXT_PUBLIC_API_BASE='http://localhost:4100'
npm run dev
