-- Reserve the editorial identity even when no draft has been published yet.
alter table public."user"
  add constraint reserved_editorial_identity check (
    (username <> 'lyj_editorial' and btrim(name) <> '另有解编辑部' and lower(email) <> 'editorial@lingyoujie.invalid')
    or (id = 'lyj-editorial' and username = 'lyj_editorial' and name = '另有解编辑部'
        and email = 'editorial@lingyoujie.invalid' and not "emailVerified")
  );
