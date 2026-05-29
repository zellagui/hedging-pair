# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Supabase Configuration

- [ ] Database migration applied (`supabase/migrations/20260529001208_initial_schema.sql`)
- [ ] Authentication → URL Configuration:
  - Site URL: `https://your-domain.com`
  - Redirect URLs: `https://your-domain.com/auth/confirm`
- [ ] Verify RLS policies are enabled on all tables

### 2. Vercel Environment Variables

Set in Vercel Dashboard → Settings → Environment Variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_anon_or_publishable_key
```

### 3. Manual Testing (15 min)

1. **Login flow**
   - Sign up with new test account
   - Verify email confirmation works
   - Log in successfully

2. **Data isolation**
   - Create workspace, challenge, trade
   - Log out, log in with different account
   - Verify no data leakage between accounts

3. **Data persistence**
   - Edit a trade note
   - Reload page → change persists
   - Clear browser cache and reload → still persists

4. **Protected routes**
   - Log out
   - Try to access `/` or `/challenges`
   - Should redirect to `/auth/login`

### 4. Deploy

```bash
git add .
git commit -m "Production ready: Supabase migration complete"
git push origin main
```

Vercel will auto-deploy if connected to your repo.

## Known Limitations

- **Data Hub import via UI:** Now saves to database; legacy memory-only import removed
- **Legacy sync features:** Vercel Blob and CSV folder sync are deprecated but still functional
- **No automated E2E tests:** Manual QA recommended before each release

## Troubleshooting

### Users report empty journal after login

1. Check Supabase logs for RLS policy violations
2. Verify `user_id` matches between auth and data tables
3. Test with `psql` using service role key to verify data exists

### Email confirmation not working

1. Check Supabase → Authentication → URL Configuration
2. Verify Site URL matches production domain exactly
3. Check email templates in Supabase dashboard

### Slow page loads

1. Check Supabase project region vs Vercel deployment region
2. Consider connection pooling for high traffic
3. Monitor query performance in Supabase dashboard

### Data Hub import fails

1. Check browser console for network errors
2. Verify user is logged in (401 Unauthorized)
3. Check Supabase logs for migration errors
4. Validate JSON backup file format

### Migration API returns errors

Common issues:
- **Invalid JSON:** Check backup file format with JSON validator
- **Duplicate data:** Migration uses upsert, should handle duplicates gracefully
- **RLS violations:** Ensure user is authenticated and has proper permissions
- **Foreign key violations:** Check for orphaned records in backup data

## Performance Optimization

### Database

- Monitor query performance in Supabase Dashboard
- Add indexes for frequently queried columns if needed
- Consider connection pooling for high traffic

### Frontend

- Enable Vercel Edge Runtime where applicable
- Use Vercel's Image Optimization for any images
- Monitor Core Web Vitals in Vercel Analytics

## Security Checklist

- [ ] RLS policies enabled on all tables
- [ ] Service role key not exposed in client environment
- [ ] Auth redirect URLs configured for production domain
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] No sensitive data in client-side JavaScript bundles

## Monitoring

### Supabase

- Set up alerts for high error rates
- Monitor database connection count
- Track API usage and quotas

### Vercel

- Enable Vercel Analytics
- Monitor function execution time and errors
- Set up deployment notifications

## Rollback Plan

If issues occur after deployment:

1. **Revert code:** Use Vercel's instant rollback feature
2. **Database:** Supabase automatically backs up data; restore from backup if needed
3. **DNS:** Point domain back to previous deployment if using custom domain

## Scaling Considerations

### Database

- Supabase free tier: 500MB storage, 2 CPU hours
- Upgrade to Pro plan before reaching limits
- Consider read replicas for high read traffic

### Vercel

- Free tier: 100GB bandwidth, 1000 serverless function invocations
- Upgrade to Pro for higher limits and better performance

## Support

For issues:

1. Check Supabase Dashboard logs
2. Check Vercel Function logs
3. Review browser console errors
4. Test with service role key to isolate RLS issues