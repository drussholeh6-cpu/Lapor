create table if not exists complaints (
  code text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger complaints_set_updated_at
before update on complaints
for each row
execute function set_updated_at();
