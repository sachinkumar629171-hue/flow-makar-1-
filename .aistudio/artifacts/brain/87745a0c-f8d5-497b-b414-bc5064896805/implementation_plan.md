# Plan to Fix Supabase Database Schema Error

The error `Could not find the 'last_active' column of 'users' in the schema cache` indicates that your Supabase database table `users` is missing this required column.

### Step 1: Execute SQL in Supabase SQL Editor
Please log in to your Supabase project dashboard, navigate to the **SQL Editor**, and run the following command to add the missing column:

```sql
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE;
```

### Step 2: Verify and Add Other Required Columns
To ensure no further errors occur, you should also ensure other critical columns exist. Run this query as well:

```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS session_token TEXT;
```

### Step 3: Refresh Schema Cache
After running the SQL commands:
1. Go to your Supabase **Project Settings** -> **Database**.
2. Click **Reload API schema** (or simply restart/re-deploy your applet) to ensure Supabase recognizes the new columns.

### Step 4: Verification
Once completed, please try to log in again. The application should now be able to successfully query and update the `last_active` column, resolving the `FUNCTION_INVOCATION_FAILED` and session termination errors.
