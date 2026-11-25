create table public."user" (
  id text primary key, name text not null check (char_length(name) between 1 and 32),
  email text not null unique, "emailVerified" boolean not null default false, image text,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now()
);
create table public.session (
  id text primary key, "expiresAt" timestamptz not null, token text not null unique,
  "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now(),
  "ipAddress" text, "userAgent" text, "userId" text not null references public."user"(id) on delete cascade
);
create index on public.session ("userId");
create table public.account (
  id text primary key, "accountId" text not null, "providerId" text not null,
  "userId" text not null references public."user"(id) on delete cascade,
  "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz, scope text, password text,
  "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now(),
  unique ("providerId", "accountId")
);
create index on public.account ("userId");
create table public.verification (
  id text primary key, identifier text not null, value text not null, "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(), "updatedAt" timestamptz not null default now()
);
create index on public.verification (identifier);
create table public."rateLimit" (id text primary key, key text not null unique, count integer not null, "lastRequest" bigint not null);
revoke all on public."user", public.session, public.account, public.verification, public."rateLimit" from public;
