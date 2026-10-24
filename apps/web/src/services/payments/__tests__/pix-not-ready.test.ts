import { beforeEach, describe, expect, it, vi } from "vitest";
import { isApiError } from "@gestarahub/contracts";

// Achado 56 do teste geral: logo depois de ativar a conta de recebimento, o
// Asaas cria a cobranca mas ainda nao entrega o QR do Pix (sem chave Pix).
// A cobranca nao pode ficar orfa no parceiro, a mensagem tem de ser clara e a
// conta real nunca recebe um Pix de demonstracao.

const asaas = vi.hoisted(() => ({
  createOrFindCustomer: vi.fn(),
  createPixPayment: vi.fn(),
  getPixQrCode: vi.fn(),
  deletePayment: vi.fn(),
}));
const actions = vi.hoisted(() => ({
  createOnlinePixPaymentAction: vi.fn(),
  createOnlineLinkPaymentAction: vi.fn(),
}));

vi.mock("@/lib/asaas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/asaas")>()),
  ...asaas,
  getAsaasConfig: () => ({ masterWalletId: undefined }),
}));
vi.mock("../../onlinePayments/actions", () => actions);

const { AsaasApiError } = await import("@/lib/asaas");
const { asaasPaymentGateway } = await import("../adapters/asaasAdapter");
const { paymentGateway } = await import("../paymentGateway");
const { PIX_NOT_READY, PIX_NOT_READY_MESSAGE, PixNotReadyError } = await import("../types");

const input = {
  chargeId: "charge-1",
  amountCents: 15000,
  expiresInMinutes: 1440,
  studentId: "student-1",
  studentName: "Aluno Teste",
  studentCpf: "00000000000",
  subaccountApiKey: "chave-da-subconta",
};

const noPixKey = () =>
  new AsaasApiError("Você não possui uma chave Pix cadastrada para recebimentos de cobranças via Pix.", 400, [
    { code: "invalid_action", description: "Você não possui uma chave Pix cadastrada para recebimentos de cobranças via Pix." },
  ]);

beforeEach(() => {
  vi.clearAllMocks();
  asaas.createOrFindCustomer.mockResolvedValue({ id: "cus_1" });
  asaas.createPixPayment.mockResolvedValue({ id: "pay_1" });
  asaas.deletePayment.mockResolvedValue({ deleted: true, id: "pay_1" });
});

describe("Asaas: Pix sem QR logo depois de ativar a conta", () => {
  it("cancela a cobrança no parceiro e avisa que o Pix ainda está liberando", async () => {
    asaas.getPixQrCode.mockRejectedValue(noPixKey());
    await expect(asaasPaymentGateway.createPix(input)).rejects.toBeInstanceOf(PixNotReadyError);
    expect(asaas.deletePayment).toHaveBeenCalledWith("pay_1", "chave-da-subconta");
  });

  it("outro erro do QR também cancela a cobrança, e o erro segue como veio", async () => {
    const other = new AsaasApiError("Falha no parceiro", 500);
    asaas.getPixQrCode.mockRejectedValue(other);
    await expect(asaasPaymentGateway.createPix(input)).rejects.toBe(other);
    expect(asaas.deletePayment).toHaveBeenCalledWith("pay_1", "chave-da-subconta");
  });

  it("com o QR, nada é cancelado", async () => {
    asaas.getPixQrCode.mockResolvedValue({ payload: "000201pix" });
    const pix = await asaasPaymentGateway.createPix(input);
    expect(pix.pixCopyPaste).toBe("000201pix");
    expect(asaas.deletePayment).not.toHaveBeenCalled();
  });
});

describe("fachada: conta real nunca cai no Pix de demonstração", () => {
  it("Pix ainda não liberado vira a mensagem clara, mesmo na demonstração", async () => {
    actions.createOnlinePixPaymentAction.mockResolvedValue({ error: PIX_NOT_READY_MESSAGE, reason: PIX_NOT_READY });
    for (const allowDemo of [false, true]) {
      const error = await paymentGateway.createPix(input, { allowDemo }).catch((e: unknown) => e);
      expect(isApiError(error) && error.message).toBe(PIX_NOT_READY_MESSAGE);
    }
  });

  it("falha do parceiro numa conta real dá erro, sem código de demonstração", async () => {
    actions.createOnlinePixPaymentAction.mockResolvedValue({ error: "Falha no parceiro" });
    const error = await paymentGateway.createPix(input, { allowDemo: false }).catch((e: unknown) => e);
    expect(isApiError(error)).toBe(true);
  });

  it("o espaço de demonstração segue com o Pix de demonstração", async () => {
    actions.createOnlinePixPaymentAction.mockResolvedValue({ error: "Sem chave do parceiro" });
    const pix = await paymentGateway.createPix(input, { allowDemo: true });
    expect(pix.provider).toBe("mock");
  });
});
