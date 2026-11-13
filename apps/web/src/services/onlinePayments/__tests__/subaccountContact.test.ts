import { describe, expect, it } from "vitest";
import { buildCommercialInfoUpdate } from "../subaccountContact";

/**
 * Topo da fatura do parceiro (13/11/2026): telefone e endereco de Configuracoes
 * seguem para os dados comerciais da subconta; o resto fica como esta la.
 */
const current = {
  status: "APPROVED",
  personType: "FISICA",
  cpfCnpj: "00000000000",
  name: "Titular",
  birthDate: "1990-01-01",
  companyName: null,
  incomeValue: 5000,
  email: "financeiro@exemplo.com",
  phone: null,
  mobilePhone: "11987654321",
  postalCode: "69041000",
  address: "Rua Antiga",
  addressNumber: "10",
  complement: "Sala 2",
  province: "Centro",
  city: { name: "Manaus" },
};

const address = {
  postalCode: "69041-010",
  street: "Avenida do Turismo",
  number: "13331",
  complement: "",
  neighborhood: "Tarumã",
  city: "Manaus",
  state: "AM",
};

describe("dados da fatura no parceiro", () => {
  it("troca so o telefone e o endereco, guardando documento, nascimento, renda e e-mail", () => {
    const { payload, changed } = buildCommercialInfoUpdate(current, { phone: "+5592986224953", address });
    expect(changed.sort()).toEqual(["address", "addressNumber", "complement", "mobilePhone", "postalCode", "province"]);
    expect(payload).toMatchObject({
      personType: "FISICA",
      cpfCnpj: "00000000000",
      birthDate: "1990-01-01",
      incomeValue: 5000,
      email: "financeiro@exemplo.com",
      mobilePhone: "92986224953",
      postalCode: "69041010",
      address: "Avenida do Turismo",
      addressNumber: "13331",
      complement: "",
      province: "Tarumã",
    });
    // So o que o parceiro aceita no envio: nem situacao, nem nome, nem cidade, nem campo vazio.
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("name");
    expect(payload).not.toHaveProperty("city");
    expect(payload).not.toHaveProperty("companyName");
  });

  it("telefone fixo vai em phone, e o celular de la fica", () => {
    const { payload, changed } = buildCommercialInfoUpdate(current, { phone: "+559232345678" });
    expect(changed).toEqual(["phone"]);
    expect(payload).toMatchObject({ phone: "9232345678", mobilePhone: "11987654321" });
  });

  it("nada mudou, nada a enviar; endereco incompleto ou telefone de fora nao mexem no que esta la", () => {
    expect(buildCommercialInfoUpdate(current, { phone: "+5511987654321" }).changed).toEqual([]);
    expect(buildCommercialInfoUpdate(current, { address: { ...address, number: "" } }).changed).toEqual([]);
    expect(buildCommercialInfoUpdate(current, { phone: "+14155550123" }).changed).toEqual([]);
  });
});
