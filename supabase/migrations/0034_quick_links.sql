alter table public.schools
  add column if not exists quick_links text[] not null default array[
    'fees_owing', 'send_reminder', 'generate_report_cards', 'register_student'
  ];
