#!/usr/bin/env sh
# Wrapper so `npm run db:*` works without touching the user's shell profile.
#
# Docker Desktop on macOS only symlinks its CLI into /usr/local/bin if you let
# it prompt for an admin password. Skip that and the binary sits under $HOME,
# and its socket lives under $HOME too rather than at /var/run/docker.sock.
# The Supabase CLI needs both: it talks to the socket AND shells out to `docker`.
set -e

if ! command -v docker >/dev/null 2>&1 && [ -x "$HOME/.docker/bin/docker" ]; then
  PATH="$HOME/.docker/bin:$PATH"
  export PATH
fi

if [ -z "$DOCKER_HOST" ] && [ ! -S /var/run/docker.sock ] && [ -S "$HOME/.docker/run/docker.sock" ]; then
  DOCKER_HOST="unix://$HOME/.docker/run/docker.sock"
  export DOCKER_HOST
fi

if [ -x ./node_modules/.bin/supabase ]; then
  exec ./node_modules/.bin/supabase "$@"
fi
exec npx --yes supabase "$@"
