# shellcheck shell=bash
# Settings of the server environments, not secret. Sourced by the deploy scripts (bash), never run.
# Secrets of each environment are in .env inside its folder on the server.
#
#   prod     https://app.vprodcrm.ru       /srv/personal-crm          backup before every deploy
#   staging  https://test-app.vprodcrm.ru  /srv/personal-crm-staging  no backups, data copied from prod
#
# Each environment has its own folder with its own copy of deploy/, .env and release.env, and its
# own docker compose project named after the environment (-p prod, -p staging).

ENVIRONMENTS=(prod staging)

# Sets DEPLOY_ENV, APP_DIR, PUBLIC_URL, APP_PORT and BACKUP (yes/no) for the environment $1.
load_environment() {
  DEPLOY_ENV="$1"
  case "$DEPLOY_ENV" in
    prod)
      APP_DIR=/srv/personal-crm
      PUBLIC_URL=https://app.vprodcrm.ru
      APP_PORT=3000
      BACKUP=yes
      ;;
    staging)
      APP_DIR=/srv/personal-crm-staging
      PUBLIC_URL=https://test-app.vprodcrm.ru
      APP_PORT=3001
      BACKUP=no
      ;;
    *)
      echo "Unknown environment \"$DEPLOY_ENV\": expected one of ${ENVIRONMENTS[*]}." >&2
      return 1
      ;;
  esac
}

# Loads the settings of the environment whose folder is $1 (the scripts pass their own folder).
load_environment_of_dir() {
  local env
  for env in "${ENVIRONMENTS[@]}"; do
    load_environment "$env"
    if [[ "$APP_DIR" == "$1" ]]; then return 0; fi
  done
  echo "$1 is not the folder of any environment (see environments.sh)." >&2
  return 1
}
