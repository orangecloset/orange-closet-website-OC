import DOMPurify from "dompurify";
import type { RecentSale } from "../../data/store-types";
import { isEmptyHtml } from "../../lib/richText";

export type ReceiptProductContent = {
  sections?: { title: string; body: string }[];
};

export type ReceiptData = {
  storeName: string;
  logoUrl?: string;
  sale: RecentSale;
  productContent?: ReceiptProductContent;
};

const PT_PER_IN = 72;
const PX_PER_IN = 96;
const PX_TO_PT = PT_PER_IN / PX_PER_IN;
const A4_WIDTH_PT = 595.28;
const MARGIN_PT = PT_PER_IN;
const MARGIN_TOP_BOTTOM_PT = PT_PER_IN * 0.5;
const CONTENT_WIDTH_PT = A4_WIDTH_PT - MARGIN_PT * 2;
const CONTENT_WIDTH_PX = Math.round(CONTENT_WIDTH_PT / PX_TO_PT);

export function flexibleImageUrl(url?: string | null): string {
  return url ?? "";
}

export function parsePrice(price: string): number {
  const n = Number(String(price).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const RECEIPT_RICH_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "blockquote", "pre", "code", "hr", "a",
];

const RECEIPT_RICH_ATTR = ["href", "title", "target", "rel", "colspan", "rowspan"];

function renderSectionBody(text: string): string {
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: RECEIPT_RICH_TAGS,
    ALLOWED_ATTR: RECEIPT_RICH_ATTR,
  });
}

const RECEIPT_STYLES = `
  .receipt { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a1a1a; width: 100%; max-width: 100%; margin: 0 auto; padding: 0; }
  .receipt *, .receipt *::before, .receipt *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .header { display: flex; align-items: center; justify-content: center; gap: 14px; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
  .logo { width: 52px; height: 52px; object-fit: contain; flex-shrink: 0; }
  .header-text { display: flex; flex-direction: column; align-items: flex-start; }
  .store-name { font-size: 20px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .receipt-title { font-size: 13px; letter-spacing: 3px; text-transform: uppercase; margin-top: 4px; color: #444; }
  .receipt-no { font-size: 12px; margin-top: 6px; color: #666; }
  .product { display: flex; gap: 14px; padding: 16px 0; border-bottom: 1px solid #ddd; }
  .product img { width: 140px; height: 175px; object-fit: cover; border-radius: 4px; flex-shrink: 0; background: #f3f3f3; }
  .product-info { flex: 1; min-width: 0; }
  .product-name { font-size: 15px; font-weight: 600; }
  .product-meta { font-size: 12px; color: #555; margin-top: 4px; line-height: 1.6; }
  table.totals { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.totals td { padding: 4px 0; font-size: 13px; }
  table.totals tr.grand td { border-top: 1px solid #1a1a1a; padding-top: 8px; font-weight: 700; font-size: 15px; }
  table.details { width: 100%; border-collapse: collapse; padding: 12px 0; }
  table.details td { font-size: 12px; padding: 3px 0; vertical-align: top; }
  table.details td:first-child { color: #666; width: 150px; padding-right: 24px; }
  .section { padding: 12px 0; border-bottom: 1px solid #ddd; }
  .section-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #888; margin-bottom: 6px; }
  .content-desc { font-size: 12px; color: #333; line-height: 1.6; margin-bottom: 8px; }
  .content-desc p { margin: 2px 0; }
  .content-desc p:first-child { margin-top: 0; }
  .content-desc p:last-child { margin-bottom: 0; }
  .content-desc h1, .content-desc h2, .content-desc h3,
  .content-desc h4, .content-desc h5, .content-desc h6 {
    font-size: 12px; font-weight: 600; margin: 6px 0 2px;
  }
  .content-desc strong { font-weight: 600; }
  .content-desc em { font-style: italic; }
  .content-desc u { text-decoration: underline; }
  .content-desc s { text-decoration: line-through; }
  .content-desc ul { list-style: disc; padding-left: 18px; margin: 2px 0; }
  .content-desc ol { list-style: decimal; padding-left: 18px; margin: 2px 0; }
  .content-desc li { font-size: 12px; color: #333; line-height: 1.6; }
  .content-desc table { width: 100%; border-collapse: collapse; margin: 4px 0; }
  .content-desc td, .content-desc th {
    font-size: 12px; color: #333; padding: 3px 24px 3px 0;
    vertical-align: top; text-align: left;
  }
  .content-desc td:last-child, .content-desc th:last-child { padding-right: 0; }
  .content-desc td:first-child, .content-desc th:first-child {
    font-weight: 600; white-space: nowrap; width: 1%;
  }
  .content-desc a { color: #1a1a1a; text-decoration: underline; }
  .signatures { display: flex; gap: 24px; padding: 32px 0 8px; }
  .sig { flex: 1; text-align: center; }
  .sig-line { border-top: 1px solid #1a1a1a; margin-bottom: 5px; }
  .sig-label { font-size: 11px; color: #444; }
  .footer { text-align: center; font-size: 11px; color: #777; padding-top: 20px; line-height: 1.7; }
`;

function scopeReceiptCss(scope: string): string {
  return RECEIPT_STYLES.replace(/(^|\n)([^\n{@]+)\{/g, (_m, br, sel: string) => {
    const scoped = sel
      .trim()
      .split(",")
      .map((s) => `${scope} ${s.trim()}`)
      .join(",");
    return `${br}${scoped}{`;
  });
}

export function buildReceiptHtml({ storeName, logoUrl, sale, productContent }: ReceiptData): string {
  const unit = parsePrice(sale.price);
  const total = unit * sale.quantity;
  const image = flexibleImageUrl(sale.productImage);

  const sections = (productContent?.sections ?? []).filter(
    (s) => s.title.trim() && !isEmptyHtml(s.body)
  );

  const contentSection =
    sections.length > 0
      ? `
  <div class="section">
    ${sections.map((s) => `
      <div class="section-label">${esc(s.title)}</div>
      <div class="content-desc">${renderSectionBody(s.body)}</div>
    `).join("")}
  </div>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${esc(sale.receiptNo || sale.id)}</title>
<style>${RECEIPT_STYLES}
  html, body { margin: 0; background: #fff; }
  /* A4 page, 1in margin on every side, matching a standard Docs page setup.
     Long content simply flows onto additional A4 pages automatically. */
  @page { size: A4; margin: 0.5in 1in; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .receipt { width: auto; }
  }
</style>
</head>
<body>
<div class="receipt">
  <div class="header">
    ${logoUrl ? `<img class="logo" src="${esc(flexibleImageUrl(logoUrl))}" alt="" onerror="this.style.display='none'" />` : ""}
    <div class="header-text">
      <div class="store-name">${esc(storeName)}</div>
      <div class="receipt-title">Sales Receipt</div>
      <div class="receipt-no">No. ${esc(sale.receiptNo || "—")}</div>
    </div>
  </div>

  <div class="product">
    ${image ? `<img src="${esc(image)}" alt="" onerror="this.style.display='none'" />` : ""}
    <div class="product-info">
      <div class="product-name">${esc(sale.productName)}</div>
      <div class="product-meta">
        ${sale.colorName ? `Color: ${esc(sale.colorName)}<br/>` : ""}
        ${sale.size ? `Size: ${esc(sale.size)}` : ""}
      </div>
      <table class="totals">
        <tr><td>Unit price</td><td style="text-align:right">${formatMoney(unit)}</td></tr>
        <tr><td>Quantity</td><td style="text-align:right">× ${sale.quantity}</td></tr>
        <tr class="grand"><td>Total</td><td style="text-align:right">${formatMoney(total)}</td></tr>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Transaction Details</div>
    <table class="details">
      <tr><td>Date sold</td><td>${esc(formatDate(sale.soldAt))}</td></tr>
      <tr><td>Time of transaction</td><td>${esc(formatTime(sale.createdAt))}</td></tr>
      ${sale.paymentMethod ? `<tr><td>Payment method</td><td>${esc(sale.paymentMethod)}</td></tr>` : ""}
      ${sale.itemCode ? `<tr><td>Item code</td><td>${esc(sale.itemCode)}</td></tr>` : ""}
    </table>
  </div>

  ${(sale.customerName || sale.customerPhone || sale.customerEmail) ? `
  <div class="section">
    <div class="section-label">Customer</div>
    <table class="details">
      ${sale.customerName ? `<tr><td>Name</td><td>${esc(sale.customerName)}</td></tr>` : ""}
      ${sale.customerPhone ? `<tr><td>Contact no.</td><td>${esc(sale.customerPhone)}</td></tr>` : ""}
      ${sale.customerEmail ? `<tr><td>Email</td><td>${esc(sale.customerEmail)}</td></tr>` : ""}
    </table>
  </div>` : ""}

  ${contentSection}

  <div class="signatures">
    <div class="sig">
      <div class="sig-line"></div>
      <div class="sig-label">Customer Signature</div>
    </div>
    <div class="sig">
      <div class="sig-line"></div>
      <div class="sig-label">Received by (Admin/Staff)</div>
    </div>
  </div>

  <div class="footer">
    Thank you for your purchase!<br/>
    Receipt generated on ${esc(formatDate(new Date().toISOString()))} at ${esc(formatTime(new Date().toISOString()))}
  </div>
</div>
</body>
</html>`;
}

async function waitForImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      })
    )
  );
}

export function printReceipt(data: ReceiptData): void {
  const html = buildReceiptHtml(data);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }

  const printWhenReady = async () => {
    await waitForImages(doc);
    win.focus();
    win.print();
    setTimeout(() => iframe.remove(), 1000);
  };
  void printWhenReady();
}

export function openReceiptTab(): Window | null {
  return window.open("about:blank", "_blank");
}

export async function openReceiptPdfTab(win: Window, data: ReceiptData): Promise<void> {
  const blob = await generateReceiptPdfBlob(data);
  const url = URL.createObjectURL(blob);
  win.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function generateReceiptPdfBlob(data: ReceiptData): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const parsed = new DOMParser().parseFromString(buildReceiptHtml(data), "text/html");

  const holder = document.createElement("div");
  holder.className = "receipt-root";
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
  holder.style.width = `${CONTENT_WIDTH_PX}px`;
  const styleEl = document.createElement("style");
  styleEl.textContent = scopeReceiptCss(".receipt-root");
  holder.appendChild(styleEl);
  holder.appendChild(parsed.body.firstElementChild as HTMLElement);
  document.body.appendChild(holder);

  try {
    await waitForImages(holder);
    const target = holder.querySelector(".receipt") as HTMLElement;
    target.style.padding = "0";
    target.style.paddingBottom = "24px";

    const SCALE = 3;
    const canvas = await html2canvas(target, { scale: SCALE, backgroundColor: "#ffffff", useCORS: true });

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const availW = pageW - MARGIN_PT * 2;
    const availH = pageH - MARGIN_TOP_BOTTOM_PT * 2;

    const drawW = availW;
    const totalDrawH = (canvas.height / SCALE) * PX_TO_PT;

    if (totalDrawH <= availH) {
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", MARGIN_PT, MARGIN_TOP_BOTTOM_PT, drawW, totalDrawH);
    } else {
      const OVERLAP_PX = 40 * SCALE;
      const sliceHeightPx = Math.floor((availH / PX_TO_PT) * SCALE);
      let yPx = 0;
      while (yPx < canvas.height) {
        const h = Math.min(sliceHeightPx, canvas.height - yPx);
        if (yPx > 0) pdf.addPage();
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = h;
        const ctx = slice.getContext("2d");
        if (!ctx) break;
        ctx.drawImage(canvas, 0, yPx, canvas.width, h, 0, 0, canvas.width, h);
        pdf.addImage(
          slice.toDataURL("image/jpeg", 0.95),
          "JPEG",
          MARGIN_PT,
          MARGIN_TOP_BOTTOM_PT,
          drawW,
          Math.min((h / SCALE) * PX_TO_PT, availH)
        );
        yPx += h - (yPx + h < canvas.height ? OVERLAP_PX : 0);
      }
    }
    return pdf.output("blob");
  } finally {
    holder.remove();
  }
}

export async function downloadReceiptPdf(data: ReceiptData): Promise<void> {
  const blob = await generateReceiptPdfBlob(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Receipt-${data.sale.receiptNo || data.sale.id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}