# Production Checklist

A comprehensive checklist for deploying BetterBase applications to production.

## Pre-Deployment

### Code Review

- [ ] All features implemented and tested
- [ ] No TODO comments in production code
- [ ] Code follows project conventions
- [ ] No hardcoded secrets or credentials

### Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] End-to-end tests pass
- [ ] Performance tests completed

### Dependencies

- [ ] All dependencies up to date
- [ ] No security vulnerabilities in dependencies
- [ ] Lockfiles committed

## Database

### Schema

- [ ] All migrations applied
- [ ] Indexes created for frequently queried columns
- [ ] Foreign key constraints in place

### Security

- [ ] RLS enabled on all tables
- [ ] RLS policies tested
- [ ] Database credentials rotated

### Backup

- [ ] Automated backups configured
- [ ] Backup restoration tested
- [ ] Backup retention policy defined

## Configuration

### Environment Variables

- [ ] `DATABASE_URL` set
- [ ] `AUTH_SECRET` set (minimum 32 characters)
- [ ] `AUTH_URL` set to production URL
- [ ] `NODE_ENV` set to `production`
- [ ] CORS origins configured

### Storage

- [ ] Storage provider configured
- [ ] Bucket created and accessible
- [ ] Storage policies defined

### Features

- [ ] GraphQL enabled (if needed)
- [ ] Realtime configured (if needed)
- [ ] Webhooks configured (if needed)

## Security

### Authentication

- [ ] Strong AUTH_SECRET generated
- [ ] Session expiry configured
- [ ] MFA available for admin accounts

### API Security

- [ ] Rate limiting configured
- [ ] Request size limits set
- [ ] CORS properly configured

### SSL/TLS

- [ ] HTTPS enabled
- [ ] Valid certificates installed
- [ ] HTTP redirect to HTTPS

### Data Protection

- [ ] Sensitive data encrypted at rest
- [ ] API keys rotated regularly
- [ ] Webhook secrets rotated

## Monitoring

### Logging

- [ ] Application logs configured
- [ ] Error tracking setup
- [ ] Log retention policy defined

### Metrics

- [ ] Response time monitoring
- [ ] Error rate monitoring
- [ ] Resource usage monitoring

### Alerts

- [ ] Error alerts configured
- [ ] Performance alerts configured
- [ ] Uptime monitoring configured

## Performance

### Database

- [ ] Connection pool configured
- [ ] Slow query logging enabled
- [ ] Query optimization completed

### Caching

- [ ] Caching strategy defined
- [ ] CDN configured for static assets

### Scaling

- [ ] Horizontal scaling tested
- [ ] Load balancing configured

## Deployment

### Build

- [ ] Production build succeeds
- [ ] No build warnings
- [ ] Bundle size optimized

### Process

- [ ] Health check endpoint working
- [ ] Graceful shutdown configured
- [ ] Zero-downtime deployment tested

### Rollback

- [ ] Rollback procedure documented
- [ ] Rollback tested

## Operations

### Documentation

- [ ] API documentation updated
- [ ] Runbook created
- [ ] On-call procedures documented

### Support

- [ ] Support contacts defined
- [ ] Incident response plan in place
- [ ] Communication channels established

## Post-Deployment

### Verification

- [ ] Health check passing
- [ ] Authentication working
- [ ] Database connections stable

### Monitoring

- [ ] No new errors in logs
- [ ] Performance metrics normal
- [ ] No alerts triggered

### Testing

- [ ] Smoke tests pass
- [ ] Critical user flows work
- [ ] Security tests pass

## Quick Reference

### Essential Commands

```bash
# Check health
curl https://your-domain.com/health

# Check logs
bb function logs my-function

# Rollback migration
bb migrate rollback

# Check RLS
bb rls list
```

### Environment Template

```bash
# Required
DATABASE_URL=postgresql://...
AUTH_SECRET=your-32-char-secret-min
AUTH_URL=https://...

# Optional
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com
STORAGE_PROVIDER=s3
```

## Related

- [Deployment](./deployment.md) - Deployment guides
- [Monitoring](./monitoring.md) - Setup monitoring
- [Security Best Practices](./security-best-practices.md) - Security hardening
