# 14 — Documentação do Asaas por MCP (consulta pela IA)

> **Status:** 21/10/2026. Guia de uso. O Asaas publica a documentação da API como um servidor MCP; qualquer assistente (Claude Code, Claude Desktop, Codex, Cursor, Antigravity, VS Code) pode consultá-la direto, sem copiar e colar a doc no prompt.

## O que é

O servidor `https://docs.asaas.com/mcp` expõe a documentação e a especificação OpenAPI do Asaas pelo protocolo MCP (transporte **HTTP streamable**, sem autenticação para consulta). Testado em 21/10/2026: o `initialize` responde `Asaas - Documentação API`, versão 3, protocolo `2025-06-18`.

Ferramentas que ele oferece:

| Ferramenta | Para quê |
|---|---|
| `search` | busca nos guias; devolve id, título e URL |
| `fetch` | conteúdo de um guia pelo id do `search` |
| `list-specs` | as especificações OpenAPI disponíveis |
| `list-endpoints` | todos os caminhos e métodos da API, com resumo |
| `search-endpoints` | busca por endpoint, parâmetro ou capacidade |
| `get-endpoint` | detalhe de um endpoint: parâmetros, esquemas, segurança, servidores |
| `execute-request` | executa uma requisição HAR contra a API (**não usar aqui**, ver regra abaixo) |

Há também o índice em texto `https://docs.asaas.com/llms.txt`, que serve para ferramentas sem MCP.

## Regra do projeto

- **Só consulta.** Use o MCP para ler a documentação, descobrir endpoints e conferir esquemas. **Não** use `execute-request`: ele precisaria da chave de API no prompt, e chave nunca vai em prompt, log, PR ou memória de agente. Chamada real ao Asaas é feita pelo código em `apps/web/src/services/payments/` (porta `paymentGateway.ts`, adaptador `adapters/asaasAdapter.ts`) com as variáveis `ASAAS_*` do `.env.local`, e o webhook em `app/api/webhooks/asaas/route.ts`.
- **Sandbox primeiro.** O código usa `ASAAS_API_URL=https://sandbox.asaas.com/api/v3` em desenvolvimento. A doc do MCP é a mesma para sandbox e produção.
- A IA pode errar ao ler a doc. Confira na resposta a URL da página citada antes de implementar.
- Versão da doc: `https://docs.asaas.com/mcp?branch=<nome>` aponta para uma branch específica da documentação, se um dia precisarmos.

## Como conectar

O servidor é público, então a configuração pode ficar no repositório. As três primeiras já estão commitadas.

### Claude Code (já configurado)

`.mcp.json` na raiz do repositório:

```json
{
  "mcpServers": {
    "asaas": {
      "type": "http",
      "url": "https://docs.asaas.com/mcp"
    }
  }
}
```

Ao abrir o projeto, o Claude Code pergunta se aceita o servidor do projeto. Para configurar só na sua conta, fora do repositório:

```bash
claude mcp add --transport http --scope user asaas https://docs.asaas.com/mcp
```

### Cursor (já configurado)

`.cursor/mcp.json` no projeto (ou `~/.cursor/mcp.json` para todos os projetos):

```json
{
  "mcpServers": {
    "asaas": {
      "url": "https://docs.asaas.com/mcp"
    }
  }
}
```

### VS Code com Copilot (já configurado)

`.vscode/mcp.json` no projeto:

```json
{
  "servers": {
    "asaas": {
      "type": "http",
      "url": "https://docs.asaas.com/mcp"
    }
  }
}
```

### Antigravity

Antigravity não lê o `.mcp.json` do projeto. Abra o painel **MCP Servers** > **View raw config** (o arquivo fica em `~/.gemini/antigravity/mcp_config.json`) e adicione. Atenção: a chave é `serverUrl`, não `url`.

```json
{
  "mcpServers": {
    "asaas": {
      "serverUrl": "https://docs.asaas.com/mcp"
    }
  }
}
```

### Codex (OpenAI)

Em `~/.codex/config.toml`:

```toml
[mcp_servers.asaas]
url = "https://docs.asaas.com/mcp"
```

### Claude Desktop

Configurações > Conectores > **Adicionar conector personalizado**, com a URL `https://docs.asaas.com/mcp`. Não pede login.

## Como conferir se funcionou

Peça ao assistente: "Pelo MCP do Asaas, qual é o endpoint para criar uma cobrança Pix e quais campos são obrigatórios?". A resposta certa cita `POST /v3/payments` com `billingType: "PIX"` e a URL da página da doc. Se a ferramenta não aparecer, o servidor não foi carregado: no Claude Code, `/mcp` mostra o estado.

## Fontes

- [Asaas: MCP Server](https://docs.asaas.com/docs/mcp-1)
- [Asaas: índice llms.txt](https://docs.asaas.com/llms.txt)
- Antigravity usa `serverUrl` para servidores remotos: [guia do GitHub MCP para Antigravity](https://glama.ai/mcp/servers/@github/github-mcp-server/blob/bf6467855c13d3b8f5cf72f8dfd9c86f8336b20b/docs/installation-guides/install-antigravity.md), [SurrealDB: Antigravity](https://surrealdb.com/docs/agent-memory/integrations/mcp-server/coding-assistants/antigravity.md)
- Codex usa `~/.codex/config.toml`: [React Spectrum: MCP Server](https://react-spectrum.adobe.com/mcp)
