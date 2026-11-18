-- Lembrete de evento com texto maior (17/11/2026). A Meta recusou o modelo
-- event_reminder: 5 variaveis numa frase curta passam do limite de variaveis
-- por palavra (erro 100, subcodigo 2388293). So troca o texto de quem ainda
-- usa o padrao antigo; texto editado pelo espaco fica como esta.
update public.message_templates
set content = 'Oi, {aluno}! Passando para lembrar que amanhã tem {evento} na {empresa}, {dia} às {horario}. Chegue alguns minutos antes para começarmos no horário. Te esperamos!',
    updated_at = now()
where trigger = 'event_reminder'
  and content = 'Oi, {aluno}! Amanhã tem {evento} na {empresa}, {dia} às {horario}. Te esperamos!';
