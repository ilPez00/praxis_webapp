# Praxis — API & Infrastructure Costs

> ⚠️ **Note:** These are estimated costs. Replace with actual values from your provider dashboards.

## Monthly Infrastructure Costs

| Service           | Plan            | Monthly Cost | Notes                                |
| ----------------- | --------------- | ------------ | ------------------------------------ |
| **Supabase**      | [Your plan]     | ~$[X]        | Database, Auth, Storage, Realtime    |
| **Google Gemini** | Pay-as-you-go   | ~$[X]        | Scales with DAU and AI usage         |
| **Vercel**        | [Hobby/Pro]     | ~$[X]        | Frontend hosting + bandwidth         |
| **Railway**       | [Starter/Basic] | ~$[X]        | Backend hosting                      |
| **Resend**        | Pay-as-you-go   | ~$[X]        | Transactional emails (free: 100/day) |

## Total Base Cost

**~$[X]/month** (base infrastructure)

## Variable Costs by User Count

| DAU   | Gemini Cost | Email Cost | Total |
| ----- | ----------- | ---------- | ----- |
| 100   | ~$10/mo     | ~$5/mo     | ~$[X] |
| 500   | ~$50/mo     | ~$25/mo    | ~$[X] |
| 1,000 | ~$100/mo    | ~$50/mo    | ~$[X] |
| 5,000 | ~$500/mo    | ~$250/mo   | ~$[X] |

## Gemini API Breakdown

| Feature             | Requests/User/Month | Cost/1K Users |
| ------------------- | ------------------- | ------------- |
| Daily briefs        | 30                  | ~$3           |
| Weekly narratives   | 4                   | ~$0.40        |
| Matching embeddings | 10                  | ~$1           |
| Coaching queries    | 5                   | ~$0.50        |
| **Total**           | ~49                 | **~$5**       |

## Cost Optimization Tips

1. **Gemini**: Use `gemini-2.0-flash` for non-critical tasks (briefs, summaries)
2. **Supabase**: Stay on free tier until ~50K rows, then upgrade
3. **Resend**: Free tier sufficient for <100 users
4. **Vercel**: Hobby plan is free for personal projects
5. **Railway**: Use usage-based pricing, not flat-rate

## Revenue Margin

Assuming $10/mo Pro subscription:

| Users | MRR    | Infrastructure | Margin |
| ----- | ------ | -------------- | ------ |
| 10    | $100   | ~$20           | 80%    |
| 50    | $500   | ~$30           | 94%    |
| 100   | $1,000 | ~$50           | 95%    |
| 500   | $5,000 | ~$150          | 97%    |

**Praxis has excellent unit economics at scale.**
