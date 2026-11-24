-- =====================================================================
-- MãoCerta • Schema completo (Supabase / Postgres)
-- Este arquivo é IDEMPOTENTE: pode ser executado várias vezes no
-- SQL Editor do Supabase, inclusive por cima de uma versão anterior.
-- =====================================================================

-- 1. EXTENSÕES
create extension if not exists "uuid-ossp";

-- =====================================================================
-- 2. TABELAS
-- =====================================================================

-- Perfis (clientes, profissionais e admin)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role text not null default 'client' check (role in ('client', 'pro', 'admin')),
  phone_whatsapp text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Detalhes do profissional (vitrine)
create table if not exists public.pro_details (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  slug text unique not null,
  business_name text not null,
  bio text,
  plan_tier text not null default 'pro' check (plan_tier in ('free', 'pro')),
  plan_expires_at timestamptz default (now() + interval '60 days'),
  highlight_expires_at timestamptz,
  is_verified boolean default false,
  is_active boolean default true,
  avg_rating numeric(2,1) default 0.0,
  reviews_count integer default 0,
  updated_at timestamptz default now()
);

-- Zonas e bairros (Ouro Preto sede + distritos)
create table if not exists public.zones (
  id serial primary key,
  city text not null default 'Ouro Preto',
  zone_group text not null,
  name text not null unique
);

-- Profissional <-> zonas atendidas
create table if not exists public.pro_zones (
  pro_id uuid references public.pro_details(user_id) on delete cascade,
  zone_id integer references public.zones(id) on delete cascade,
  extra_fee_note text,
  primary key (pro_id, zone_id)
);

-- Serviços
create table if not exists public.services (
  id uuid default uuid_generate_v4() primary key,
  pro_id uuid references public.pro_details(user_id) on delete cascade not null,
  category text not null check (category in ('obras_manutencao', 'beleza_estetica')),
  subcategory text not null,
  title text not null,
  description text,
  pricing_type text not null check (pricing_type in ('fixed', 'starting_at', 'quote')),
  price_value numeric(10,2),
  service_location text not null default 'client_site' check (service_location in ('client_site', 'pro_studio', 'both')),
  created_at timestamptz default now()
);

-- Portfólio
create table if not exists public.portfolio_items (
  id uuid default uuid_generate_v4() primary key,
  pro_id uuid references public.pro_details(user_id) on delete cascade not null,
  image_url text not null,
  caption text,
  created_at timestamptz default now()
);

-- Pedidos de orçamento / agendamento
create table if not exists public.service_requests (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.profiles(id) on delete cascade not null,
  pro_id uuid references public.pro_details(user_id) on delete cascade not null,
  service_id uuid references public.services(id) on delete set null,
  zone_id integer references public.zones(id) on delete set null,
  description text not null,
  preferred_shift text not null default 'esta_semana',
  photo_url text,
  status text not null default 'pending' check (status in ('pending', 'negotiating', 'completed', 'canceled')),
  created_at timestamptz default now()
);
alter table public.service_requests add column if not exists updated_at timestamptz default now();

-- Avaliações
create table if not exists public.reviews (
  id uuid default uuid_generate_v4() primary key,
  request_id uuid references public.service_requests(id) on delete cascade unique not null,
  client_id uuid references public.profiles(id) on delete cascade not null,
  pro_id uuid references public.pro_details(user_id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now()
);
-- Primeiro nome do autor (evita expor o perfil completo do cliente publicamente)
alter table public.reviews add column if not exists author_name text;

-- ---------------------------------------------------------------------
-- AGENDA (serviços de beleza: atendimento somente no estabelecimento)
-- ---------------------------------------------------------------------
create extension if not exists btree_gist;

-- Endereço do estabelecimento e intervalo da grade de horários
alter table public.pro_details add column if not exists business_address text;
alter table public.pro_details add column if not exists slot_interval_minutes integer not null default 30;
alter table public.pro_details drop constraint if exists pro_details_slot_interval_check;
alter table public.pro_details add constraint pro_details_slot_interval_check
  check (slot_interval_minutes in (15, 30, 45, 60));

-- Duração de cada serviço (usada para calcular os horários livres)
alter table public.services add column if not exists duration_minutes integer not null default 60;
alter table public.services drop constraint if exists services_duration_check;
alter table public.services add constraint services_duration_check check (duration_minutes between 15 and 480);

-- Novo status "confirmed" (horário confirmado pelo profissional)
alter table public.service_requests drop constraint if exists service_requests_status_check;
alter table public.service_requests add constraint service_requests_status_check
  check (status in ('pending', 'negotiating', 'confirmed', 'completed', 'canceled'));

-- Horário de atendimento semanal (0 = domingo ... 6 = sábado)
create table if not exists public.pro_availability (
  id uuid default uuid_generate_v4() primary key,
  pro_id uuid references public.pro_details(user_id) on delete cascade not null,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);

-- Dias de folga / fechado
create table if not exists public.pro_time_off (
  pro_id uuid references public.pro_details(user_id) on delete cascade,
  day date not null,
  reason text,
  primary key (pro_id, day)
);

-- Horários marcados (client_id nulo = horário bloqueado manualmente pelo profissional)
create table if not exists public.appointments (
  id uuid default uuid_generate_v4() primary key,
  pro_id uuid references public.pro_details(user_id) on delete cascade not null,
  client_id uuid references public.profiles(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  request_id uuid references public.service_requests(id) on delete cascade unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'booked' check (status in ('booked', 'canceled')),
  note text,
  created_at timestamptz default now(),
  check (ends_at > starts_at),
  -- Impede dois agendamentos no mesmo horário, mesmo com cliques simultâneos
  constraint appointments_no_overlap exclude using gist (
    pro_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'booked')
);

-- ---------------------------------------------------------------------
-- VALIDAÇÃO DE DEMANDA: o que os moradores procuram e não encontram
-- ---------------------------------------------------------------------
create table if not exists public.demand_signals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  category text check (char_length(category) <= 60),
  zone_id integer references public.zones(id) on delete set null,
  search_text text check (char_length(search_text) <= 200),
  details text check (char_length(details) <= 500),
  contact_whatsapp text check (char_length(contact_whatsapp) <= 20),
  created_at timestamptz default now()
);

create index if not exists idx_availability_pro on public.pro_availability(pro_id, weekday);
create index if not exists idx_appointments_pro_time on public.appointments(pro_id, starts_at);
create index if not exists idx_appointments_client on public.appointments(client_id);

create index if not exists idx_services_pro on public.services(pro_id);
create index if not exists idx_portfolio_pro on public.portfolio_items(pro_id);
create index if not exists idx_requests_client on public.service_requests(client_id);
create index if not exists idx_requests_pro on public.service_requests(pro_id);
create index if not exists idx_reviews_pro on public.reviews(pro_id);

-- =====================================================================
-- 3. FUNÇÕES AUXILIARES
-- =====================================================================

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.slugify(txt text)
returns text
language sql immutable
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(coalesce(txt, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')),
    '[^a-z0-9]+', '-', 'g'));
$$;

-- Cria a vitrine (pro_details) com slug único
create or replace function public.create_pro_details(p_user_id uuid, p_name text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_slug text := coalesce(nullif(public.slugify(p_name), ''), 'profissional');
begin
  if exists (select 1 from public.pro_details where user_id = p_user_id) then
    return;
  end if;
  if exists (select 1 from public.pro_details where slug = v_slug) then
    v_slug := v_slug || '-' || substr(replace(p_user_id::text, '-', ''), 1, 6);
  end if;
  insert into public.pro_details (user_id, slug, business_name)
  values (p_user_id, v_slug, coalesce(nullif(trim(p_name), ''), 'Profissional'));
end;
$$;

-- Cria perfil a partir dos metadados enviados no cadastro
create or replace function public.create_profile_for(p_id uuid, p_email text, p_meta jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_role text := coalesce(p_meta->>'role', 'client');
  v_name text := coalesce(nullif(trim(p_meta->>'full_name'), ''), split_part(coalesce(p_email, ''), '@', 1), 'Usuário');
  v_phone text := nullif(regexp_replace(coalesce(p_meta->>'phone_whatsapp', ''), '\D', '', 'g'), '');
begin
  if v_role not in ('client', 'pro') then
    v_role := 'client'; -- nunca permitir criar admin pelo cadastro
  end if;

  insert into public.profiles (id, full_name, role, phone_whatsapp)
  values (p_id, v_name, v_role, v_phone)
  on conflict (id) do nothing;

  if v_role = 'pro' then
    perform public.create_pro_details(p_id, v_name);
  end if;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.create_profile_for(new.id, new.email, new.raw_user_meta_data);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill: usuários que se cadastraram antes do trigger existir
select public.create_profile_for(u.id, u.email, u.raw_user_meta_data)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Cliente que quer passar a oferecer serviços
create or replace function public.become_pro()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  select full_name into v_name from public.profiles where id = auth.uid();
  if v_name is null then
    raise exception 'Perfil não encontrado';
  end if;
  update public.profiles set role = 'pro' where id = auth.uid() and role = 'client';
  perform public.create_pro_details(auth.uid(), v_name);
  return (select slug from public.pro_details where user_id = auth.uid());
end;
$$;

-- Beleza e estética: atendimento sempre no estabelecimento do profissional
create or replace function public.enforce_service_rules()
returns trigger
language plpgsql
as $$
begin
  if new.category = 'beleza_estetica' then
    new.service_location := 'pro_studio';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_service_rules on public.services;
create trigger enforce_service_rules
before insert or update on public.services
for each row execute procedure public.enforce_service_rules();

update public.services set service_location = 'pro_studio'
where category = 'beleza_estetica' and service_location <> 'pro_studio';

-- Horários livres de um profissional para um serviço de p_duration minutos
-- (não expõe quem marcou, apenas os horários disponíveis)
create or replace function public.available_slots(
  p_pro_id uuid,
  p_duration integer,
  p_from date,
  p_days integer default 14
)
returns table (slot_start timestamptz)
language sql stable security definer set search_path = public
as $$
  with params as (
    select pd.slot_interval_minutes as step,
           greatest(coalesce(p_duration, 60), 15) as dur
    from public.pro_details pd
    where pd.user_id = p_pro_id and pd.is_active = true
  ),
  days as (
    select (p_from + i)::date as d
    from generate_series(0, least(greatest(coalesce(p_days, 14), 1), 60) - 1) as i
  ),
  windows as (
    select d.d, a.start_time, a.end_time
    from days d
    join public.pro_availability a
      on a.pro_id = p_pro_id and a.weekday = extract(dow from d.d)
    where not exists (
      select 1 from public.pro_time_off t where t.pro_id = p_pro_id and t.day = d.d
    )
  ),
  candidates as (
    select ((w.d + w.start_time) at time zone 'America/Sao_Paulo') + make_interval(mins => n * p.step) as s,
           ((w.d + w.end_time) at time zone 'America/Sao_Paulo') as window_end,
           p.dur
    from windows w
    cross join params p
    cross join lateral generate_series(
      0, floor(extract(epoch from (w.end_time - w.start_time)) / 60 / p.step)::int
    ) as n
  )
  select distinct c.s
  from candidates c
  where c.s + make_interval(mins => c.dur) <= c.window_end
    and c.s > now() + interval '30 minutes'
    and not exists (
      select 1 from public.appointments ap
      where ap.pro_id = p_pro_id
        and ap.status = 'booked'
        and tstzrange(ap.starts_at, ap.ends_at) && tstzrange(c.s, c.s + make_interval(mins => c.dur))
    )
  order by c.s;
$$;

-- Cliente agenda um horário: cria o pedido e reserva o horário de forma atômica
create or replace function public.book_appointment(
  p_service_id uuid,
  p_start timestamptz,
  p_note text default null,
  p_photo_url text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pro uuid;
  v_title text;
  v_duration integer;
  v_active boolean;
  v_request uuid;
begin
  if v_uid is null then
    raise exception 'Faça login para agendar.';
  end if;

  select s.pro_id, s.title, s.duration_minutes, pd.is_active
    into v_pro, v_title, v_duration, v_active
  from public.services s
  join public.pro_details pd on pd.user_id = s.pro_id
  where s.id = p_service_id;

  if v_pro is null or not v_active then
    raise exception 'Serviço indisponível.';
  end if;
  if v_pro = v_uid then
    raise exception 'Você não pode agendar um horário com você mesmo.';
  end if;
  if p_start > now() + interval '60 days' then
    raise exception 'Agendamentos podem ser feitos com até 60 dias de antecedência.';
  end if;
  -- Evita que uma única pessoa ocupe a agenda do profissional
  if (
    select count(*) from public.appointments ap
    where ap.client_id = v_uid and ap.pro_id = v_pro and ap.status = 'booked' and ap.starts_at > now()
  ) >= 3 then
    raise exception 'Você já tem 3 horários futuros com este profissional. Cancele um para marcar outro.';
  end if;

  if not exists (
    select 1
    from public.available_slots(v_pro, v_duration, (p_start at time zone 'America/Sao_Paulo')::date, 1) a
    where a.slot_start = p_start
  ) then
    raise exception 'Este horário não está mais disponível. Escolha outro.';
  end if;

  insert into public.service_requests (client_id, pro_id, service_id, description, preferred_shift, photo_url, status)
  values (
    v_uid, v_pro, p_service_id,
    coalesce(nullif(trim(p_note), ''), 'Agendamento: ' || v_title),
    'agendado', p_photo_url, 'pending'
  )
  returning id into v_request;

  insert into public.appointments (pro_id, client_id, service_id, request_id, starts_at, ends_at, note)
  values (v_pro, v_uid, p_service_id, v_request, p_start, p_start + make_interval(mins => v_duration), nullif(trim(p_note), ''));

  return v_request;
exception
  when exclusion_violation then
    raise exception 'Este horário acabou de ser reservado por outra pessoa. Escolha outro.';
end;
$$;

-- =====================================================================
-- 4. TRIGGERS DE PROTEÇÃO (impedem que usuários alterem campos sensíveis)
-- =====================================================================

-- Regra: alterações feitas diretamente pelo app (papéis anon/authenticated) não
-- podem mexer em campos sensíveis, exceto se o usuário for admin. Funções internas
-- (security definer) e o SQL Editor rodam como dono do banco e passam livremente.
create or replace function public.is_app_user()
returns boolean
language sql stable
as $$
  select current_user in ('anon', 'authenticated');
$$;

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_app_user() and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
before update on public.profiles
for each row execute procedure public.protect_profile_fields();

create or replace function public.protect_pro_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_app_user() and not public.is_admin() then
    new.slug := old.slug;
    new.plan_tier := old.plan_tier;
    new.plan_expires_at := old.plan_expires_at;
    new.highlight_expires_at := old.highlight_expires_at;
    new.is_verified := old.is_verified;
    new.is_active := old.is_active;
    new.avg_rating := old.avg_rating;
    new.reviews_count := old.reviews_count;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_pro_fields on public.pro_details;
create trigger protect_pro_fields
before update on public.pro_details
for each row execute procedure public.protect_pro_fields();

-- Pedidos: campos imutáveis e regras de mudança de status
create or replace function public.guard_request_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.client_id := old.client_id;
  new.pro_id := old.pro_id;
  new.service_id := old.service_id;
  new.zone_id := old.zone_id;
  new.description := old.description;
  new.preferred_shift := old.preferred_shift;
  new.photo_url := old.photo_url;
  new.created_at := old.created_at;
  new.updated_at := now();

  if public.is_app_user() and not public.is_admin() and new.status <> old.status then
    if old.status in ('completed', 'canceled') then
      raise exception 'Este pedido já foi encerrado.';
    end if;
    -- O cliente só pode cancelar ou confirmar que o serviço foi realizado
    if auth.uid() = old.client_id and new.status not in ('canceled', 'completed') then
      raise exception 'Status não permitido para o cliente.';
    end if;
    -- Serviço agendado só pode ser concluído depois do horário marcado
    if new.status = 'completed' and exists (
      select 1 from public.appointments ap
      where ap.request_id = old.id and ap.status = 'booked' and ap.starts_at > now()
    ) then
      raise exception 'O serviço só pode ser marcado como realizado após o horário agendado.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_request_update on public.service_requests;
create trigger guard_request_update
before update on public.service_requests
for each row execute procedure public.guard_request_update();

-- Pedido cancelado libera o horário na agenda
create or replace function public.sync_appointment_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'canceled' and old.status <> 'canceled' then
    update public.appointments set status = 'canceled' where request_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_appointment_status on public.service_requests;
create trigger sync_appointment_status
after update on public.service_requests
for each row execute procedure public.sync_appointment_status();

-- Avaliações: preenche o primeiro nome do autor
create or replace function public.fill_review_author()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  select split_part(full_name, ' ', 1) into new.author_name
  from public.profiles where id = new.client_id;
  return new;
end;
$$;

drop trigger if exists fill_review_author on public.reviews;
create trigger fill_review_author
before insert on public.reviews
for each row execute procedure public.fill_review_author();

-- Recalcula média de avaliações (insert e delete)
create or replace function public.update_pro_rating()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_pro uuid := coalesce(new.pro_id, old.pro_id);
begin
  update public.pro_details
  set
    avg_rating = (select coalesce(round(avg(rating)::numeric, 1), 0) from public.reviews where pro_id = v_pro),
    reviews_count = (select count(*) from public.reviews where pro_id = v_pro)
  where user_id = v_pro;
  return null;
end;
$$;

drop trigger if exists on_review_created on public.reviews;
drop trigger if exists on_review_changed on public.reviews;
create trigger on_review_changed
after insert or delete on public.reviews
for each row execute procedure public.update_pro_rating();

-- =====================================================================
-- 4b. VALIDAÇÕES E LIMITES CONTRA ABUSO
-- =====================================================================

-- Fotos só podem apontar para o bucket do projeto, dentro da pasta do próprio usuário
-- (impede links "javascript:", imagens de terceiros e uso de fotos de outra pessoa)
create or replace function public.is_own_media_url(p_url text, p_uid uuid)
returns boolean
language sql immutable
as $$
  select p_url is null
      or p_url ~ ('^https://[^/]+/storage/v1/object/public/maocerta-media/' || p_uid::text || '/[A-Za-z0-9_./-]+$');
$$;

create or replace function public.validate_media_urls()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_url text;
  v_old text;
  v_uid uuid;
begin
  if not public.is_app_user() then
    return new;
  end if;
  if tg_table_name = 'profiles' then
    v_url := new.avatar_url; v_uid := new.id;
    if tg_op = 'UPDATE' then v_old := old.avatar_url; end if;
  elsif tg_table_name = 'portfolio_items' then
    v_url := new.image_url; v_uid := new.pro_id;
    if tg_op = 'UPDATE' then v_old := old.image_url; end if;
  elsif tg_table_name = 'service_requests' then
    v_url := new.photo_url; v_uid := new.client_id;
    if tg_op = 'UPDATE' then v_old := old.photo_url; end if;
  end if;
  if (tg_op = 'INSERT' or v_url is distinct from v_old) and not public.is_own_media_url(v_url, v_uid) then
    raise exception 'Imagem inválida: envie a foto pelo próprio app.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_media_urls on public.profiles;
create trigger validate_media_urls before insert or update on public.profiles
for each row execute procedure public.validate_media_urls();
drop trigger if exists validate_media_urls on public.portfolio_items;
create trigger validate_media_urls before insert or update on public.portfolio_items
for each row execute procedure public.validate_media_urls();
drop trigger if exists validate_media_urls on public.service_requests;
create trigger validate_media_urls before insert or update on public.service_requests
for each row execute procedure public.validate_media_urls();

-- Limites de quantidade (evitam spam e estouro de armazenamento)
create or replace function public.enforce_quotas()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_table_name = 'service_requests' and auth.uid() is not null then
    if (select count(*) from public.service_requests
        where client_id = new.client_id and created_at > now() - interval '24 hours') >= 10 then
      raise exception 'Limite de 10 pedidos por dia atingido. Tente novamente amanhã.';
    end if;
    if (select count(*) from public.service_requests
        where client_id = new.client_id and pro_id = new.pro_id and status = 'pending') >= 3 then
      raise exception 'Você já tem pedidos aguardando resposta deste profissional.';
    end if;
  elsif tg_table_name = 'services' and auth.uid() is not null then
    if (select count(*) from public.services where pro_id = new.pro_id) >= 30 then
      raise exception 'Limite de 30 serviços por vitrine.';
    end if;
  elsif tg_table_name = 'portfolio_items' and auth.uid() is not null then
    if (select count(*) from public.portfolio_items where pro_id = new.pro_id) >= 60 then
      raise exception 'Limite de 60 fotos no portfólio. Remova alguma para adicionar outra.';
    end if;
  elsif tg_table_name = 'demand_signals' then
    if (select count(*) from public.demand_signals where created_at > now() - interval '10 minutes') >= 30 then
      raise exception 'Muitos envios no momento. Tente novamente em alguns minutos.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_quotas on public.service_requests;
create trigger enforce_quotas before insert on public.service_requests
for each row execute procedure public.enforce_quotas();
drop trigger if exists enforce_quotas on public.services;
create trigger enforce_quotas before insert on public.services
for each row execute procedure public.enforce_quotas();
drop trigger if exists enforce_quotas on public.portfolio_items;
create trigger enforce_quotas before insert on public.portfolio_items
for each row execute procedure public.enforce_quotas();
drop trigger if exists enforce_quotas on public.demand_signals;
create trigger enforce_quotas before insert on public.demand_signals
for each row execute procedure public.enforce_quotas();

-- Arquivos no storage por usuário
create or replace function public.storage_file_count(p_uid uuid)
returns integer
language sql stable security definer set search_path = public, storage
as $$
  select count(*)::int from storage.objects
  where bucket_id = 'maocerta-media' and (storage.foldername(name))[1] = p_uid::text;
$$;

-- Tamanho máximo dos textos (NOT VALID: não reprova dados antigos, vale para novos)
do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('profiles', 'profiles_full_name_len', 'char_length(full_name) <= 120'),
      ('pro_details', 'pro_details_business_name_len', 'char_length(business_name) <= 120'),
      ('pro_details', 'pro_details_bio_len', 'char_length(bio) <= 2000'),
      ('pro_details', 'pro_details_address_len', 'char_length(business_address) <= 200'),
      ('services', 'services_title_len', 'char_length(title) <= 120'),
      ('services', 'services_description_len', 'char_length(description) <= 1000'),
      ('services', 'services_price_range', 'price_value is null or (price_value > 0 and price_value <= 100000)'),
      ('service_requests', 'requests_description_len', 'char_length(description) <= 2000'),
      ('reviews', 'reviews_comment_len', 'char_length(comment) <= 1000'),
      ('appointments', 'appointments_note_len', 'char_length(note) <= 500'),
      ('portfolio_items', 'portfolio_caption_len', 'char_length(caption) <= 200')
    ) as t(tbl, name, expr)
  loop
    if not exists (select 1 from pg_constraint where conname = c.name) then
      execute format('alter table public.%I add constraint %I check (%s) not valid', c.tbl, c.name, c.expr);
    end if;
  end loop;
end;
$$;

-- LGPD: o próprio usuário exclui a conta e todos os dados vinculados
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and role = 'admin') then
    raise exception 'Contas de administrador não podem ser excluídas pelo app.';
  end if;
  -- Apaga em cascata: perfil, vitrine, serviços, portfólio, agenda, pedidos e avaliações
  delete from auth.users where id = v_uid;
end;
$$;

-- =====================================================================
-- 5. PERMISSÕES (necessárias em projetos Supabase novos)
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant insert on public.demand_signals to anon;
revoke execute on function public.create_profile_for(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.create_pro_details(uuid, text) from public, anon, authenticated;
grant execute on function public.become_pro() to authenticated;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke execute on function public.storage_file_count(uuid) from public, anon;
grant execute on function public.storage_file_count(uuid) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.available_slots(uuid, integer, date, integer) to anon, authenticated;
revoke execute on function public.book_appointment(uuid, timestamptz, text, text) from public, anon;
grant execute on function public.book_appointment(uuid, timestamptz, text, text) to authenticated;

-- =====================================================================
-- 6. ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.pro_details enable row level security;
alter table public.zones enable row level security;
alter table public.pro_zones enable row level security;
alter table public.services enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.service_requests enable row level security;
alter table public.reviews enable row level security;
alter table public.pro_availability enable row level security;
alter table public.pro_time_off enable row level security;
alter table public.appointments enable row level security;
alter table public.demand_signals enable row level security;

-- Remove políticas da versão anterior
drop policy if exists "Perfis básicos visíveis" on public.profiles;
drop policy if exists "Detalhes de profissionais ativos visíveis" on public.pro_details;
drop policy if exists "Zonas visíveis" on public.zones;
drop policy if exists "Zonas do pro visíveis" on public.pro_zones;
drop policy if exists "Serviços visíveis" on public.services;
drop policy if exists "Portfólio visível" on public.portfolio_items;
drop policy if exists "Avaliações visíveis" on public.reviews;
drop policy if exists "Usuário edita próprio perfil" on public.profiles;
drop policy if exists "Pro edita próprios detalhes" on public.pro_details;
drop policy if exists "Pro gerencia suas zonas" on public.pro_zones;
drop policy if exists "Pro gerencia seus serviços" on public.services;
drop policy if exists "Pro gerencia seu portfólio" on public.portfolio_items;
drop policy if exists "Cliente e Pro veem seus pedidos" on public.service_requests;
drop policy if exists "Cliente cria pedido" on public.service_requests;
drop policy if exists "Cliente ou Pro atualizam status do pedido" on public.service_requests;
drop policy if exists "Cliente avalia seu próprio pedido" on public.reviews;

-- Remove políticas desta versão (para permitir reexecução)
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
drop policy if exists "pro_details_select" on public.pro_details;
drop policy if exists "pro_details_update" on public.pro_details;
drop policy if exists "zones_select" on public.zones;
drop policy if exists "pro_zones_select" on public.pro_zones;
drop policy if exists "pro_zones_write" on public.pro_zones;
drop policy if exists "services_select" on public.services;
drop policy if exists "services_write" on public.services;
drop policy if exists "portfolio_select" on public.portfolio_items;
drop policy if exists "portfolio_write" on public.portfolio_items;
drop policy if exists "requests_select" on public.service_requests;
drop policy if exists "requests_insert" on public.service_requests;
drop policy if exists "requests_update" on public.service_requests;
drop policy if exists "reviews_select" on public.reviews;
drop policy if exists "reviews_insert" on public.reviews;
drop policy if exists "reviews_delete" on public.reviews;
drop policy if exists "availability_select" on public.pro_availability;
drop policy if exists "availability_write" on public.pro_availability;
drop policy if exists "time_off_select" on public.pro_time_off;
drop policy if exists "time_off_write" on public.pro_time_off;
drop policy if exists "appointments_select" on public.appointments;
drop policy if exists "appointments_insert_block" on public.appointments;
drop policy if exists "appointments_update" on public.appointments;
drop policy if exists "appointments_delete_block" on public.appointments;
drop policy if exists "demand_insert" on public.demand_signals;
drop policy if exists "demand_admin" on public.demand_signals;

-- PERFIS: profissionais são públicos; clientes só visíveis para si,
-- para o admin e para profissionais com quem abriram pedido (LGPD).
create policy "profiles_select" on public.profiles for select using (
  role = 'pro'
  or exists (select 1 from public.pro_details pd where pd.user_id = profiles.id)
  or id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.service_requests sr
    where sr.client_id = profiles.id and sr.pro_id = auth.uid()
  )
);
create policy "profiles_update" on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- VITRINE DO PROFISSIONAL (criação apenas via trigger/RPC)
create policy "pro_details_select" on public.pro_details for select
  using (is_active = true or user_id = auth.uid() or public.is_admin());
create policy "pro_details_update" on public.pro_details for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ZONAS
create policy "zones_select" on public.zones for select using (true);
create policy "pro_zones_select" on public.pro_zones for select using (true);
create policy "pro_zones_write" on public.pro_zones for all
  using (pro_id = auth.uid() or public.is_admin())
  with check (pro_id = auth.uid() or public.is_admin());

-- SERVIÇOS
create policy "services_select" on public.services for select using (true);
create policy "services_write" on public.services for all
  using (pro_id = auth.uid() or public.is_admin())
  with check (pro_id = auth.uid() or public.is_admin());

-- PORTFÓLIO
create policy "portfolio_select" on public.portfolio_items for select using (true);
create policy "portfolio_write" on public.portfolio_items for all
  using (pro_id = auth.uid() or public.is_admin())
  with check (pro_id = auth.uid() or public.is_admin());

-- PEDIDOS
create policy "requests_select" on public.service_requests for select
  using (client_id = auth.uid() or pro_id = auth.uid() or public.is_admin());
create policy "requests_insert" on public.service_requests for insert
  with check (client_id = auth.uid() and client_id <> pro_id and status = 'pending');
create policy "requests_update" on public.service_requests for update
  using (client_id = auth.uid() or pro_id = auth.uid() or public.is_admin());

-- AVALIAÇÕES: só o cliente do pedido, após o serviço concluído
create policy "reviews_select" on public.reviews for select using (true);
create policy "reviews_insert" on public.reviews for insert with check (
  client_id = auth.uid()
  and exists (
    select 1 from public.service_requests sr
    where sr.id = reviews.request_id
      and sr.client_id = auth.uid()
      and sr.pro_id = reviews.pro_id
      and sr.status = 'completed'
  )
);
create policy "reviews_delete" on public.reviews for delete using (public.is_admin());

-- AGENDA: horário de funcionamento é público; folgas e agendamentos não.
-- Clientes reservam horários apenas pela função book_appointment().
create policy "availability_select" on public.pro_availability for select using (true);
create policy "availability_write" on public.pro_availability for all
  using (pro_id = auth.uid() or public.is_admin())
  with check (pro_id = auth.uid() or public.is_admin());

create policy "time_off_select" on public.pro_time_off for select
  using (pro_id = auth.uid() or public.is_admin());
create policy "time_off_write" on public.pro_time_off for all
  using (pro_id = auth.uid() or public.is_admin())
  with check (pro_id = auth.uid() or public.is_admin());

create policy "appointments_select" on public.appointments for select
  using (pro_id = auth.uid() or client_id = auth.uid() or public.is_admin());
-- Profissional bloqueia horários manualmente (sem cliente vinculado)
create policy "appointments_insert_block" on public.appointments for insert
  with check (pro_id = auth.uid() and client_id is null and request_id is null);
create policy "appointments_update" on public.appointments for update
  using (pro_id = auth.uid() or public.is_admin());
create policy "appointments_delete_block" on public.appointments for delete
  using ((pro_id = auth.uid() and client_id is null) or public.is_admin());

-- DEMANDA: qualquer visitante registra; só o admin lê
create policy "demand_insert" on public.demand_signals for insert
  with check (user_id is null or user_id = auth.uid());
create policy "demand_admin" on public.demand_signals for all
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- 7. STORAGE (fotos de perfil, portfólio e pedidos)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('maocerta-media', 'maocerta-media', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "maocerta_upload_own_folder" on storage.objects;
drop policy if exists "maocerta_delete_own_folder" on storage.objects;

-- Cada usuário só envia/apaga arquivos dentro da pasta com o próprio id
create policy "maocerta_upload_own_folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'maocerta-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.storage_file_count(auth.uid()) < 200
  );
create policy "maocerta_delete_own_folder" on storage.objects for delete to authenticated
  using (bucket_id = 'maocerta-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- 8. SEED: BAIRROS E DISTRITOS DE OURO PRETO
-- =====================================================================
insert into public.zones (zone_group, name) values
('Zona 1 - Sede (Centro e Próximos)', 'Centro Histórico'),
('Zona 1 - Sede (Centro e Próximos)', 'Antônio Dias'),
('Zona 1 - Sede (Centro e Próximos)', 'Pilar'),
('Zona 1 - Sede (Centro e Próximos)', 'Barra'),
('Zona 1 - Sede (Centro e Próximos)', 'Água Limpa'),
('Zona 1 - Sede (Centro e Próximos)', 'Cabeças'),
('Zona 1 - Sede (Centro e Próximos)', 'Rosário'),
('Zona 1 - Sede (Centro e Próximos)', 'São Cristóvão'),
('Zona 1 - Sede (Centro e Próximos)', 'Veloso'),
('Zona 1 - Sede (Centro e Próximos)', 'Morro São Sebastião'),
('Zona 2 - Sede (Eixo UFOP / Industrial)', 'Bauxita'),
('Zona 2 - Sede (Eixo UFOP / Industrial)', 'Vila Itacolomy'),
('Zona 2 - Sede (Eixo UFOP / Industrial)', 'Saramenha'),
('Zona 2 - Sede (Eixo UFOP / Industrial)', 'Lagoa'),
('Zona 2 - Sede (Eixo UFOP / Industrial)', 'Tavares / Pocinho'),
('Zona 2 - Sede (Eixo UFOP / Industrial)', 'Padre Faria'),
('Zona 2 - Sede (Eixo UFOP / Industrial)', 'Taquaral'),
('Zona 2 - Sede (Eixo UFOP / Industrial)', 'Alto da Cruz'),
('Zona 3 - Distritos (Eixo BR-356)', 'Cachoeira do Campo'),
('Zona 3 - Distritos (Eixo BR-356)', 'Amarantina'),
('Zona 3 - Distritos (Eixo BR-356)', 'Glaura'),
('Zona 3 - Distritos (Eixo BR-356)', 'São Bartolomeu'),
('Zona 4 - Distritos (Leste / Sul)', 'Antônio Pereira'),
('Zona 4 - Distritos (Leste / Sul)', 'Lavras Novas'),
('Zona 4 - Distritos (Leste / Sul)', 'Santa Rita de Ouro Preto'),
('Zona 4 - Distritos (Leste / Sul)', 'Rodrigo Silva'),
('Zona 4 - Distritos (Leste / Sul)', 'Santo Antônio do Salto'),
('Zona 4 - Distritos (Leste / Sul)', 'Miguel Burnier / Eng. Corrêa')
on conflict (name) do nothing;

-- =====================================================================
-- 9. PRIMEIRO ADMINISTRADOR (execute manualmente, trocando o e-mail)
-- update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'seu-email@exemplo.com');
-- =====================================================================
