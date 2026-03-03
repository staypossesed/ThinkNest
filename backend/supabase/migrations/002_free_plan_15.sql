-- Update free plan max_questions to 15 (if plans table is used)
update plans set max_questions = 15 where code = 'free';
