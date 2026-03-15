# Praxis Security Documentation

## 🔐 Security Audit Checklist

### ✅ Implemented

1. **Rate Limiting**
   - Auth endpoints: 5 attempts per 15 minutes
   - AI endpoints: 10 requests per minute
   - Axiom briefs: 3 regenerations per hour
   - Payments/Admin: 10 operations per 15 minutes
   - General API: 100 requests per minute

2. **CORS Restrictions**
   - Only allowed origins can access API
   - Production domains: praxis-webapp.vercel.app, praxis.app
   - Credentials enabled for authenticated requests

3. **Request Tracing**
   - Every request gets a unique trace ID
   - Structured logging with context
   - Request/response logging for debugging

4. **Service Role Key Protection**
   - Security audit runs on startup
   - Warns if service key is misconfigured
   - Never expose service key to client

### ⚠️ Action Required

1. **Environment Variables**
   ```bash
   # Verify these are set correctly in production:
   SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Must start with eyJ (JWT)
   SUPABASE_PUBLISHABLE_KEY=sb_...    # Can start with sb_
   ADMIN_SECRET=<strong-random-secret>
   ```

2. **Database Security**
   - Enable RLS on ALL tables
   - Review policies for public access
   - Audit user permissions regularly

3. **API Keys**
   - Rotate Gemini API keys periodically
   - Use separate keys for development/production
   - Monitor API usage for anomalies

4. **Payment Security**
   - Use Stripe webhooks for payment verification
   - Never trust client-side payment status
   - Implement idempotency for payment operations

## 📊 Monitoring

### Logs to Watch

```bash
# Rate limit violations
grep "Rate limit exceeded" logs/combined.log

# Authentication failures
grep "Authentication failed" logs/combined.log

# Payment errors
grep "Stripe.*error" logs/combined.log

# AI cost monitoring
grep "AI.*request" logs/combined.log
```

### Alerts to Configure

1. **High rate limit violations** (> 100/hour from single IP)
2. **Multiple auth failures** (> 10 from single user)
3. **Payment failures** (> 5 in 10 minutes)
4. **AI cost spike** (> 1000 requests/hour)

## 🔒 Best Practices

### For Developers

1. **Never commit .env files**
2. **Use environment variables for secrets**
3. **Validate all user input**
4. **Use parameterized queries (Supabase handles this)**
5. **Log security-relevant events**

### For Admins

1. **Review admin actions regularly**
2. **Rotate admin secrets periodically**
3. **Monitor user reports for abuse**
4. **Keep dependencies updated**

## 🚨 Incident Response

### If Service Key is Compromised

1. **Immediately rotate the key in Supabase dashboard**
2. **Update environment variables**
3. **Restart all services (Railway, Vercel)**
4. **Review logs for unauthorized access**
5. **Notify affected users if necessary**

### If Rate Limiting is Bypassed

1. **Check for proxy/VPN usage**
2. **Implement IP-based blocking at CDN level**
3. **Consider CAPTCHA for repeated offenders**
4. **Review and strengthen rate limit rules**

## 📝 Compliance Notes

- **GDPR**: User data export/deletion endpoints needed
- **Stripe PCI**: Handled by Stripe (we're SAQ-A compliant)
- **Data Retention**: Define and implement retention policies
