-- Supabase SQL setup for Student Helpdesk Bot

create table if not exists student_conversations (
  id bigserial primary key,
  session_id text not null,
  source text not null default 'kommunicate',
  intent_name text,
  user_message text,
  bot_response text,
  course_code text,
  confidence numeric,
  created_at timestamp with time zone default now()
);

create index if not exists idx_student_conversations_created_at
on student_conversations(created_at desc);

create table if not exists student_queries (
  id bigserial primary key,
  student_name text not null,
  student_email text not null,
  course_code text not null,
  query_text text not null,
  source text not null default 'kommunicate',
  status text not null default 'open',
  created_at timestamp with time zone default now()
);

create index if not exists idx_student_queries_status
on student_queries(status);

create index if not exists idx_student_queries_created_at
on student_queries(created_at desc);
