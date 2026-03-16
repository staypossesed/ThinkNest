-- Pro plan: 70 requests per day (was 500/month)
update plans set max_questions = 70, period_type = 'daily' where code = 'pro';
