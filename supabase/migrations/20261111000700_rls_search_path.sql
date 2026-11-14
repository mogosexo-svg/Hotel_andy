-- Hotel Andy · advisor de seguridad: privado.rls (ayudante de migraciones) quedó sin search_path fijo.
alter function privado.rls(text, text, text) set search_path = '';
