#!/bin/bash

##############################################################################
# JESUS CRISTO BOT - AUTOMATED DEPLOYMENT SCRIPT
#
# Usage: ./deployment/deploy.sh [options]
#
# Options:
#   --app <app-name>      Scalingo app name (required)
#   --env <env-file>      Environment file with variables (optional)
#   --force              Skip confirmation prompts
#   --dry-run            Show what would be deployed without doing it
#   --monitor            Watch logs after deployment
#   --rollback           Rollback to previous version
#   --health             Check health only, don't deploy
#
# Example:
#   ./deployment/deploy.sh --app jesus-bot-prod --env .env.production
#   ./deployment/deploy.sh --app jesus-bot-prod --monitor
#   ./deployment/deploy.sh --app jesus-bot-prod --rollback
##############################################################################

set -e

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SCALINGO_APP=""
ENV_FILE=""
FORCE_DEPLOY=false
DRY_RUN=false
MONITOR_LOGS=false
ROLLBACK_MODE=false
HEALTH_CHECK_ONLY=false
DEPLOY_BRANCH="main"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════════
# FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

confirm() {
    if [ "$FORCE_DEPLOY" = true ]; then
        return 0
    fi

    local prompt="$1"
    local response

    read -p "$(echo -e ${YELLOW}$prompt ${NC})" response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check if git is available
    if ! command -v git &> /dev/null; then
        print_error "git not found. Please install git."
        exit 1
    fi
    print_success "git found"

    # Check if scalingo CLI is available
    if ! command -v scalingo &> /dev/null; then
        print_error "scalingo CLI not found. Install with: npm install -g scalingo"
        exit 1
    fi
    print_success "scalingo CLI found"

    # Check if we're in a git repo
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        exit 1
    fi
    print_success "In git repository"

    # Check if Scalingo app name provided
    if [ -z "$SCALINGO_APP" ]; then
        print_error "Scalingo app name required (use --app <name>)"
        exit 1
    fi
    print_success "Scalingo app: $SCALINGO_APP"

    # Check if app exists in Scalingo
    if ! scalingo -a "$SCALINGO_APP" ps &> /dev/null; then
        print_error "Scalingo app '$SCALINGO_APP' not found or not accessible"
        exit 1
    fi
    print_success "Scalingo app accessible"
}

validate_code() {
    print_header "Validating Code"

    # Check git status
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "Uncommitted changes detected:"
        git status --short
        if ! confirm "Continue with uncommitted changes? (y/n): "; then
            print_error "Deployment cancelled"
            exit 1
        fi
    else
        print_success "Working directory clean"
    fi

    # Check if tests pass
    if [ -f "$PROJECT_ROOT/package.json" ]; then
        if grep -q '"test"' "$PROJECT_ROOT/package.json"; then
            print_info "Running tests..."
            if npm test; then
                print_success "Tests passed"
            else
                print_warning "Tests failed"
                if ! confirm "Continue despite test failures? (y/n): "; then
                    print_error "Deployment cancelled"
                    exit 1
                fi
            fi
        fi
    fi
}

check_health() {
    print_header "Checking Current Health"

    local health_url="https://${SCALINGO_APP}.osc-fr1.scalingo.io/health"
    local response=""

    print_info "Checking: $health_url"

    if response=$(curl -s -m 5 "$health_url"); then
        print_success "Health check responded:"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        return 0
    else
        print_warning "Health check failed or endpoint not responding"
        return 1
    fi
}

set_environment_variables() {
    print_header "Setting Environment Variables"

    if [ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ]; then
        print_info "Loading variables from: $ENV_FILE"

        local vars=""
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            [[ "$key" =~ ^[[:space:]]*# ]] && continue
            [[ -z "$key" ]] && continue

            # Remove quotes and whitespace
            key=$(echo "$key" | xargs)
            value=$(echo "$value" | xargs | sed 's/^"//;s/"$//')

            vars="$vars $key=\"$value\""
        done < "$ENV_FILE"

        if [ -z "$DRY_RUN" ]; then
            if eval scalingo -a "$SCALINGO_APP" env-set $vars; then
                print_success "Environment variables updated"
            else
                print_error "Failed to set environment variables"
                exit 1
            fi
        else
            print_info "[DRY RUN] Would set: $vars"
        fi
    else
        print_info "No environment file specified, skipping env setup"
    fi
}

deploy_code() {
    print_header "Deploying Code"

    print_info "Current branch: $(git rev-parse --abbrev-ref HEAD)"
    print_info "Latest commit: $(git log -1 --oneline)"

    if ! confirm "Deploy this commit to $SCALINGO_APP? (y/n): "; then
        print_error "Deployment cancelled"
        exit 1
    fi

    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would run: git push scalingo $DEPLOY_BRANCH"
        return 0
    fi

    print_info "Pushing to Scalingo (this may take a few minutes)..."
    if git push scalingo "$DEPLOY_BRANCH"; then
        print_success "Code deployed successfully"
    else
        print_error "Deployment failed"
        exit 1
    fi
}

monitor_deployment() {
    print_header "Monitoring Deployment"

    print_info "Watching logs... (press Ctrl+C to stop)"
    scalingo -a "$SCALINGO_APP" logs --stream | grep -v "^$" &
    local log_pid=$!

    print_info "Waiting for app to be healthy..."
    local attempts=0
    local max_attempts=30

    while [ $attempts -lt $max_attempts ]; do
        sleep 5

        if curl -s -m 2 "https://${SCALINGO_APP}.osc-fr1.scalingo.io/health" &>/dev/null; then
            print_success "App is healthy!"
            kill $log_pid 2>/dev/null || true
            return 0
        fi

        attempts=$((attempts + 1))
        print_info "Waiting... ($attempts/$max_attempts)"
    done

    print_error "App failed to become healthy within timeout"
    kill $log_pid 2>/dev/null || true
    return 1
}

rollback_deployment() {
    print_header "Rolling Back Deployment"

    print_warning "This will revert to the previous git commit"
    print_info "Current commit: $(git log -1 --oneline)"
    print_info "Will revert to: $(git log -2 --oneline | tail -1)"

    if ! confirm "Proceed with rollback? (y/n): "; then
        print_error "Rollback cancelled"
        return 0
    fi

    if git revert --no-edit HEAD; then
        print_success "Reverted to previous commit"

        if [ "$DRY_RUN" = true ]; then
            print_info "[DRY RUN] Would push: git push scalingo $DEPLOY_BRANCH"
        else
            if git push scalingo "$DEPLOY_BRANCH"; then
                print_success "Rollback deployed"
                monitor_deployment
            else
                print_error "Rollback push failed"
                exit 1
            fi
        fi
    else
        print_error "Revert failed"
        exit 1
    fi
}

run_database_checks() {
    print_header "Database Checks"

    # Check PostgreSQL
    print_info "Checking PostgreSQL..."
    if scalingo -a "$SCALINGO_APP" env | grep SCALINGO_POSTGRESQL_URL > /dev/null; then
        print_success "PostgreSQL add-on detected"
    else
        print_warning "PostgreSQL add-on not found"
    fi

    # Check MongoDB
    print_info "Checking MongoDB..."
    if scalingo -a "$SCALINGO_APP" env | grep SCALINGO_MONGO_URL > /dev/null; then
        print_success "MongoDB add-on detected"
    else
        print_warning "MongoDB add-on not found"
    fi

    # Check Redis
    print_info "Checking Redis..."
    if scalingo -a "$SCALINGO_APP" env | grep SCALINGO_REDIS_URL > /dev/null; then
        print_success "Redis add-on detected"
    else
        print_warning "Redis add-on not detected (optional)"
    fi
}

print_summary() {
    print_header "Deployment Summary"

    echo "App: $SCALINGO_APP"
    echo "Branch: $DEPLOY_BRANCH"
    echo "Commit: $(git log -1 --oneline)"
    echo "Timestamp: $(date)"
}

# ═══════════════════════════════════════════════════════════════════════════
# PARSE ARGUMENTS
# ═══════════════════════════════════════════════════════════════════════════

while [[ $# -gt 0 ]]; do
    case $1 in
        --app)
            SCALINGO_APP="$2"
            shift 2
            ;;
        --env)
            ENV_FILE="$2"
            shift 2
            ;;
        --force)
            FORCE_DEPLOY=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --monitor)
            MONITOR_LOGS=true
            shift
            ;;
        --rollback)
            ROLLBACK_MODE=true
            shift
            ;;
        --health)
            HEALTH_CHECK_ONLY=true
            shift
            ;;
        --branch)
            DEPLOY_BRANCH="$2"
            shift 2
            ;;
        --help)
            grep '^#' "$0" | grep -E '^\s*#\s' | sed 's/^#\s*//' | head -20
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ═══════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${GREEN}"
cat << "EOF"

   JESUS CRISTO BOT - Deployment Automation
   ╔═══════════════════════════════════════╗
   ║      Production Deploy Manager        ║
   ╚═══════════════════════════════════════╝

EOF
echo -e "${NC}"

check_prerequisites

if [ "$HEALTH_CHECK_ONLY" = true ]; then
    check_health
    exit 0
fi

if [ "$ROLLBACK_MODE" = true ]; then
    check_health
    rollback_deployment
    check_health
    print_summary
    exit 0
fi

# Standard deployment flow
validate_code
set_environment_variables
run_database_checks

print_header "Ready to Deploy"
print_info "App: $SCALINGO_APP"
print_info "Branch: $DEPLOY_BRANCH"
print_info "Dry Run: $DRY_RUN"

if [ "$DRY_RUN" = true ]; then
    print_warning "Running in DRY RUN mode - no changes will be made"
fi

deploy_code

if [ "$DRY_RUN" = false ]; then
    if [ "$MONITOR_LOGS" = true ] || confirm "Monitor deployment? (y/n): "; then
        monitor_deployment
    fi

    print_header "Post-Deployment"
    check_health
    run_database_checks
fi

print_summary
print_success "Deployment completed!"

# ═══════════════════════════════════════════════════════════════════════════
# END SCRIPT
# ═══════════════════════════════════════════════════════════════════════════
