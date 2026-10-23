"use client";

import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

/**
 * QR Code do Pix desenhado a partir do copia e cola: o QR e so o desenho desse
 * texto (o app do banco le o mesmo conteudo). Por isso o banco guarda so o
 * copia e cola, nunca a imagem. SVG: nitido em qualquer tela e na impressao.
 */
export function PixQrCode({ value, className }: { value: string; className?: string }) {
  return (
    <QRCodeSVG
      value={value}
      level="M"
      marginSize={0}
      bgColor="#ffffff"
      fgColor="#000000"
      role="img"
      aria-label="QR Code do Pix"
      className={cn("h-auto w-full", className)}
    />
  );
}
