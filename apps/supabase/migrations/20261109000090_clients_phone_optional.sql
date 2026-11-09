-- Migration: 20261109000090_clients_phone_optional.
-- Telefone do aluno opcional (09/11/2026): o aluno experimental entra na aula
-- so com o nome e completa o cadastro depois. Sem telefone, nada de WhatsApp
-- ate preencher (a ficha mostra "Falta telefone · Completar cadastro").
alter table public.clients alter column phone drop not null;
